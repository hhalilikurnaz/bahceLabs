"""Etiket/istikrar rasterlarını PostGIS'e yazılacak çokgenlere çevirir (SAF): sınıf başına tek MultiPolygon, bahçe sınırına kırpılmış."""

from __future__ import annotations

from typing import Any

import numpy as np
from pyproj import Transformer
from rasterio.features import shapes
from shapely.geometry import MultiPolygon, Polygon, shape
from shapely.geometry.base import BaseGeometry
from shapely.ops import transform as shapely_transform
from shapely.ops import unary_union

from bahcelab_backend.domain.multiyear.grid import CanonicalGrid


def class_polygons(
    classes: np.ndarray, grid: CanonicalGrid, garden_wgs84: dict[str, Any], *, simplify_m: float = 3.0, smooth_m: float = 4.0
) -> dict[int, MultiPolygon]:
    """{sınıf: MultiPolygon (EPSG:4326)}. 0 = yok sayılır. `smooth_m`: açıp kapama (köşe yumuşatma), `simplify_m`: sadeleştirme."""
    to_utm = Transformer.from_crs(4326, grid.epsg, always_xy=True)
    to_wgs = Transformer.from_crs(grid.epsg, 4326, always_xy=True)
    garden_utm = shapely_transform(to_utm.transform, shape(garden_wgs84))
    out: dict[int, MultiPolygon] = {}
    for cls in sorted(int(c) for c in np.unique(classes) if c > 0):
        mask = classes == cls
        parts: list[BaseGeometry] = [shape(g) for g, v in shapes(mask.astype(np.uint8), mask=mask, transform=grid.transform, connectivity=4) if v == 1]
        if not parts:
            continue
        geom = unary_union(parts)
        if smooth_m > 0:
            geom = geom.buffer(smooth_m, join_style="round").buffer(-2 * smooth_m, join_style="round").buffer(smooth_m, join_style="round")
        if simplify_m > 0:
            geom = geom.simplify(simplify_m)
        geom = geom.intersection(garden_utm)
        if geom.is_empty:
            continue
        wgs = shapely_transform(to_wgs.transform, geom)
        polygons = [g for g in (wgs.geoms if hasattr(wgs, "geoms") else [wgs]) if isinstance(g, Polygon) and not g.is_empty]
        if polygons:
            out[cls] = MultiPolygon(polygons)
    return out
