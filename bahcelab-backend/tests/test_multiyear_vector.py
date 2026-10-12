"""Bölge çokgenleri: net piksel ilkesi — çizim 10 m piksel kenarlarını izler (yumuşatma/sadeleştirme yok)."""

import numpy as np
from pyproj import Transformer
from shapely.geometry import box
from shapely.ops import transform as shapely_transform

from bahcelab_backend.config import Settings
from bahcelab_backend.domain.multiyear.grid import canonical_grid
from bahcelab_backend.domain.multiyear.vector import class_polygons

from .test_gardens_api import square


def test_zone_polygons_follow_pixel_edges_by_default() -> None:
    garden = square(300)
    grid = canonical_grid(garden)
    classes = np.zeros(grid.shape, dtype=np.int8)
    classes[8:13, 8:12] = 1  # 5 satır × 4 sütun = 20 piksel, bahçenin içinde
    settings = Settings()  # type: ignore[call-arg]
    assert settings.multiyear_smooth_m == 0 and settings.multiyear_simplify_m == 0
    polygons = class_polygons(classes, grid, garden, simplify_m=settings.multiyear_simplify_m, smooth_m=settings.multiyear_smooth_m)
    to_utm = Transformer.from_crs(4326, grid.epsg, always_xy=True)
    geom = shapely_transform(to_utm.transform, polygons[1])
    x0, y0 = grid.transform.c + 8 * 10, grid.transform.f - 13 * 10
    expected = box(x0, y0, x0 + 40, y0 + 50)
    assert abs(geom.area - 2000.0) < 1.0  # 20 piksel × 100 m²
    assert geom.symmetric_difference(expected).area < 1.0  # köşeler yuvarlanmadı, kenarlar piksel çizgisinde
