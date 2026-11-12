"""Sulama sistemi kontrol işareti servisi (ADR 0029): Sentinel-2 NDMI serileri (vana/bahçe), kural, kullanıcı yanıtı. Panel `sistem_kontrol` alanını ve bildirimi buradan alır."""

from __future__ import annotations

import hashlib
import json
import logging
import uuid
from datetime import date, timedelta
from typing import Any, cast

import numpy as np
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.domain.acquisitions.store import decode_grids
from bahcelab_backend.domain.agro import catalog as cat
from bahcelab_backend.domain.agro.simulation import stage_on
from bahcelab_backend.domain.irrigation import schemas as sc
from bahcelab_backend.domain.irrigation import sistem_kontrol as sk
from bahcelab_backend.domain.multiyear.grid import canonical_grid, garden_mask
from bahcelab_backend.shared.storage import get_storage

logger = logging.getLogger(__name__)
TEK = "Bahçe"
YANIT_AD = {"sorun_yok": "kontrol ettim: sorun yoktu", "damlatici_tikali": "damlatıcı tıkalıydı", "baska_sorun": "başka bir sorun vardı"}


def _hash(geo: Any) -> str:
    return hashlib.md5(json.dumps(geo, sort_keys=True).encode()).hexdigest() if geo else "bahce"  # noqa: S324 - önbellek anahtarı


class SkServis:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.kural = cat.load_catalog().sistem_kontrol

    async def _ham_sahneler(self, garden_id: uuid.UUID, bitis: date) -> list[Any]:
        return list((await self.session.execute(text(
            "SELECT a.tarih, a.izgara_yolu, a.gecerli_oran, s.ortalama, s.gecerli_piksel FROM acquisitions a "
            "LEFT JOIN acquisition_stats s ON s.acquisition_id = a.id AND s.indeks = 'ndmi' "
            "WHERE a.garden_id = :g AND a.source_id = 'sentinel2-l2a' AND a.durum = 'net' AND a.izgara_yolu IS NOT NULL AND a.tarih <= :b ORDER BY a.tarih"), {"g": garden_id, "b": bitis})).all())

    async def seriler(self, garden_id: uuid.UUID, vanalar: list[tuple[str, dict[str, Any] | None]], bitis: date, urun: str, cesit: str | None) -> dict[str, list[sk.Gozlem]]:
        """Vana (çokgen varsa) ya da bahçe için NDMI gözlemleri; yeni sahneler önbelleğe eklenir (vana çokgeni değişirse o vana yeniden hesaplanır)."""
        ham = await self._ham_sahneler(garden_id, bitis)
        out: dict[str, list[sk.Gozlem]] = {}
        grid = None
        garden_geo: dict[str, Any] | None = None
        for ad, geo in vanalar:
            h = _hash(geo)
            await self.session.execute(text("DELETE FROM sk_ndmi WHERE garden_id = :g AND sektor_ad = :a AND geom_hash <> :h"), {"g": garden_id, "a": ad, "h": h})
            var = {r[0] for r in (await self.session.execute(text("SELECT tarih FROM sk_ndmi WHERE garden_id = :g AND sektor_ad = :a"), {"g": garden_id, "a": ad})).all()}
            eksik = [r for r in ham if r[0] not in var]
            if eksik and geo is not None and grid is None:
                garden_geo = json.loads((await self.session.execute(text("SELECT ST_AsGeoJSON(geom) FROM gardens WHERE id = :g"), {"g": garden_id})).scalar_one())
                grid = canonical_grid(garden_geo)
            maske = garden_mask(grid, geo) if (geo is not None and grid is not None) else None
            for tarih, yol, gec_oran, ort, gec_piksel in eksik:
                if maske is None:  # tek sektör: bahçe istatistiği hazır (acquisition_stats), ızgara okunmaz
                    if ort is None or not gec_piksel:
                        continue
                    ndmi, oran, piksel = float(ort), float(gec_oran or 0.0), int(gec_piksel)
                else:
                    try:
                        nd = decode_grids(get_storage().read(yol)).get("ndmi")
                    except Exception:  # noqa: BLE001 - eksik dosya o sahneyi atlatır
                        continue
                    if nd is None or nd.shape != maske.shape:
                        continue
                    toplam = int(maske.sum())
                    ok = maske & np.isfinite(nd)
                    piksel = int(ok.sum())
                    if toplam == 0 or piksel == 0:
                        continue
                    ndmi, oran = float(np.mean(nd[ok])), piksel / toplam
                await self.session.execute(text("INSERT INTO sk_ndmi (garden_id, sektor_ad, tarih, geom_hash, ndmi, gecerli_oran, piksel) VALUES (:g, :a, :t, :h, :n, :o, :p) ON CONFLICT DO NOTHING"), {"g": garden_id, "a": ad, "t": tarih, "h": h, "n": ndmi, "o": oran, "p": piksel})
            rows = (await self.session.execute(text("SELECT tarih, ndmi, gecerli_oran, piksel FROM sk_ndmi WHERE garden_id = :g AND sektor_ad = :a AND tarih <= :b ORDER BY tarih"), {"g": garden_id, "a": ad, "b": bitis})).all()
            out[ad] = [sk.Gozlem(t, n, cat.season_start_year(t), stage_on(urun, cesit, t)[0], o, p) for t, n, o, p in rows]
        return out

    async def yanitlar(self, garden_id: uuid.UUID) -> dict[tuple[str, date], tuple[str, date]]:
        r = (await self.session.execute(text("SELECT sektor_ad, sahne_tarihi, yanit, created_at::date FROM sk_yanit WHERE garden_id = :g"), {"g": garden_id})).all()
        return {(a, t): (y, c) for a, t, y, c in r}

    async def kararlar(self, garden_id: uuid.UUID, vanalar: list[tuple[str, dict[str, Any] | None]], bugun: date, urun: str, cesit: str | None, kova_ok: dict[str, dict[date, bool]]) -> dict[str, sc.SistemKontrol]:
        k = self.kural
        seri = await self.seriler(garden_id, vanalar, bugun, urun, cesit)
        yan = await self.yanitlar(garden_id)
        out: dict[str, sc.SistemKontrol] = {}
        for ad, _ in vanalar:
            diger = {d: s for d, s in seri.items() if d != ad}
            karar = sk.degerlendir(ad, seri[ad], diger, bugun, k, kova_ok.get(ad, {}))
            son = karar.sahneler[-1].tarih if karar.sahneler else None
            y = yan.get((ad, son)) if son else None
            # «sorun yoktu» yanıtı aynı sahne için işareti kapatır; daha yeni sahnede yeniden değerlendirilir
            durum = "isaret" if (karar.durum == "isaret" and (y is None or y[0] != "sorun_yok")) else "yok"
            out[ad] = sc.SistemKontrol(
                durum=cast(Any, durum), cumle=karar.neden if karar.durum == "isaret" else karar.neden, guven=karar.guven, karsilastirma=karar.karsilastirma, sahne_tarihi=son,
                sahneler=[sc.SkSahne(tarih=s.tarih, ndmi=s.ndmi, z=s.z) for s in karar.sahneler],
                taban=None if karar.taban is None else sc.SkTaban(ort=karar.taban.ort, std=karar.taban.std, n=karar.taban.n, sezon_sayisi=karar.taban.sezon_sayisi, evre=karar.taban.evre),
                yanit=None if y is None else y[0], yanit_ad=None if y is None else YANIT_AD[y[0]], kural=sc.SkKural(z_esik=k.z_esik, art_arda=k.art_arda_sahne, min_sezon=k.min_sezon),
                nasil=_nasil(karar, k),
            )
        return out

    async def yanit_yaz(self, garden_id: uuid.UUID, user_id: uuid.UUID, ad: str, sahne_tarihi: date, yanit: str) -> None:
        await self.session.execute(text("INSERT INTO sk_yanit (garden_id, sektor_ad, sahne_tarihi, yanit) VALUES (:g, :a, :t, :y) ON CONFLICT (garden_id, sektor_ad, sahne_tarihi) DO UPDATE SET yanit = EXCLUDED.yanit, created_at = now()"), {"g": garden_id, "a": ad, "t": sahne_tarihi, "y": yanit})
        # Saha Defteri'ne düşer (kural doğruluğu bu kayıtlarla ölçülür)
        await self.session.execute(
            text("INSERT INTO field_records (id, garden_id, tur, tarih, aciklama, ayrinti, created_by) VALUES (gen_random_uuid(), :g, 'gozlem', :d, :a, CAST(:y AS jsonb), :u)"),
            {"g": garden_id, "d": date.today(), "a": f"Sulama sistemi kontrolü ({ad}): {YANIT_AD[yanit]}", "y": json.dumps({"konu": "sistem_kontrol", "sektor": ad, "yanit": yanit, "sahne_tarihi": sahne_tarihi.isoformat()}), "u": user_id},
        )
        await self.session.flush()


