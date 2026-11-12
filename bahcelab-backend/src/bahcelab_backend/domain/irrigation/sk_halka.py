"""Komşu halka referansı (ADR 0029 eki): bahçe sınırından `halka_ic_m`–`halka_dis_m` metre halka, YALNIZ ağaçlık pikseller (Sentinel-2 SCL geçerli + NDVI eşiği;
bahçenin kendisi, yollar, çıplak toprak ve su dışarıda). Halkanın NDMI serisi bahçe/vana ile AYNI sahnelerde ve AYNI yöntemle (aynı fenolojik evre, yalnız önceki sezonlar) z-skora çevrilir.

Saf yardımcılar (maske, ölçüm) birim testli; ağ/IO `SkHalkaServis` içinde (geçmiş doldurma betikle ve arka plan işiyle; panel isteği AĞ KULLANMAZ).
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import uuid
from datetime import date, timedelta
from typing import Any

import numpy as np
from pyproj import Transformer
from rasterio.features import geometry_mask
from rasterio.warp import transform_geom
from shapely.geometry import mapping, shape
from shapely.ops import transform as shp_transform
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.domain.agro.catalog import SistemKontrolKurali

logger = logging.getLogger(__name__)


def halka_maskesi(garden_wgs84: dict[str, Any], crs: Any, transform: Any, out_shape: tuple[int, int], ic_m: float, dis_m: float) -> np.ndarray:
    """Halka = bahçeyi `dis_m` büyüt − `ic_m` büyüt (en az bahçenin kendisi çıkar). Piksel merkezi halkanın içindeyse True."""
    g = shape(transform_geom("EPSG:4326", crs, garden_wgs84))
    halka = g.buffer(dis_m).difference(g.buffer(max(ic_m, 0.0))).difference(g)
    if halka.is_empty:
        return np.zeros(out_shape, dtype=bool)
    return np.asarray(geometry_mask([mapping(halka)], out_shape=out_shape, transform=transform, invert=True), dtype=bool)


def halka_olcum(ndmi: np.ndarray, ndvi: np.ndarray, valid: np.ndarray, maske: np.ndarray, kural: SistemKontrolKurali) -> tuple[float | None, float | None, int, int]:
    """(NDMI ort., NDVI ort., geçerli ağaçlık piksel, halkadaki tüm piksel). Geçerli ağaçlık sayısı < `halka_min_piksel` ise ortalamalar None (işaret üretilmez, nedeni yazılır)."""
    agac = maske & valid & np.isfinite(ndmi) & np.isfinite(ndvi) & (ndvi >= kural.halka_ndvi_min)
    n = int(agac.sum())
    if n < kural.halka_min_piksel:
        return None, None, n, int(maske.sum())
    return float(np.mean(ndmi[agac])), float(np.mean(ndvi[agac])), n, int(maske.sum())


def halka_hash(garden_geo: dict[str, Any], kural: SistemKontrolKurali) -> str:
    return hashlib.md5(json.dumps([garden_geo, kural.halka_ic_m, kural.halka_dis_m, kural.halka_ndvi_min], sort_keys=True).encode()).hexdigest()  # noqa: S324 - önbellek anahtarı


def dis_cokgen(garden_wgs84: dict[str, Any], dis_m: float) -> dict[str, Any]:
    """Okuma penceresi için bahçenin `dis_m` büyütülmüş çokgeni (WGS84)."""
    g = shape(garden_wgs84)
    utm = Transformer.from_crs("EPSG:4326", f"EPSG:{32600 + int((g.centroid.x + 180) // 6) + 1}", always_xy=True)
    geri = Transformer.from_crs(utm.target_crs, "EPSG:4326", always_xy=True)
    return mapping(shp_transform(geri.transform, shp_transform(utm.transform, g).buffer(dis_m)))


class SkHalkaServis:
    def __init__(self, session: AsyncSession, kural: SistemKontrolKurali) -> None:
        self.session = session
        self.kural = kural

    async def geriye_donuk_tarihler(self, garden_id: uuid.UUID) -> list[date]:
        return [r[0] for r in (await self.session.execute(text("SELECT tarih FROM acquisitions WHERE garden_id = :g AND source_id = 'sentinel2-l2a' AND durum = 'net' ORDER BY tarih"), {"g": garden_id})).all()]

    async def doldur(self, garden_id: uuid.UUID, *, en_cok: int | None = None, saglayici: Any = None, esamanli: int = 6) -> int:
        """Eksik sahneler için halka ölçümü okur ve `sk_halka`'ya yazar (bahçe sınırı/parametre değişirse önbellek geçersiz). Döner: yazılan satır."""
        from bahcelab_backend.domain.imagery.sentinel2 import Sentinel2L2AProvider

        geo = json.loads((await self.session.execute(text("SELECT ST_AsGeoJSON(geom) FROM gardens WHERE id = :g"), {"g": garden_id})).scalar_one())
        h = halka_hash(geo, self.kural)
        await self.session.execute(text("DELETE FROM sk_halka WHERE garden_id = :g AND geom_hash <> :h"), {"g": garden_id, "h": h})
        var = {r[0] for r in (await self.session.execute(text("SELECT tarih FROM sk_halka WHERE garden_id = :g"), {"g": garden_id})).all()}
        hedef = [t for t in await self.geriye_donuk_tarihler(garden_id) if t not in var]
        hedef = hedef[-en_cok:] if en_cok else hedef
        if not hedef:
            return 0
        sag = saglayici or Sentinel2L2AProvider()
        pencere = dis_cokgen(geo, self.kural.halka_dis_m)
        sahneler = await asyncio.to_thread(sag.search_scenes, pencere, min(hedef) - timedelta(days=1), max(hedef) + timedelta(days=1))
        refs = {s.tarih: s for s in sahneler}
        sem = asyncio.Semaphore(esamanli)

        async def oku(t: date) -> tuple[date, tuple[float | None, float | None, int, int] | None]:
            ref = refs.get(t)
            if ref is None:
                return t, None
            async with sem:
                try:
                    return t, await asyncio.to_thread(self._olc, sag, ref, geo, pencere)
                except Exception as e:  # noqa: BLE001 - bozuk sahne diğerlerini engellemesin
                    logger.warning("Halka sahnesi okunamadı (%s): %s", t, str(e)[:100])
                    return t, None

        yazilan = 0
        for t, o in await asyncio.gather(*(oku(t) for t in hedef)):
            if o is None:
                continue
            ndmi, ndvi, n, hp = o
            await self.session.execute(text("INSERT INTO sk_halka (garden_id, tarih, geom_hash, ndmi, ndvi, piksel, halka_piksel) VALUES (:g, :t, :h, :n, :v, :p, :hp) ON CONFLICT DO NOTHING"), {"g": garden_id, "t": t, "h": h, "n": ndmi, "v": ndvi, "p": n, "hp": hp})
            yazilan += 1
        await self.session.flush()
        return yazilan

    def _olc(self, sag: Any, ref: Any, geo: dict[str, Any], pencere: dict[str, Any]) -> tuple[float | None, float | None, int, int]:
        from bahcelab_backend.domain.ndvi.indices import compute_index

        sahne = sag.read_scene(ref, pencere, _ROLLER_SET())
        if not sahne.bands:  # bulutlu: sahne penceresinde geçerli piksel oranı düşük
            return None, None, 0, 0
        ndvi, ndmi = compute_index("ndvi", sahne.bands), compute_index("ndmi", sahne.bands)  # yalnız gereken iki indeks (REDEDGE bandı okunmaz)
        maske = halka_maskesi(geo, sahne.crs, sahne.transform, ndvi.shape, self.kural.halka_ic_m, self.kural.halka_dis_m)
        return halka_olcum(ndmi, ndvi, sahne.valid, maske, self.kural)


def _ROLLER_SET() -> set[str]:  # noqa: N802
    from bahcelab_backend.domain.imagery.roles import Band

    return {Band.RED.value, Band.NIR.value, Band.NIR_NARROW.value, Band.SWIR1.value}
