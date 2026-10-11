"""Çok yıllık analiz için bahçeye özgü KANONİK ızgara (10 m, UTM) ve sahneleri bu ızgaraya hizalama (SAF).

Farklı sahne/yıllar farklı pencere kaydırmalarıyla okunabilir; hepsi aynı 10 m kafesindedir (Sentinel-2 kafesi 10 m'nin katıdır),
bu yüzden hizalama tam sayı piksel kaydırmasıdır (yeniden örnekleme yok). Kafese oturmayan/başka UTM bölgesindeki sahne atlanır.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

import numpy as np
from pyproj import CRS
from rasterio.features import geometry_mask
from rasterio.transform import Affine
from rasterio.warp import transform_geom
from shapely.geometry import shape

PIXEL_M = 10.0
_TOLERANCE = 1e-3  # piksel kesri


@dataclass(frozen=True)
class CanonicalGrid:
    epsg: int
    transform: Affine
    shape: tuple[int, int]  # (satır, sütun)

    @property
    def crs(self) -> CRS:
        return CRS.from_epsg(self.epsg)


def utm_epsg(lng: float, lat: float) -> int:
    zone = int(math.floor((lng + 180.0) / 6.0)) + 1
    return (32600 if lat >= 0 else 32700) + zone


def canonical_grid(geometry_wgs84: dict[str, Any], margin_px: int = 1) -> CanonicalGrid:
    """Bahçeyi (1 piksel kenar payıyla) kapsayan, 10 m kafese oturan UTM ızgarası."""
    centroid = shape(geometry_wgs84).centroid
    epsg = utm_epsg(centroid.x, centroid.y)
    minx, miny, maxx, maxy = shape(transform_geom("EPSG:4326", f"EPSG:{epsg}", geometry_wgs84)).bounds
    x0 = math.floor(minx / PIXEL_M) * PIXEL_M - margin_px * PIXEL_M
    y1 = math.ceil(maxy / PIXEL_M) * PIXEL_M + margin_px * PIXEL_M
    x1 = math.ceil(maxx / PIXEL_M) * PIXEL_M + margin_px * PIXEL_M
    y0 = math.floor(miny / PIXEL_M) * PIXEL_M - margin_px * PIXEL_M
    cols, rows = int(round((x1 - x0) / PIXEL_M)), int(round((y1 - y0) / PIXEL_M))
    return CanonicalGrid(epsg, Affine(PIXEL_M, 0, x0, 0, -PIXEL_M, y1), (rows, cols))


def garden_mask(grid: CanonicalGrid, geometry_wgs84: dict[str, Any]) -> np.ndarray:
    """Piksel merkezi bahçe içinde olanlar; çok küçük bahçede dokunan pikseller de alınır."""
    geom = transform_geom("EPSG:4326", f"EPSG:{grid.epsg}", geometry_wgs84)
    mask = geometry_mask([geom], out_shape=grid.shape, transform=grid.transform, invert=True)
    if not mask.any():
        mask = geometry_mask([geom], out_shape=grid.shape, transform=grid.transform, invert=True, all_touched=True)
    return np.asarray(mask, dtype=bool)


def align_to_grid(values: np.ndarray, src_transform: Affine, src_epsg: int | None, grid: CanonicalGrid) -> np.ndarray | None:
    """Sahne penceresini kanonik ızgaraya yerleştirir (dışarıda kalan = NaN). Kafese oturmuyorsa ya da CRS farklıysa None."""
    if src_epsg is not None and src_epsg != grid.epsg:
        return None
    if abs(src_transform.a - PIXEL_M) > 1e-6 or abs(src_transform.e + PIXEL_M) > 1e-6:
        return None
    col = (src_transform.c - grid.transform.c) / PIXEL_M
    row = (grid.transform.f - src_transform.f) / PIXEL_M
    if abs(col - round(col)) > _TOLERANCE or abs(row - round(row)) > _TOLERANCE:
        return None
    col_off, row_off = int(round(col)), int(round(row))
    out = np.full(grid.shape, np.nan, dtype=np.float32)
    h, w = values.shape
    r0, c0 = max(0, row_off), max(0, col_off)
    r1, c1 = min(grid.shape[0], row_off + h), min(grid.shape[1], col_off + w)
    if r0 >= r1 or c0 >= c1:
        return out
    out[r0:r1, c0:c1] = values[r0 - row_off : r1 - row_off, c0 - col_off : c1 - col_off]
    return out