def _nasil(karar: sk.Karar, k: cat.SistemKontrolKurali) -> str:
    if karar.taban is None:
        return f"Hesap: Sentinel-2 NDMI (yaprak suyu), bu vananın kendi geçmişiyle aynı fenolojik dönemde karşılaştırılır; en az {k.min_sezon} önceki sezon gerekir. {karar.neden}"
    t = karar.taban
    z = ", ".join(f"{s.tarih:%d.%m}: {s.ndmi:.2f} (z {s.z:.1f})" for s in karar.sahneler)
    return (f"Sentinel-2 NDMI (yaprak suyu), bu vananın önceki {t.sezon_sayisi} sezonda aynı dönemde ({t.evre}) ölçülen {t.n} gözleminin ortalaması {t.ort:.2f} ± {t.std:.2f}. "
            f"Son {len(karar.sahneler)} bulutsuz sahne: {z}. Eşik z ≤ {k.z_esik} ve art arda {k.art_arda_sahne} sahne, kova yeterliyken. Önceki veriye dayalı ön değerdir; mühendis onayı bekliyor.")


def kova_ok_haritasi(rows_by_vana: dict[str, list[Any]], taw: float, kural: cat.SulamaPlaniKurali, kova: cat.SistemKontrolKurali, pct_fn: Any, etiket_fn: Any) -> dict[str, dict[date, bool]]:
    """Vana → tarih → kova «yeterli/dolu» VE Ks = 1 (plan/uygulanan sulamalı kova)."""
    out: dict[str, dict[date, bool]] = {}
    for ad, rows in rows_by_vana.items():
        d: dict[date, bool] = {}
        for r in rows:
            if r.veri_eksik:
                continue
            e = etiket_fn(pct_fn(taw, r.tukenme_mm), kural)
            d[r.tarih] = (e in kova.kova_etiketleri) and r.ks >= 1.0
        out[ad] = d
    return out


_ = timedelta  # (tür bütünlüğü)
