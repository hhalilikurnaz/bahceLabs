"""Verimlilik bölgeleri: tüm geçerli geçmiş görüntülerin piksel bazlı ortalamasından bahçeyi 3 sınıfa ayırır.

Bölgeler ileride blok bölmeye öneri olarak kullanılacaktır.
"""

from __future__ import annotations

from collections import Counter
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date
from typing import Any

import numpy as np
from pyproj import Transformer
from rasterio.features import shapes
from rasterio.transform import Affine
from shapely.geometry import MultiPolygon, Polygon, mapping, shape
from shapely.geometry.base import BaseGeometry
from shapely.ops import transform as shapely_transform

MIN_OBSERVATIONS = 3
MIN_VALID_SHARE = (
    0.4  # bir pikselin sınıflanması için görüntülerin en az bu kadarında geçerli olması gerekir
)
CLASSES = (("dusuk", "Düşük"), ("orta", "Orta"), ("yuksek", "Yüksek"))
MIN_ZONE_PIXELS = 2

_TO_EQUAL_AREA = Transformer.from_crs(4326, 6933, always_xy=True)


@dataclass(frozen=True)
class GridObservation:
    tarih: date
    values: np.ndarray  # (satir, sutun) float32, geçersiz = NaN
    corners: tuple[tuple[float, float], ...]  # KB, KD, GD, GB [boylam, enlem]


def kmeans_1d(values: np.ndarray, k: int = 3, iterations: int = 30) -> np.ndarray:
    """1B k-means; merkezler yüzdeliklerden başlatılır (deterministik). Artan sıralı merkezler döner."""
    centers = np.percentile(values, np.linspace(100 / (2 * k), 100 - 100 / (2 * k), k)).astype(
        np.float64
    )
    for _ in range(iterations):
        labels = np.argmin(np.abs(values[:, None] - centers[None, :]), axis=1)
        updated = np.array(
            [values[labels == i].mean() if np.any(labels == i) else centers[i] for i in range(k)]
        )
        if np.allclose(updated, centers, atol=1e-6):
            break
        centers = updated
    return np.sort(centers)


def _majority_filter(labels: np.ndarray, valid: np.ndarray, k: int) -> np.ndarray:
    """3×3 çoğunluk süzgeci: tek piksellik gürültüyü giderir (yalnızca geçerli komşular sayılır)."""
    padded_labels = np.pad(labels, 1, constant_values=-1)
    padded_valid = np.pad(valid, 1, constant_values=False)
    counts = np.zeros((k, *labels.shape), dtype=np.int16)
    h, w = labels.shape
    for dy in range(3):
        for dx in range(3):
            neighbor = padded_labels[dy : dy + h, dx : dx + w]
            ok = padded_valid[dy : dy + h, dx : dx + w]
            for c in range(k):
                counts[c] += (ok & (neighbor == c)).astype(np.int16)
    best = counts.argmax(axis=0)
    return np.where(valid, best, labels)


def _pixel_to_lonlat(
    corners: tuple[tuple[float, float], ...], height: int, width: int
) -> Callable[..., tuple[float, float]]:
    """Piksel (sütun, satır) → [boylam, enlem]; köşelerden afin dönüşüm (bahçe ölçeğinde yeterince doğru)."""
    tl, tr, _br, bl = corners
    ex = ((tr[0] - tl[0]) / width, (tr[1] - tl[1]) / width)
    ey = ((bl[0] - tl[0]) / height, (bl[1] - tl[1]) / height)

    def convert(x: float, y: float, z: float | None = None) -> tuple[float, float]:
        return (tl[0] + x * ex[0] + y * ey[0], tl[1] + x * ex[1] + y * ey[1])

    return convert


def _area_m2(geometry: BaseGeometry) -> float:
    return float(shapely_transform(_TO_EQUAL_AREA.transform, geometry).area)


def compute_yield_zones(
    observations: list[GridObservation], garden_geometry: dict[str, Any]
) -> dict[str, Any] | None:
    """3 verimlilik bölgesi (GeoJSON FeatureCollection) veya yeterli veri yoksa None.

    Yalnızca en yaygın ızgarayı (boyut + köşeler) paylaşan görüntüler kullanılır.
    """
    if len(observations) < MIN_OBSERVATIONS:
        return None

    signature = Counter(
        (o.values.shape, tuple(np.round(o.corners, 6).ravel())) for o in observations
    )
    (shape_hw, _corners_key), _count = signature.most_common(1)[0]
    same = [
        o
        for o in observations
        if (o.values.shape, tuple(np.round(o.corners, 6).ravel())) == (shape_hw, _corners_key)
    ]
    if len(same) < MIN_OBSERVATIONS:
        return None

    stack = np.stack([o.values for o in same])
    valid_count = np.isfinite(stack).sum(axis=0)
    usable = valid_count >= max(2, int(np.ceil(MIN_VALID_SHARE * len(same))))
    if usable.sum() < 6:
        return None
    with np.errstate(invalid="ignore"):
        mean = np.where(
            usable, np.nanmean(np.where(np.isfinite(stack), stack, np.nan), axis=0), np.nan
        )

    centers = kmeans_1d(mean[usable])
    labels = np.full(shape_hw, -1, dtype=np.int16)
    labels[usable] = np.argmin(np.abs(mean[usable][:, None] - centers[None, :]), axis=1)
    labels = _majority_filter(labels, usable, 3)

    height, width = shape_hw
    to_lonlat = _pixel_to_lonlat(same[0].corners, height, width)
    garden = shape(garden_geometry)

    features: list[dict[str, Any]] = []
    for class_index, (key, label) in enumerate(CLASSES):
        class_mask = (labels == class_index) & usable
        polygons = []
        for geometry, _ in shapes(
            class_mask.astype(np.uint8),
            mask=class_mask,
            transform=Affine.identity(),
            connectivity=4,
        ):
            poly = shapely_transform(to_lonlat, shape(geometry)).intersection(garden)
            if not poly.is_empty and poly.area > 0:
                polygons.append(poly)
        if not polygons:
            continue
        flat = [
            g
            for p in polygons
            for g in (p.geoms if hasattr(p, "geoms") else [p])
            if g.geom_type == "Polygon"
        ]
        if not flat:
            continue
        multi = MultiPolygon([g for g in flat if isinstance(g, Polygon)])
        features.append(
            {
                "type": "Feature",
                "geometry": mapping(multi),
                "properties": {
                    "sinif": key,
                    "etiket": label,
                    "alan_m2": round(_area_m2(multi), 1),
                    "piksel": int(class_mask.sum()),
                    "ortalama": round(float(mean[class_mask].mean()), 4),
                },
            }
        )

    total = sum(f["properties"]["alan_m2"] for f in features)
    if not total:
        return None
    for feature in features:
        feature["properties"]["pay"] = round(feature["properties"]["alan_m2"] / total, 4)

    return {
        "type": "FeatureCollection",
        "features": features,
        "_meta": {
            "gozlem_sayisi": len(same),
            "ilk_tarih": min(o.tarih for o in same),
            "son_tarih": max(o.tarih for o in same),
            "toplam_alan_m2": round(total, 1),
        },
    }
