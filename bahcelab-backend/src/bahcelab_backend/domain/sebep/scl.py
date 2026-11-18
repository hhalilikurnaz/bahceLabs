"""ADIM 10B · Dilim 2: Sentinel-2 SCL bulut gölgesi (sınıf 3) + bulut olasılığı (sınıf 8, 9, 10) piksel payı, bahçe + tampon (100 m). Ağ gerektirir (Planetary Computer, anahtarsız); ölçüm betiği ve
arka plan işi kullanır, panel isteği AĞ KULLANMAZ. Saf kısım `paylar` birim testlidir."""

from __future__ import annotations

from typing import Any

import numpy as np
import planetary_computer
import rasterio
from pystac_client import Client
from rasterio.warp import transform_geom

from bahcelab_backend.domain.imagery import sentinel2 as s2
from bahcelab_backend.domain.irrigation.sk_halka import dis_cokgen
from bahcelab_backend.domain.ndvi.processing import garden_pixel_mask

GOLGE = (3,)
BULUT_OLASILIK = (8, 9, 10)  # orta/yüksek olasılıklı bulut, ince bulut
GECERSIZ = (0, 1)  # veri yok, doymuş/bozuk


def paylar(scl: np.ndarray, maske: np.ndarray) -> dict[str, float | int] | None:
    """Maskedeki piksellerde gölge ve bulut-olasılık payı (0–1). Maske boşsa None."""
    n = int(maske.sum())
    if n == 0:
        return None
    v = scl[maske]
    return {"piksel": n, "golge": float(np.isin(v, GOLGE).mean()), "bulut": float(np.isin(v, BULUT_OLASILIK).mean()), "golge_bulut": float(np.isin(v, GOLGE + BULUT_OLASILIK).mean())}


def sahne_paylari(scene_id: str, garden_geojson: dict[str, Any], tampon_m: float = 100.0) -> dict[str, float | int] | None:
    """Bir sahne için bahçe + `tampon_m` tamponunda SCL payları. Sahne bulunamazsa None."""
    geo = dis_cokgen(garden_geojson, tampon_m) if tampon_m > 0 else garden_geojson

    def _oku() -> dict[str, float | int] | None:
        items = list(Client.open(s2.STAC_URL).search(collections=[s2.COLLECTION], ids=[scene_id]).items())
        if not items:
            return None
        href = planetary_computer.sign(items[0].assets[s2.BAND_SCL].href)
        with rasterio.Env(**s2._GDAL_ENV):  # noqa: SLF001
            ref = s2._reference_window(href, geo)  # noqa: SLF001
            scl = s2._read_one(href, ref, s2.BAND_SCL).astype(np.uint8)  # noqa: SLF001
        maske = garden_pixel_mask(transform_geom("EPSG:4326", ref.crs, geo), scl.shape, ref.transform)
        return paylar(scl, maske)

    return s2.with_retry(_oku)
