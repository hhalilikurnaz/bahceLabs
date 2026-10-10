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

from bahcelab_backend.domain.ndvi.models import IndexObservationModel, SceneObservationModel
from bahcelab_backend.domain.ndvi.persist import persist_analysis
from bahcelab_backend.domain.ndvi.processing import SceneBands, analyze_scene
from bahcelab_backend.domain.ndvi.rules import months_back
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


def make_scene(
    grid: Grid,
    ndvi: np.ndarray | float,
    cloud_fraction: float = 0.0,
    *,
    ndre: np.ndarray | float | None = None,
    ndmi: np.ndarray | float | None = None,
    cigreen: np.ndarray | float | None = None,
) -> SceneBands:
    """Hedef indekslerden yapay B02–B11/SCL üretir; sol taraftan `cloud_fraction` oranında bulut (SCL 9).

    Verilmeyen indeksler NDVI'dan makul oranlarla türetilir.
    """
    height, width = grid.shape

    def field(value: np.ndarray | float) -> np.ndarray:
        return (
            np.full((height, width), value, dtype=np.float32)
            if np.isscalar(value)
            else np.asarray(value, dtype=np.float32)
        )

    n = field(ndvi)
    r = field(ndre) if ndre is not None else 0.62 * n + 0.02
    m = field(ndmi) if ndmi is not None else 0.20 + 0.25 * (n - 0.55)
    c = field(cigreen) if cigreen is not None else np.clip(3.4 * n - 0.2, 0.05, 6.0)

    nir = np.full_like(n, NIR)  # B08
    b8a = np.full_like(n, NIR + 0.02)
    bands = {
        "B08": nir,
        "B04": nir * (1 - n) / (1 + n),
        "B8A": b8a,
        "B05": b8a * (1 - r) / (1 + r),
        "B11": b8a * (1 - m) / (1 + m),
        "B03": nir / (1 + c),
    }
    bands["B02"] = bands["B03"] * 0.55

    scl = np.full((height, width), SCL_VEGETATION, dtype=np.uint8)
    if cloud_fraction > 0:
        scl[:, : int(round(cloud_fraction * width))] = SCL_CLOUD_HIGH
    return SceneBands(
        bands={k: v.astype(np.float32) for k, v in bands.items()},
        scl=scl,
        transform=grid.transform,
        crs=grid.crs,
    )


def build_sample_series(
    garden_id: uuid.UUID,
    geometry: dict[str, Any],
    storage: StorageBackend,
    today: date,
    months: int = 13,
    seed: int = 7,
) -> tuple[list[SceneObservationModel], list[IndexObservationModel]]:
    """13 aylık örnek seri: gerçek işleme hattından (analyze_scene + persist_analysis) geçirilir."""
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
    # Bahçenin sabit "verimlilik" deseni: doğuda güçlü, batıda zayıf (verimlilik bölgeleri için)
    vigor = 0.07 * (cols / max(width - 1, 1) - 0.5)

    start = months_back(today, months)
    days: list[date] = []
    day = today - timedelta(days=1)
    while day >= start:
        days.append(day)
        day -= timedelta(days=5)  # Sentinel-2 yaklaşık 5 günde bir geçer
    days.reverse()

    scenes: list[SceneObservationModel] = []
    indices: list[IndexObservationModel] = []
    for index, day in enumerate(days):
        from_end = len(days) - 1 - index
        mean = _seasonal_mean(day) + rng.uniform(-0.012, 0.012)
        if from_end == 0:
            mean *= 0.86  # son görüntüde belirgin düşüş (uyarı kuralını göstermek için)
        elif from_end == 1:
            mean *= 0.93
        deficit = 0.0 if from_end > 6 else 0.22 * (1 - from_end / 7)
        ndvi = np.clip(mean + texture + vigor - deficit * patch, 0.05, 0.88).astype(np.float32)
        # Aynı bölgede sararma (NDRE) ve su stresi (NDMI) da görünür: çoklu indeks uyarısı örneği
        ndre = np.clip(0.62 * ndvi + 0.02 - 0.9 * deficit * patch * 0.55, 0.02, 0.58)
        ndmi = np.clip(0.20 + 0.25 * (ndvi - 0.55) - 0.45 * deficit * patch * 0.5, -0.15, 0.55)

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
        analysis = analyze_scene(
            make_scene(grid, ndvi, cloud_fraction, ndre=ndre, ndmi=ndmi), geometry
        )
        new_scene, _updated, rows_for_day = persist_analysis(
            garden_id=garden_id,
            tarih=day,
            scene_id=f"ornek-{day:%Y%m%d}",
            cloud_cover=round(cloud_fraction * 100, 1),
            analysis=analysis,
            storage=storage,
            existing=None,
            source="ornek",
        )
        assert new_scene is not None
        scenes.append(new_scene)
        indices.extend(rows_for_day)
    return scenes, indices
