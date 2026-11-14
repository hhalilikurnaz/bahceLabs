"""Bahçe topografya profili (BİR KEZ hesaplanır, geometri değişince yenilenir): Copernicus DEM GLO-30 (AWS açık veri) → betimleyici profil + bahçe içi göreli soğuk nokta (yalnız koşul sağlanırsa).
°C VERMEZ (arazi tabanlı mutlak sıcaklık düzeltmesi yok: don-dogrulama.md §2). Ağ yalnız `dem_penceresi`'nde; geri kalan saf ve testlidir."""

from __future__ import annotations

import asyncio
import hashlib
import json
import math
import uuid
from dataclasses import dataclass
from typing import Any

import numpy as np
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.domain.agro.catalog import DonKurali, load_catalog
from bahcelab_backend.domain.don import arazi

KAYNAK = "Copernicus DEM GLO-30 (30 m), AWS Open Data"
AWS = "https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_{ns}{lat:02d}_00_{ew}{lon:03d}_00_DEM/Copernicus_DSM_COG_10_{ns}{lat:02d}_00_{ew}{lon:03d}_00_DEM.tif"


@dataclass(frozen=True)
class Pencere:
    z: np.ndarray  # 30 m UTM, metre
    x0: float
    y0: float
    epsg: int


def _utm_epsg(lat: float, lon: float) -> int:
    return (32600 if lat >= 0 else 32700) + int((lon + 180) // 6) + 1


def dem_penceresi(lat: float, lon: float, yaricap_km: float) -> Pencere:
    """(lat, lon) çevresinde ±yaricap_km, UTM 30 m (bilineer). Birden çok 1° karo gerekirse birleştirilir; karo yoksa (deniz) 0 m."""
    import rasterio
    from pyproj import Transformer
    from rasterio.transform import from_origin
    from rasterio.warp import Resampling, reproject
    from rasterio.windows import Window, from_bounds

    epsg = _utm_epsg(lat, lon)
    cx, cy = Transformer.from_crs(4326, epsg, always_xy=True).transform(lon, lat)
    n = int(yaricap_km * 1000 / arazi.PIKSEL_M)
    x0, y0 = cx - n * arazi.PIKSEL_M, cy + n * arazi.PIKSEL_M
    dst = np.full((2 * n + 1, 2 * n + 1), np.nan, dtype="float32")
    dst_tr = from_origin(x0, y0, arazi.PIKSEL_M, arazi.PIKSEL_M)
    derece = yaricap_km / 111.0 * 1.6 + 0.01
    for la, lo in sorted({(math.floor(a), math.floor(b)) for a in (lat - derece, lat + derece) for b in (lon - derece, lon + derece)}):
        url = AWS.format(ns="N" if la >= 0 else "S", lat=abs(la), ew="E" if lo >= 0 else "W", lon=abs(lo))
        try:
            with rasterio.open(url) as ds:
                w = from_bounds(lon - derece, lat - derece, lon + derece, lat + derece, ds.transform).intersection(Window(0, 0, ds.width, ds.height))
                tmp = np.full_like(dst, np.nan)
                reproject(ds.read(1, window=w).astype("float32"), tmp, src_transform=ds.window_transform(w), src_crs=ds.crs, dst_transform=dst_tr, dst_crs=f"EPSG:{epsg}", resampling=Resampling.bilinear, dst_nodata=np.nan)
                dst = np.where(np.isnan(dst), tmp, dst)
        except Exception:  # noqa: BLE001 — karo yok (deniz/kapsam dışı)
            continue
    return Pencere(np.where(np.isnan(dst), 0.0, dst), x0, y0, epsg)


def bahce_ici(z: np.ndarray, maske: np.ndarray, kural: DonKurali) -> dict[str, Any]:
    """Bahçe içi göreli soğuk nokta. YALNIZ rölyef ≥ rolyef_min_m VE ortalama eğim ≥ egim_min_der ise üretilir; değilse neden yazılır.
    Göreli soğukluk = (z_max − z)/(z_max − z_min): soğuk hava bahçenin alçak kısmında birikir (varsayım etiketli; °C DEĞİL, sıralama)."""
    n = int(maske.sum())
    if n == 0:
        return {"uygun": False, "neden": "Bahçe DEM ızgarasında piksel örtmüyor.", "piksel": 0}
    zz = z[maske]
    rolyef = float(zz.max() - zz.min())
    egim, _ = arazi.egim_baki(z)
    egim_ort = float(egim[maske].mean())
    ozet: dict[str, Any] = {"piksel": n, "rolyef_m": round(rolyef, 1), "egim_ort_der": round(egim_ort, 1)}
    nedenler = []
    if rolyef < kural.rolyef_min_m:
        nedenler.append(f"bahçe içi yükseklik farkı {rolyef:.0f} m (en az {kural.rolyef_min_m:g} m gerekir; DEM dikey hatası birkaç metredir)")
    if egim_ort < kural.egim_min_der:
        nedenler.append(f"ortalama eğim {egim_ort:.1f}° (en az {kural.egim_min_der:g}° gerekir)")
    if nedenler:
        return {**ozet, "uygun": False, "neden": "Bahçe içi göreli soğuk nokta üretilmedi: " + "; ".join(nedenler) + "."}
    return {**ozet, "uygun": True, "neden": None, "aciklama": "Göreli sıralama (0 = en ılık, 1 = en soğuk); sıcaklık değeri değildir. Varsayım: soğuk hava bahçenin alçak kısmında birikir.", "_goreli": ((zz.max() - zz) / max(rolyef, 1e-6))}


def hesapla_saf(pencere: Pencere, poligon_utm: Any, kural: DonKurali) -> dict[str, Any]:
    """Saf hesap (testlenebilir): poligon UTM metre cinsinden shapely geometri."""
    from rasterio.features import rasterize
    from rasterio.transform import from_origin

    z = pencere.z
    maske = rasterize([(poligon_utm, 1)], out_shape=z.shape, transform=from_origin(pencere.x0, pencere.y0, arazi.PIKSEL_M, arazi.PIKSEL_M), all_touched=True).astype(bool)
    c = poligon_utm.centroid
    r, k = int((pencere.y0 - c.y) / arazi.PIKSEL_M), int((c.x - pencere.x0) / arazi.PIKSEL_M)
    profil = {a: round(b, 2) for a, b in arazi.profil_nokta(z, r, k).items()}
    bi = bahce_ici(z, maske, kural)
    goreli = bi.pop("_goreli", None)
    if goreli is not None:
        rr, cc = np.nonzero(maske)
        bi["hucreler"] = [{"x": round(float(pencere.x0 + (j + 0.5) * arazi.PIKSEL_M), 1), "y": round(float(pencere.y0 - (i + 0.5) * arazi.PIKSEL_M), 1), "goreli_soguk": round(float(g), 2)} for i, j, g in zip(rr, cc, goreli, strict=True)]
        bi["epsg"] = pencere.epsg
    return {"profil": profil, "bahce_ici": bi}


def geom_hash(geojson: dict[str, Any]) -> str:
    return hashlib.sha256(json.dumps(geojson, sort_keys=True).encode()).hexdigest()[:16]


async def hesapla(session: AsyncSession, garden_id: uuid.UUID, kural: DonKurali | None = None, pencere_fn: Any = None) -> dict[str, Any] | None:
    """Bahçenin topografya profilini hesaplar ve `bahce_topografya`'ya yazar (geometri değişmediyse ve kural sürümü aynıysa yeniden hesaplamaz)."""
    from shapely.geometry import shape
    from shapely.ops import transform as shp_transform

    k = kural or load_catalog().don
    row = (await session.execute(text("SELECT ST_AsGeoJSON(geom) FROM gardens WHERE id = :g"), {"g": garden_id})).first()
    if row is None:
        return None
    gj = json.loads(row[0])
    h = geom_hash(gj) + ":" + k.surum
    var = (await session.execute(text("SELECT geom_hash FROM bahce_topografya WHERE garden_id = :g"), {"g": garden_id})).scalar()
    if var == h:
        return None
    geom = shape(gj)
    c = geom.centroid
    pencere = await asyncio.to_thread(pencere_fn or dem_penceresi, c.y, c.x, k.dem_pencere_km)
    from pyproj import Transformer

    t = Transformer.from_crs(4326, pencere.epsg, always_xy=True)
    sonuc = await asyncio.to_thread(hesapla_saf, pencere, shp_transform(t.transform, geom), k)
    await session.execute(
        text("INSERT INTO bahce_topografya (garden_id, geom_hash, kaynak, profil, bahce_ici, hesaplandi) VALUES (:g, :h, :k, CAST(:p AS jsonb), CAST(:b AS jsonb), clock_timestamp()) "
             "ON CONFLICT (garden_id) DO UPDATE SET geom_hash = :h, kaynak = :k, profil = CAST(:p AS jsonb), bahce_ici = CAST(:b AS jsonb), hesaplandi = clock_timestamp()"),
        {"g": garden_id, "h": h, "k": KAYNAK, "p": json.dumps(sonuc["profil"]), "b": json.dumps(sonuc["bahce_ici"])},
    )
    return sonuc
