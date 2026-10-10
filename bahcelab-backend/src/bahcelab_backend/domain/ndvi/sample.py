"""Geliştirme için örnek NDVI serisi (ağ olmadan demo). Gerçek veri değildir: kaynak = "ornek".

Aynı işleme hattı (`analyze_scene`) kullanılır; yalnızca bantlar yapay üretilir. Arayüz bu
kayıtları «Örnek veri» olarak etiketler ve «Şimdi güncelle» gerçek veriyle değiştirir.
"""

from __future__ import annotations

import math
import random
import uuid
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any

import numpy as np
from rasterio.crs import CRS
from rasterio.transform import Affine
from rasterio.warp import transform_geom
from shapely.geometry import shape

from bahcelab_backend.domain.ndvi.models import NdviObservationModel
from bahcelab_backend.domain.ndvi.processing import SceneData, analyze_scene
from bahcelab_backend.domain.ndvi.rules import months_back
from bahcelab_backend.domain.ndvi.runner import observation_from_analysis, png_key
from bahcelab_backend.shared.storage import StorageBackend

PIXEL = 10.0
NIR = 0.35  # yapay bantlar için sabit NIR yansıtımı; kırmızı, hedef NDVI'dan türetilir
SCL_VEGETATION = 4
SCL_CLOUD_HIGH = 9


def _utm_crs(geometry: dict[str, Any]) -> CRS:
    centroid = shape(geometry).centroid
    zone = int((centroid.x + 180) // 6) + 1
    return CRS.from_epsg((32600 if centroid.y >= 0 else 32700) + zone)


def _seasonal_mean(day: date) -> float:
    """Narenciye için ılımlı mevsimsel eğri: ilkbahar sürgün tepesi, yaz sonu hafif düşüş."""
    doy = day.timetuple().tm_yday
    return (
        0.62
        + 0.06 * math.sin(2 * math.pi * (doy - 95) / 365)
        - 0.02 * math.sin(2 * math.pi * (doy - 230) / 182)
    )


@dataclass(frozen=True)
class Grid:
    crs: CRS
    transform: Affine
    shape: tuple[int, int]  # (satır, sütun)
    geometry_utm: dict[str, Any]


def grid_for(geometry: dict[str, Any]) -> Grid:
    """Bahçeyi kapsayan, 10 m'ye hizalı UTM ızgarası (gerçek sahne penceresine benzer)."""
    crs = _utm_crs(geometry)
    geometry_utm = transform_geom("EPSG:4326", crs, geometry)
    minx, miny, maxx, maxy = shape(geometry_utm).bounds
    x0 = math.floor(minx / PIXEL) * PIXEL - PIXEL
    y0 = math.floor(miny / PIXEL) * PIXEL - PIXEL
    y1 = math.ceil(maxy / PIXEL) * PIXEL + PIXEL
    width = int((math.ceil(maxx / PIXEL) * PIXEL + PIXEL - x0) / PIXEL)
    height = int((y1 - y0) / PIXEL)
    return Grid(crs, Affine(PIXEL, 0, x0, 0, -PIXEL, y1), (height, width), geometry_utm)


def make_scene(grid: Grid, ndvi: np.ndarray | float, cloud_fraction: float = 0.0) -> SceneData:
    """Hedef NDVI'dan yapay B04/B08/SCL üretir; sol taraftan `cloud_fraction` oranında bulut (SCL 9)."""
    height, width = grid.shape
    field = np.full((height, width), ndvi, dtype=np.float32) if np.isscalar(ndvi) else ndvi
    scl = np.full((height, width), SCL_VEGETATION, dtype=np.uint8)
    if cloud_fraction > 0:
        scl[:, : int(round(cloud_fraction * width))] = SCL_CLOUD_HIGH
    red = (NIR * (1 - field) / (1 + field)).astype(np.float32)
    return SceneData(
        red=red, nir=np.full_like(red, NIR), scl=scl, transform=grid.transform, crs=grid.crs
    )


def build_sample_series(
    garden_id: uuid.UUID,
    geometry: dict[str, Any],
    storage: StorageBackend,
    today: date,
    months: int = 13,
    seed: int = 7,
) -> list[NdviObservationModel]:
    rng = random.Random(seed)
    grid = grid_for(geometry)
    height, width = grid.shape

    rows, cols = np.mgrid[0:height, 0:width]
    # Yumuşak mekânsal değişim + güneybatı köşede zamanla derinleşen sorunlu bölge
    texture = 0.035 * np.sin(cols / 2.3) * np.cos(rows / 3.1) + 0.02 * np.sin((rows + cols) / 4.7)
    patch = np.exp(
        -(
            ((rows - 0.72 * height) / (0.16 * height + 1)) ** 2
            + ((cols - 0.22 * width) / (0.18 * width + 1)) ** 2
        )
    )

    start = months_back(today, months)
    days: list[date] = []
    day = today - timedelta(days=1)
    while day >= start:
        days.append(day)
        day -= timedelta(days=5)  # Sentinel-2 yaklaşık 5 günde bir geçer
    days.reverse()

    observations: list[NdviObservationModel] = []
    for index, day in enumerate(days):
        from_end = len(days) - 1 - index
        mean = _seasonal_mean(day) + rng.uniform(-0.012, 0.012)
        if from_end == 0:
            mean *= 0.86  # son görüntüde belirgin düşüş (uyarı kuralını göstermek için)
        elif from_end == 1:
            mean *= 0.93
        deficit = 0.0 if from_end > 6 else 0.22 * (1 - from_end / 7)
        ndvi = np.clip(mean + texture - deficit * patch, 0.05, 0.88).astype(np.float32)

        cloudy = rng.random() < 0.22
        cloud_fraction = (
            rng.uniform(0.45, 1.0)
            if cloudy
            else (rng.uniform(0.0, 0.25) if rng.random() < 0.2 else 0.0)
        )
        if from_end <= 5:
            cloud_fraction = (
                0.0  # son görüntüler ve karşılaştırma aralığı bulutsuz: uyarı örneği görünsün
            )
        scene = make_scene(grid, ndvi, cloud_fraction)
        analysis = analyze_scene(scene, geometry)
        key = None if analysis.bulutlu else png_key(garden_id, day)
        if key and analysis.png:
            storage.save(key, analysis.png)
        observations.append(
            observation_from_analysis(
                garden_id,
                day,
                f"ornek-{day:%Y%m%d}",
                round(cloud_fraction * 100, 1),
                analysis,
                key=key,
                source="ornek",
            )
        )
    return observations
