"""Sentinel-2 NDVI işleme çekirdeği: maskeleme, NDVI, istatistik, PNG ve sorunlu bölgeler.

Bu modül ağ kullanmaz; girdisi hazır dizilerdir (`SceneData`). Ağdan okuma `stac.py`'dadır.
"""

from __future__ import annotations

import io
from dataclasses import dataclass
from typing import Any

import numpy as np
from PIL import Image
from pyproj import Transformer
from rasterio.crs import CRS
from rasterio.features import geometry_mask, shapes
from rasterio.transform import Affine, array_bounds
from rasterio.warp import transform_geom
from shapely.geometry import shape

# SCL sınıfları: 3 bulut gölgesi, 8 orta olasılıklı bulut, 9 yüksek olasılıklı bulut, 10 ince bulut
MASKED_SCL = (3, 8, 9, 10)
MIN_VALID_RATIO = 0.70  # bahçe içindeki geçerli piksel oranı bunun altındaysa tarih "bulutlu"
NDVI_SCALE_MIN = 0.0
NDVI_SCALE_MAX = 0.9
PROBLEM_DELTA = 0.10  # medyanın bu kadar altı = sorunlu
MIN_ZONE_PIXELS = 3  # 3 piksel × 100 m² = 300 m²

# Kırmızı → sarı → yeşil. Arayüzdeki lejant (frontend ndviColor) ile aynı duraklar kullanılır.
COLOR_STOPS: list[tuple[float, tuple[int, int, int]]] = [
    (0.0, (215, 48, 39)),
    (0.3, (252, 141, 89)),
    (0.5, (254, 224, 139)),
    (0.7, (145, 207, 96)),
    (0.9, (26, 152, 80)),
]


@dataclass
class SceneData:
    """Bahçe penceresi için okunmuş bantlar (yansıtım, 0–1) ve sahne ızgarası."""

    red: np.ndarray  # B04, float32, nodata = NaN
    nir: np.ndarray  # B08
    scl: np.ndarray  # SCL, uint8, 10 m ızgarasına nearest ile örneklenmiş
    transform: Affine
    crs: CRS


@dataclass
class Analysis:
    gecerli_piksel_orani: float
    bulutlu: bool
    ortalama: float | None = None
    medyan: float | None = None
    p10: float | None = None
    p90: float | None = None
    minimum: float | None = None
    maksimum: float | None = None
    png: bytes | None = None
    sorunlu_bolgeler: dict[str, Any] | None = None
    koordinatlar: list[list[float]] | None = None  # PNG köşeleri: KB, KD, GD, GB [boylam, enlem]


def to_reflectance(
    dn: np.ndarray, scale: float = 0.0001, offset: float = 0.0, nodata: int = 0
) -> np.ndarray:
    """Sayısal değeri yansıtıma çevirir. 2022 sonrası L2A ürünlerinde offset −0,1'dir; atlanırsa NDVI sapar."""
    out = dn.astype(np.float32) * np.float32(scale) + np.float32(offset)
    out[dn == nodata] = np.nan
    return out


def compute_ndvi(red: np.ndarray, nir: np.ndarray) -> np.ndarray:
    """NDVI = (B08 − B04) / (B08 + B04); payda 0 veya veri yoksa NaN."""
    red = red.astype(np.float32)
    nir = nir.astype(np.float32)
    total = nir + red
    with np.errstate(divide="ignore", invalid="ignore"):
        ndvi = (nir - red) / total
    ndvi[~np.isfinite(ndvi) | (total == 0)] = np.nan
    return np.clip(ndvi, -1.0, 1.0)


def scl_valid_mask(scl: np.ndarray) -> np.ndarray:
    """Bulut/bulut gölgesi sınıfları (3, 8, 9, 10) dışındaki pikseller geçerlidir."""
    return ~np.isin(scl, MASKED_SCL)


def garden_pixel_mask(
    geometry_utm: dict[str, Any], shape_hw: tuple[int, int], transform: Affine
) -> np.ndarray:
    """Bahçe içindeki pikseller (piksel merkezi sınırın içinde). Çok küçük bahçede dokunan pikseller de alınır."""
    mask = geometry_mask([geometry_utm], out_shape=shape_hw, transform=transform, invert=True)
    if not mask.any():
        mask = geometry_mask(
            [geometry_utm], out_shape=shape_hw, transform=transform, invert=True, all_touched=True
        )
    return mask


