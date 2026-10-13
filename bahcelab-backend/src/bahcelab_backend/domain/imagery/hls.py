"""HLS v2.0 (Harmonized Landsat Sentinel-2, 30 m) NDVI — Planetary Computer `hls2-s30` / `hls2-l30` (ADR 0018).

Kesintisiz canlılık eğrisi için GÖZLEM kaynağıdır: bahçe poligonu içindeki geçerli piksellerin NDVI ortancası + geçerli piksel oranı (Fmask). Izgara saklanmaz.
PC arşivi 2020-01-01'den başlar; öncesi için LP DAAC (earthaccess) gerekir — eğri 2020 öncesinde yalnız Sentinel-2 gözlemlerine dayanır.
S30: kırmızı B04, NIR B8A · L30: kırmızı B04, NIR B05. Yansıma = DN × 0,0001, dolgu −9999.
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
from rasterio.features import geometry_mask
from rasterio.warp import transform_geom
from rasterio.windows import Window, from_bounds
from shapely.geometry import shape

from bahcelab_backend.domain.imagery.provider import ImageryError
from bahcelab_backend.domain.imagery.sentinel2 import _GDAL_ENV, STAC_URL, with_retry

logger = logging.getLogger(__name__)
SCALE = 0.0001
NODATA = -9999
BANDS: dict[str, tuple[str, str]] = {"hls2-s30": ("B04", "B8A"), "hls2-l30": ("B04", "B05")}
SOURCE_OF = {"hls2-s30": "hls-s30", "hls2-l30": "hls-l30"}
# Fmask bitleri (HLS v2): 0 sirrus, 1 bulut, 2 bulut/gölge komşuluğu, 3 bulut gölgesi, 4 kar/buz → geçersiz; 6–7 aerosol düzeyi (3 = yüksek) → geçersiz
FMASK_BAD_BITS = (0, 1, 2, 3, 4)


def fmask_valid(fmask: np.ndarray) -> np.ndarray:
    f = np.asarray(fmask, dtype=np.uint8)
    bad = np.zeros(f.shape, dtype=bool)
    for bit in FMASK_BAD_BITS:
        bad |= ((f >> bit) & 1) == 1
    bad |= ((f >> 6) & 3) == 3  # yüksek aerosol
    return ~bad


def ndvi_from_dn(red: np.ndarray, nir: np.ndarray) -> np.ndarray:
    """DN → NDVI (float32); dolgu ya da yansıma toplamı ≤ 0 olan piksel NaN."""
    r, n = np.asarray(red, dtype=np.float64), np.asarray(nir, dtype=np.float64)
    invalid = (r == NODATA) | (n == NODATA)
    r, n = r * SCALE, n * SCALE
    total = r + n
    with np.errstate(divide="ignore", invalid="ignore"):
        out = np.where(~invalid & (total > 0), (n - r) / total, np.nan)
    return np.clip(out, -1.0, 1.0).astype(np.float32)


@dataclass(frozen=True)
class HlsRef:
    tarih: date
    scene_id: str
    kaynak: str  # hls-s30 | hls-l30
    bulut_orani: float | None
    handle: Any = field(default=None, compare=False)


@dataclass(frozen=True)
class HlsPiece:
    """Bahçe penceresi: NDVI (bulut/gölge vb. NaN) ve kendi 30 m ızgarası."""

    ndvi: np.ndarray
    transform: Any
    crs: Any


@dataclass(frozen=True)
class HlsObservationValue:
    ndvi: float | None  # poligon içi geçerli piksellerin ortancası (geçerli piksel yoksa None)
    gecerli_oran: float
    gecerli_piksel: int
    toplam_piksel: int


def polygon_pixels(piece: HlsPiece, geometry: dict[str, Any]) -> np.ndarray:
    """Poligon içindeki piksel maskesi (30 m): piksel merkezi içeride olanlar; hiç yoksa (çok küçük bahçe) dokunulan pikseller."""
    poly = transform_geom("EPSG:4326", piece.crs, geometry)
    shape_ = piece.ndvi.shape
    inside = ~geometry_mask([poly], out_shape=shape_, transform=piece.transform, all_touched=False)
    return inside if inside.any() else ~geometry_mask([poly], out_shape=shape_, transform=piece.transform, all_touched=True)


def summarize(piece: HlsPiece, geometry: dict[str, Any]) -> HlsObservationValue:
    mask = polygon_pixels(piece, geometry)
    total = int(mask.sum())
    values = piece.ndvi[mask]
    valid = values[np.isfinite(values)]
    if total == 0:
        return HlsObservationValue(None, 0.0, 0, 0)
    return HlsObservationValue(float(np.median(valid)) if valid.size else None, float(valid.size) / total, int(valid.size), total)


def _read(item: Item, collection: str, geometry: dict[str, Any]) -> HlsPiece:
    red_key, nir_key = BANDS[collection]
    hrefs = {k: planetary_computer.sign(item.assets[k].href) for k in (red_key, nir_key, "Fmask")}
    with rasterio.Env(**_GDAL_ENV), rasterio.open(hrefs[red_key]) as src:
        bounds = shape(transform_geom("EPSG:4326", src.crs, geometry)).buffer(60).bounds  # 2 piksel kenar payı (kenar pikselleri için)
        window = from_bounds(*bounds, transform=src.transform).round_offsets(op="floor").round_lengths(op="ceil")
        window = window.intersection(Window(0, 0, src.width, src.height))
        red = src.read(1, window=window)
        transform, crs = src.window_transform(window), src.crs
    with rasterio.Env(**_GDAL_ENV):
        with rasterio.open(hrefs[nir_key]) as src:
            nir = src.read(1, window=window)
        with rasterio.open(hrefs["Fmask"]) as src:
            fmask = src.read(1, window=window)
    ndvi = ndvi_from_dn(red, nir)
    ndvi[~fmask_valid(fmask)] = np.nan
    return HlsPiece(ndvi=ndvi, transform=transform, crs=crs)


class PlanetaryHlsProvider:
    def search(self, geometry: dict[str, Any], start: date, end: date) -> list[HlsRef]:
        def _search() -> list[tuple[str, Item]]:
            client = Client.open(STAC_URL)
            out: list[tuple[str, Item]] = []
            for collection in BANDS:
                out += [(collection, i) for i in client.search(collections=[collection], intersects=geometry, datetime=f"{start.isoformat()}/{end.isoformat()}", max_items=4000).items()]
            return out

        garden = shape(geometry)
        best: dict[tuple[str, date], tuple[float, str, Item]] = {}
        for collection, item in with_retry(_search):
            if item.datetime is None or not item.geometry or "Fmask" not in item.assets:
                continue
            overlap = shape(item.geometry).intersection(garden).area
            key = (collection, item.datetime.date())
            if key not in best or overlap > best[key][0]:
                best[key] = (overlap, collection, item)
        refs = [HlsRef(day, item.id, SOURCE_OF[collection], item.properties.get("eo:cloud_cover"), (collection, item)) for (collection, day), (_, _, item) in best.items()]
        return sorted(refs, key=lambda r: (r.tarih, r.kaynak))

    def read(self, ref: HlsRef, geometry: dict[str, Any]) -> HlsPiece:
        if ref.handle is None:
            raise ImageryError("HLS sahnesi okunamadı: kaynak bilgisi yok.")
        collection, item = ref.handle
        return with_retry(lambda: _read(item, collection, geometry))
