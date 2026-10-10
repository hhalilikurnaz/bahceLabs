"""Sentinel-2 çoklu indeks işleme çekirdeği: maskeleme, indeksler, istatistik, PNG, ızgara ve sorunlu bölgeler.

Bu modül ağ kullanmaz; girdisi hazır dizilerdir (`SceneBands`). Ağdan okuma `stac.py`'dadır.
"""

from __future__ import annotations

import io
from dataclasses import dataclass, field
from typing import Any

import numpy as np
from PIL import Image
from pyproj import Transformer
from rasterio.crs import CRS
from rasterio.features import geometry_mask, shapes
from rasterio.transform import Affine, array_bounds
from rasterio.warp import transform_geom
from shapely.geometry import shape

from bahcelab_backend.domain.ndvi.indices import (
    COLORMAPS,
    INDICES,
    TRUE_COLOR,
    IndexDef,
    compute_index,
)

# SCL sınıfları: 3 bulut gölgesi, 8 orta olasılıklı bulut, 9 yüksek olasılıklı bulut, 10 ince bulut
MASKED_SCL = (3, 8, 9, 10)
MIN_VALID_RATIO = 0.70  # bahçe içindeki geçerli piksel oranı bunun altındaysa tarih "bulutlu"
MIN_ZONE_PIXELS = 3  # 3 piksel × 100 m² = 300 m²
MAX_PNG_SIDE = 1024  # keskin (nearest) büyütmeyle PNG'nin en uzun kenarı bu değeri aşmaz
MAX_PNG_SCALE = 8
TRUE_COLOR_REFLECTANCE_MAX = 0.28  # bu yansıtım tam parlaklık sayılır
TRUE_COLOR_GAMMA = 1.3


@dataclass
class SceneBands:
    """Bahçe penceresi için okunmuş bantlar (yansıtım, 0–1, veri yoksa NaN) ve sahne ızgarası.

    20 m bantlar (B05, B8A, B11) okuma sırasında 10 m ızgarasına bilinear örneklenmiş olmalıdır;
    SCL nearest ile örneklenir.
    """

    bands: dict[str, np.ndarray]
    scl: np.ndarray  # uint8
    transform: Affine
    crs: CRS

    @property
    def shape(self) -> tuple[int, int]:
        return self.scl.shape


@dataclass
class IndexResult:
    indeks: str
    ortalama: float
    medyan: float
    p10: float
    p90: float
    minimum: float
    maksimum: float
    png: bytes  # mutlak skala, poligonla kırpılmış, keskin büyütülmüş
    grid: bytes  # float32 (little-endian), satır sırası, geçersiz = NaN
    sorunlu_bolgeler: dict[str, Any]


@dataclass
class SceneAnalysis:
    gecerli_piksel_orani: float
    bulutlu: bool
    satir: int = 0
    sutun: int = 0
    koordinatlar: list[list[float]] | None = (
        None  # görüntü köşeleri: KB, KD, GD, GB [boylam, enlem]
    )
    indeksler: dict[str, IndexResult] = field(default_factory=dict)
    gercek_renk_png: bytes | None = None


def to_reflectance(
    dn: np.ndarray, scale: float = 0.0001, offset: float = 0.0, nodata: int = 0
) -> np.ndarray:
    """Sayısal değeri yansıtıma çevirir. 2022 sonrası L2A ürünlerinde offset −0,1'dir; atlanırsa indeksler sapar."""
    out = dn.astype(np.float32) * np.float32(scale) + np.float32(offset)
    out[dn == nodata] = np.nan
    return out


def scl_valid_mask(scl: np.ndarray) -> np.ndarray:
    """Bulut/bulut gölgesi sınıfları (3, 8, 9, 10) dışındaki pikseller geçerlidir."""
    return ~np.isin(scl, MASKED_SCL)


def garden_pixel_mask(
    geometry_utm: dict[str, Any],
    shape_hw: tuple[int, int],
    transform: Affine,
    *,
    all_touched: bool = False,
) -> np.ndarray:
    """Bahçe içindeki pikseller (piksel merkezi sınırın içinde). Çok küçük bahçede dokunan pikseller de alınır."""
    mask = geometry_mask(
        [geometry_utm],
        out_shape=shape_hw,
        transform=transform,
        invert=True,
        all_touched=all_touched,
    )
    if not mask.any() and not all_touched:
        mask = geometry_mask(
            [geometry_utm], out_shape=shape_hw, transform=transform, invert=True, all_touched=True
        )
    return mask