def colorize(ndvi: np.ndarray, valid: np.ndarray) -> np.ndarray:
    """NDVI → RGBA. Geçersiz/bahçe dışı pikseller tamamen saydam."""
    t = np.clip(
        (np.nan_to_num(ndvi, nan=0.0) - NDVI_SCALE_MIN) / (NDVI_SCALE_MAX - NDVI_SCALE_MIN), 0, 1
    )
    xs = [(stop - NDVI_SCALE_MIN) / (NDVI_SCALE_MAX - NDVI_SCALE_MIN) for stop, _ in COLOR_STOPS]
    rgba = np.zeros((*ndvi.shape, 4), dtype=np.uint8)
    for channel in range(3):
        ys = [color[channel] for _, color in COLOR_STOPS]
        rgba[..., channel] = np.interp(t, xs, ys).astype(np.uint8)
    rgba[..., 3] = np.where(valid, 255, 0)
    return rgba


def render_png(ndvi: np.ndarray, valid: np.ndarray) -> bytes:
    """10 m çözünürlükte PNG; yeniden örnekleme istemcide nearest ile yapılır (keskin pikseller)."""
    image = Image.fromarray(colorize(ndvi, valid), mode="RGBA")
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


def image_corners(transform: Affine, crs: CRS, shape_hw: tuple[int, int]) -> list[list[float]]:
    """PNG'nin dört köşesi [boylam, enlem]: sol-üst, sağ-üst, sağ-alt, sol-alt (MapLibre image kaynağı sırası)."""
    height, width = shape_hw
    west, south, east, north = array_bounds(height, width, transform)
    to_wgs84 = Transformer.from_crs(crs, "EPSG:4326", always_xy=True)
    return [
        [round(v, 7) for v in to_wgs84.transform(x, y)]
        for x, y in ((west, north), (east, north), (east, south), (west, south))
    ]


def problem_zones(
    ndvi: np.ndarray,
    valid: np.ndarray,
    median: float,
    transform: Affine,
    crs: CRS,
) -> dict[str, Any]:
    """Bahçe medyanının 0,10 altındaki piksel kümelerini (≥ 3 piksel) poligona çevirir (GeoJSON, EPSG:4326)."""
    low = valid & (ndvi < median - PROBLEM_DELTA)
    pixel_area = abs(transform.a * transform.e)
    features: list[dict[str, Any]] = []

    if low.any():
        labelled = low.astype(np.uint8)
        for geometry, _ in shapes(labelled, mask=low, transform=transform, connectivity=4):
            poly = shape(geometry)
            pixels = int(round(poly.area / pixel_area))
            if pixels < MIN_ZONE_PIXELS:
                continue
            inside = (
                geometry_mask([geometry], out_shape=ndvi.shape, transform=transform, invert=True)
                & low
            )
            features.append(
                {
                    "type": "Feature",
                    "geometry": transform_geom(crs, "EPSG:4326", geometry, precision=7),
                    "properties": {
                        "alan_m2": round(poly.area, 1),
                        "piksel": pixels,
                        "ortalama_ndvi": round(float(np.nanmean(ndvi[inside])), 3)
                        if inside.any()
                        else None,
                    },
                }
            )

    features.sort(key=lambda f: -f["properties"]["alan_m2"])
    return {"type": "FeatureCollection", "features": features}


def analyze_scene(scene: SceneData, geometry_wgs84: dict[str, Any]) -> Analysis:
    """Bir sahneyi işler. Geçerli piksel oranı < %70 ise yalnızca oran döner (bulutlu)."""
    geometry_utm = transform_geom("EPSG:4326", scene.crs, geometry_wgs84)
    ndvi = compute_ndvi(scene.red, scene.nir)
    in_garden = garden_pixel_mask(geometry_utm, ndvi.shape, scene.transform)
    valid = in_garden & scl_valid_mask(scene.scl) & np.isfinite(ndvi)

    garden_pixels = int(in_garden.sum())
    ratio = float(valid.sum()) / garden_pixels if garden_pixels else 0.0
    if ratio < MIN_VALID_RATIO:
        return Analysis(gecerli_piksel_orani=round(ratio, 4), bulutlu=True)

    values = ndvi[valid]
    median = float(np.median(values))
    return Analysis(
        gecerli_piksel_orani=round(ratio, 4),
        bulutlu=False,
        ortalama=float(values.mean()),
        medyan=median,
        p10=float(np.percentile(values, 10)),
        p90=float(np.percentile(values, 90)),
        minimum=float(values.min()),
        maksimum=float(values.max()),
        png=render_png(ndvi, valid),
        sorunlu_bolgeler=problem_zones(ndvi, valid, median, scene.transform, scene.crs),
        koordinatlar=image_corners(scene.transform, scene.crs, ndvi.shape),
    )
