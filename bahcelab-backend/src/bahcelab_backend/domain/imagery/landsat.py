"""Landsat 8/9 Collection 2 Level-2 yüzey sıcaklığı (Planetary Computer `landsat-c2-l2`, ADR 0017).

ST_B10 (`lwir11`) DN → Kelvin (ölçek/ofset varlığın raster:bands meta verisinden) → °C. QA_PIXEL ile bulut, gölge, kar, dolgu maskelenir.
Ürün 30 m, fiziksel (termal) çözünürlük 100 m. Bahçe + tampon (varsayılan 300 m) tek pencereden okunur; bahçe ve tampon ayrı özetlenir (karışık piksel).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date
from typing import Any

import numpy as np
import planetary_computer
import rasterio
from pystac import Item
from pystac_client import Client
from rasterio.warp import transform_geom
from rasterio.windows import Window, from_bounds
from shapely.geometry import shape

from bahcelab_backend.domain.imagery.provider import ImageryError
from bahcelab_backend.domain.imagery.sentinel2 import _GDAL_ENV, STAC_URL, with_retry

logger = logging.getLogger(__name__)
COLLECTION = "landsat-c2-l2"
KELVIN = 273.15
# QA_PIXEL bitleri (Collection 2): 0 dolgu, 1 yayılmış bulut, 2 sirrus, 3 bulut, 4 bulut gölgesi, 5 kar → hepsi geçersiz
QA_BAD_BITS = (0, 1, 2, 3, 4, 5)


def dn_to_celsius(dn: np.ndarray, scale: float, offset: float, *, nodata: int = 0) -> np.ndarray:
    """DN → °C: K = DN·ölçek + ofset; nodata (0) NaN."""
    arr = np.asarray(dn, dtype=np.float64)
    out = arr * scale + offset - KELVIN
    return np.where(arr == nodata, np.nan, out).astype(np.float32)


def qa_valid_mask(qa: np.ndarray) -> np.ndarray:
    """QA_PIXEL'den geçerli (bulutsuz, gölgesiz, karsız, dolgusuz) piksel maskesi."""
    bad = np.zeros(qa.shape, dtype=bool)
    q = np.asarray(qa, dtype=np.uint32)
    for bit in QA_BAD_BITS:
        bad |= (q >> bit) & 1 == 1
    return ~bad


@dataclass(frozen=True)
class LandsatRef:
    tarih: date
    scene_id: str
    bulut_orani: float | None
    platform: str  # landsat-8 | landsat-9
    yol_satir: str  # WRS-2 yol/satır
    handle: Any = field(default=None, compare=False)


@dataclass(frozen=True)
class LandsatPiece:
    """Bahçe + tampon penceresi: °C (geçersiz NaN), kendi 30 m ızgarası."""

    sicaklik_c: np.ndarray
    transform: Any
    crs: Any


def _scale_offset(item: Item) -> tuple[float, float]:
    band = (item.assets["lwir11"].extra_fields.get("raster:bands") or [{}])[0]
    return float(band.get("scale", 0.00341802)), float(band.get("offset", 149.0))


def _read(item: Item, geometry: dict[str, Any], buffer_m: float) -> LandsatPiece:
    st_href = planetary_computer.sign(item.assets["lwir11"].href)
    qa_href = planetary_computer.sign(item.assets["qa_pixel"].href)
    with rasterio.Env(**_GDAL_ENV), rasterio.open(st_href) as st_src:
        bounds = shape(transform_geom("EPSG:4326", st_src.crs, geometry)).buffer(buffer_m + 30).bounds
        window = from_bounds(*bounds, transform=st_src.transform).round_offsets(op="floor").round_lengths(op="ceil")
        window = window.intersection(Window(0, 0, st_src.width, st_src.height))
        dn = st_src.read(1, window=window)
        transform, crs = st_src.window_transform(window), st_src.crs
    with rasterio.Env(**_GDAL_ENV), rasterio.open(qa_href) as qa_src:
        qa = qa_src.read(1, window=window)
    scale, offset = _scale_offset(item)
    celsius = dn_to_celsius(dn, scale, offset)
    celsius[~qa_valid_mask(qa)] = np.nan
    return LandsatPiece(sicaklik_c=celsius, transform=transform, crs=crs)


class PlanetaryLandsatProvider:
    source_id = "landsat-c2-l2"

    def search(self, geometry: dict[str, Any], start: date, end: date) -> list[LandsatRef]:
        def _search() -> list[Item]:
            client = Client.open(STAC_URL)
            return list(client.search(collections=[COLLECTION], intersects=geometry, datetime=f"{start.isoformat()}/{end.isoformat()}", query={"platform": {"in": ["landsat-8", "landsat-9"]}}, max_items=2000).items())

        garden = shape(geometry)
        best: dict[date, tuple[float, Item]] = {}
        for item in with_retry(_search):
            if item.datetime is None or not item.geometry or "lwir11" not in item.assets:
                continue
            overlap = shape(item.geometry).intersection(garden.buffer(0.004)).area  # ~400 m tampon dahil örtü: kenardaki dilimde tampon eksik kalmasın
            day = item.datetime.date()
            if day not in best or overlap > best[day][0]:
                best[day] = (overlap, item)
        refs = [
            LandsatRef(day, item.id, item.properties.get("eo:cloud_cover"), str(item.properties.get("platform", "")), f"{item.properties.get('landsat:wrs_path', '')}/{item.properties.get('landsat:wrs_row', '')}", item)
            for day, (_, item) in best.items()
        ]
        return sorted(refs, key=lambda r: r.tarih)

    def read(self, ref: LandsatRef, geometry: dict[str, Any], buffer_m: float = 300.0) -> LandsatPiece:
        if ref.handle is None:
            raise ImageryError("Landsat sahnesi okunamadı: kaynak bilgisi yok.")
        return with_retry(lambda: _read(ref.handle, geometry, buffer_m))