# ---------------------------------------------------------------- renklendirme ve PNG
def colorize(
    values: np.ndarray,
    valid: np.ndarray,
    vmin: float,
    vmax: float,
    colormap: str,
) -> np.ndarray:
    """Değerleri [vmin, vmax] aralığında renk skalasına eşler → RGBA (geçersiz = tamamen saydam)."""
    stops = COLORMAPS[colormap]
    xs = [pos for pos, _ in stops]
    span = (vmax - vmin) or 1.0
    t = np.clip((np.nan_to_num(values, nan=vmin) - vmin) / span, 0, 1)
    rgba = np.zeros((*values.shape, 4), dtype=np.uint8)
    for channel in range(3):
        ys = [color[channel] for _, color in stops]
        rgba[..., channel] = np.interp(t, xs, ys).astype(np.uint8)
    rgba[..., 3] = np.where(valid, 255, 0)
    return rgba


def png_scale(shape_hw: tuple[int, int]) -> int:
    """PNG büyütme katsayısı: küçük bahçelerde daha fazla, büyüklerde 1'e kadar iner."""
    return max(1, min(MAX_PNG_SCALE, MAX_PNG_SIDE // max(shape_hw)))


def _encode_png(rgba: np.ndarray) -> bytes:
    buffer = io.BytesIO()
    Image.fromarray(rgba, mode="RGBA").save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


def render_clipped_png(rgba: np.ndarray, geometry_utm: dict[str, Any], transform: Affine) -> bytes:
    """10 m pikselleri keskin (nearest) büyütür ve bahçe poligonuyla ince çözünürlükte kırpar.

    Piksel merkezi poligonun içinde olan ama bloğu sınırdan taşan pikseller böylece tam sınırda biter.
    """
    factor = png_scale(rgba.shape[:2])
    big = np.repeat(np.repeat(rgba, factor, axis=0), factor, axis=1)
    fine = Affine(
        transform.a / factor,
        transform.b,
        transform.c,
        transform.d,
        transform.e / factor,
        transform.f,
    )
    inside = geometry_mask(
        [geometry_utm], out_shape=big.shape[:2], transform=fine, invert=True, all_touched=False
    )
    if not inside.any():
        inside = geometry_mask(
            [geometry_utm], out_shape=big.shape[:2], transform=fine, invert=True, all_touched=True
        )
    big = big.copy()
    big[..., 3] = np.where(inside, big[..., 3], 0)
    return _encode_png(big)


def render_true_color_png(bands: dict[str, np.ndarray], in_garden_touched: np.ndarray) -> bytes:
    """Gerçek renk (B04, B03, B02): skalasız; bahçe penceresi 10 m çözünürlükte, poligonla ayrıca kırpılmaz
    (arayüz kırpar; böylece yumuşak/keskin çizim seçilebilir)."""
    rgb = np.stack([bands["B04"], bands["B03"], bands["B02"]], axis=-1)
    finite = np.isfinite(rgb).all(axis=-1)
    scaled = np.clip(np.nan_to_num(rgb, nan=0.0) / TRUE_COLOR_REFLECTANCE_MAX, 0, 1) ** (
        1 / TRUE_COLOR_GAMMA
    )
    rgba = np.zeros((*finite.shape, 4), dtype=np.uint8)
    rgba[..., :3] = (scaled * 255).astype(np.uint8)
    rgba[..., 3] = np.where(finite & in_garden_touched, 255, 0)
    return _encode_png(rgba)


def image_corners(transform: Affine, crs: CRS, shape_hw: tuple[int, int]) -> list[list[float]]:
    """Görüntünün dört köşesi [boylam, enlem]: sol-üst, sağ-üst, sağ-alt, sol-alt (MapLibre kaynak sırası)."""
    height, width = shape_hw
    west, south, east, north = array_bounds(height, width, transform)
    to_wgs84 = Transformer.from_crs(crs, "EPSG:4326", always_xy=True)
    return [
        [round(v, 7) for v in to_wgs84.transform(x, y)]
        for x, y in ((west, north), (east, north), (east, south), (west, south))
    ]


# ---------------------------------------------------------------- sorunlu bölgeler
def problem_zones(
    values: np.ndarray,
    valid: np.ndarray,
    median: float,
    delta: float,
    transform: Affine,
    crs: CRS,
) -> dict[str, Any]:
    """Bahçe medyanının `delta` altındaki piksel kümelerini (≥ 3 piksel) poligona çevirir (GeoJSON, EPSG:4326)."""
    low = valid & (values < median - delta)
    pixel_area = abs(transform.a * transform.e)
    features: list[dict[str, Any]] = []

    if low.any():
        for geometry, _ in shapes(
            low.astype(np.uint8), mask=low, transform=transform, connectivity=4
        ):
            poly = shape(geometry)
            pixels = int(round(poly.area / pixel_area))
            if pixels < MIN_ZONE_PIXELS:
                continue
            inside = (
                geometry_mask([geometry], out_shape=values.shape, transform=transform, invert=True)
                & low
            )
            features.append(
                {
                    "type": "Feature",
                    "geometry": transform_geom(crs, "EPSG:4326", geometry, precision=7),
                    "properties": {
                        "alan_m2": round(poly.area, 1),
                        "piksel": pixels,
                        "ortalama": round(float(np.nanmean(values[inside])), 3)
                        if inside.any()
                        else None,
                    },
                }
            )

    features.sort(key=lambda f: -f["properties"]["alan_m2"])
    return {"type": "FeatureCollection", "features": features}


# ---------------------------------------------------------------- sahne analizi
def _analyze_index(
    definition: IndexDef,
    values: np.ndarray,
    valid_core: np.ndarray,
    visible_core: np.ndarray,
    scene: SceneBands,
    geometry_utm: dict[str, Any],
) -> IndexResult | None:
    """İstatistikler yalnızca piksel merkezi bahçe içinde olan pikselleri sayar (`valid_core`).
    Görüntü ve ham ızgara ise poligona değen pikselleri de içerir (`visible_core`): raster sınıra kadar
    uzanır ve poligonla ince çözünürlükte kırpılır; sınırın dışında hiçbir şey görünmez."""
    valid = valid_core & np.isfinite(values)
    if not valid.any():
        return None
    visible = visible_core & np.isfinite(values)

    selected = values[valid]
    median = float(np.median(selected))
    rgba = colorize(values, visible, definition.min, definition.max, definition.renk)
    grid = np.where(visible, values, np.nan).astype("<f4")
    return IndexResult(
        indeks=definition.id,
        ortalama=float(selected.mean()),
        medyan=median,
        p10=float(np.percentile(selected, 10)),
        p90=float(np.percentile(selected, 90)),
        minimum=float(selected.min()),
        maksimum=float(selected.max()),
        png=render_clipped_png(rgba, geometry_utm, scene.transform),
        grid=grid.tobytes(),
        sorunlu_bolgeler=problem_zones(
            values, valid, median, definition.sorun_esigi, scene.transform, scene.crs
        ),
    )


def analyze_scene(
    scene: SceneBands, geometry_wgs84: dict[str, Any], outputs: set[str] | None = None
) -> SceneAnalysis:
    """Bir sahneden istenen çıktıları (indeksler ve gerçek renk) üretir.

    "Bulutlu" kararı yalnızca SCL ve bahçe sınırıyla verilir: geçerli piksel oranı < %70 ise
    hiçbir çıktı üretilmez (bu durumda `scene.bands` boş olabilir).
    """
    wanted = set(outputs) if outputs is not None else set(INDICES) | {TRUE_COLOR}
    geometry_utm = transform_geom("EPSG:4326", scene.crs, geometry_wgs84)
    shape_hw = scene.shape

    in_garden = garden_pixel_mask(geometry_utm, shape_hw, scene.transform)
    scl_ok = scl_valid_mask(scene.scl)
    garden_pixels = int(in_garden.sum())
    # Önce yalnızca SCL ile eleme: bulutlu sahnede ek bantlar hiç okunmaz (`scene.bands` boştur)
    ratio = float((in_garden & scl_ok).sum()) / garden_pixels if garden_pixels else 0.0
    if ratio < MIN_VALID_RATIO or "B04" not in scene.bands:
        return SceneAnalysis(gecerli_piksel_orani=round(ratio, 4), bulutlu=True)

    # Veri yok (NaN) pikseller de geçersiz sayılır
    finite = np.isfinite(scene.bands["B04"]) & np.isfinite(scene.bands["B08"])
    valid_core = in_garden & scl_ok & finite
    ratio = float(valid_core.sum()) / garden_pixels
    if ratio < MIN_VALID_RATIO:
        return SceneAnalysis(gecerli_piksel_orani=round(ratio, 4), bulutlu=True)
    touched = garden_pixel_mask(geometry_utm, shape_hw, scene.transform, all_touched=True)
    visible_core = touched & scl_ok & finite

    analysis = SceneAnalysis(
        gecerli_piksel_orani=round(ratio, 4),
        bulutlu=False,
        satir=shape_hw[0],
        sutun=shape_hw[1],
        koordinatlar=image_corners(scene.transform, scene.crs, shape_hw),
    )

    for index_id in INDICES:
        if index_id not in wanted:
            continue
        definition = INDICES[index_id]
        values = compute_index(index_id, scene.bands)
        result = _analyze_index(definition, values, valid_core, visible_core, scene, geometry_utm)
        if result is not None:
            analysis.indeksler[index_id] = result

    if TRUE_COLOR in wanted:
        analysis.gercek_renk_png = render_true_color_png(scene.bands, touched)

    return analysis
