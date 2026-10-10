import io
from datetime import date, timedelta

import numpy as np
import pytest
from PIL import Image
from rasterio.crs import CRS
from rasterio.transform import Affine
from rasterio.warp import transform_geom

from bahcelab_backend.domain.ndvi.models import NdviObservationModel
from bahcelab_backend.domain.ndvi.processing import (
    COLOR_STOPS,
    MIN_VALID_RATIO,
    SceneData,
    analyze_scene,
    colorize,
    compute_ndvi,
    image_corners,
    scl_valid_mask,
    to_reflectance,
)
from bahcelab_backend.domain.ndvi.rules import drop_alert, months_back

CRS_UTM = CRS.from_epsg(32636)
X0, Y1 = 500_000.0, 4_060_000.0
SIZE = 14  # 14 × 14 piksel (10 m)
TRANSFORM = Affine(10, 0, X0, 0, -10, Y1)
NIR = 0.4

# Bahçe: ızgarada 2..11. satır/sütun = tam 10 × 10 = 100 piksel (1 hektar = 10 dekar)
GARDEN_UTM = {
    "type": "Polygon",
    "coordinates": [
        [
            [X0 + 20, Y1 - 20],
            [X0 + 120, Y1 - 20],
            [X0 + 120, Y1 - 120],
            [X0 + 20, Y1 - 120],
            [X0 + 20, Y1 - 20],
        ]
    ],
}
GARDEN = transform_geom(CRS_UTM, "EPSG:4326", GARDEN_UTM)
INSIDE = (slice(2, 12), slice(2, 12))


def scene(ndvi: np.ndarray | float, scl: np.ndarray | None = None) -> SceneData:
    field = np.full((SIZE, SIZE), ndvi, dtype=np.float32) if np.isscalar(ndvi) else ndvi
    red = (NIR * (1 - field) / (1 + field)).astype(np.float32)
    return SceneData(
        red=red,
        nir=np.full_like(red, NIR),
        scl=scl if scl is not None else np.full((SIZE, SIZE), 4, dtype=np.uint8),
        transform=TRANSFORM,
        crs=CRS_UTM,
    )


def decode(png: bytes) -> np.ndarray:
    return np.array(Image.open(io.BytesIO(png)).convert("RGBA"))


# --- NDVI hesabı ve reflektans
def test_compute_ndvi_formula():
    ndvi = compute_ndvi(
        np.array([0.1, 0.2, 0.0], dtype=np.float32), np.array([0.5, 0.2, 0.0], dtype=np.float32)
    )
    assert ndvi[0] == pytest.approx((0.5 - 0.1) / (0.5 + 0.1))
    assert ndvi[1] == pytest.approx(0.0)
    assert np.isnan(ndvi[2])  # payda 0


def test_reflectance_applies_offset_and_nodata():
    dn = np.array([0, 1000, 2000, 10000], dtype=np.uint16)
    refl = to_reflectance(dn, scale=0.0001, offset=-0.1)
    assert np.isnan(refl[0])  # nodata
    assert refl[1] == pytest.approx(0.0, abs=1e-6)
    assert refl[2] == pytest.approx(0.1, abs=1e-6)
    assert refl[3] == pytest.approx(0.9, abs=1e-6)
    # offset atlanırsa NDVI sapar: aynı DN'lerle (4000, 2000)
    with_offset = compute_ndvi(
        to_reflectance(np.array([2000]), offset=-0.1), to_reflectance(np.array([4000]), offset=-0.1)
    )
    without = compute_ndvi(to_reflectance(np.array([2000])), to_reflectance(np.array([4000])))
    assert with_offset[0] == pytest.approx(0.5)
    assert without[0] == pytest.approx(1 / 3, abs=1e-3)


# --- SCL maskeleme
@pytest.mark.parametrize("cls", [3, 8, 9, 10])
def test_scl_masks_cloud_classes(cls: int):
    assert not scl_valid_mask(np.array([cls], dtype=np.uint8))[0]


@pytest.mark.parametrize("cls", [4, 5, 6, 7, 11])
def test_scl_keeps_other_classes(cls: int):
    assert scl_valid_mask(np.array([cls], dtype=np.uint8))[0]


# --- sahne analizi
def test_clear_scene_statistics_and_png():
    result = analyze_scene(scene(0.7), GARDEN)
    assert not result.bulutlu
    assert result.gecerli_piksel_orani == pytest.approx(1.0)
    assert result.ortalama == pytest.approx(0.7, abs=1e-4)
    assert result.medyan == pytest.approx(0.7, abs=1e-4)
    assert result.p10 == pytest.approx(0.7, abs=1e-4) and result.p90 == pytest.approx(0.7, abs=1e-4)
    assert result.minimum == pytest.approx(0.7, abs=1e-4) and result.maksimum == pytest.approx(
        0.7, abs=1e-4
    )

    pixels = decode(result.png)
    assert pixels.shape == (SIZE, SIZE, 4)  # 10 m pikseller korunur, yeniden örnekleme yok
    assert (pixels[INSIDE][..., 3] == 255).all()  # bahçe içi opak
    outside = np.ones((SIZE, SIZE), dtype=bool)
    outside[INSIDE] = False
    assert (pixels[outside][..., 3] == 0).all()  # bahçe dışı saydam


def test_cloud_pixels_are_transparent_and_excluded_from_stats():
    ndvi = np.full((SIZE, SIZE), 0.7, dtype=np.float32)
    ndvi[2:7, 2:12] = 0.2  # üst yarı (50 piksel) bulutlu olacak ve değeri yanıltıcı
    scl = np.full((SIZE, SIZE), 4, dtype=np.uint8)
    scl[2:5, 2:12] = 9  # 30 piksel bulut → geçerli oran 0,70
    scl[5:7, 2:12] = 4
    result = analyze_scene(scene(ndvi, scl), GARDEN)
    assert not result.bulutlu
    assert result.gecerli_piksel_orani == pytest.approx(0.7)
    assert (decode(result.png)[2:5, 2:12][..., 3] == 0).all()
    # Bulutlu 30 piksel istatistiğe girmez; kalan 70'in 20'si 0,2, 50'si 0,7
    assert result.ortalama == pytest.approx((20 * 0.2 + 50 * 0.7) / 70, abs=1e-3)


@pytest.mark.parametrize("cls", [3, 8, 9, 10])
def test_below_threshold_is_marked_cloudy_and_skipped(cls: int):
    scl = np.full((SIZE, SIZE), 4, dtype=np.uint8)
    scl[2:5, 2:12] = cls  # 30 piksel
    scl[5, 2:3] = cls  # +1 → geçerli oran 0,69
    result = analyze_scene(scene(0.7, scl), GARDEN)
    assert result.bulutlu
    assert result.gecerli_piksel_orani == pytest.approx(0.69)
    assert result.png is None and result.ortalama is None and result.sorunlu_bolgeler is None
    assert MIN_VALID_RATIO == 0.70


def test_clouds_outside_garden_do_not_matter():
    scl = np.full((SIZE, SIZE), 9, dtype=np.uint8)
    scl[INSIDE] = 4
    result = analyze_scene(scene(0.6, scl), GARDEN)
    assert not result.bulutlu and result.gecerli_piksel_orani == pytest.approx(1.0)


def test_nodata_pixels_count_as_invalid():
    sc = scene(0.7)
    sc.red[2:6, 2:12] = np.nan  # 40 piksel veri yok → oran 0,60
    assert analyze_scene(sc, GARDEN).bulutlu


# --- renk skalası
def test_colormap_red_yellow_green():
    colors = colorize(
        np.array([[0.0, 0.5, 0.9, 1.5]], dtype=np.float32), np.ones((1, 4), dtype=bool)
    )
    red, yellow, green, clipped = colors[0]
    assert tuple(red[:3]) == COLOR_STOPS[0][1] and red[0] > 200 and red[1] < 80
    assert yellow[0] > 230 and yellow[1] > 200  # sarı
    assert green[1] > green[0] and green[1] > 120  # yeşil
    assert tuple(clipped[:3]) == COLOR_STOPS[-1][1]  # 0,9 üstü tavana kırpılır


# --- sorunlu bölgeler
def _field_with(patches: list[tuple[slice, slice]]) -> np.ndarray:
    field = np.full((SIZE, SIZE), 0.7, dtype=np.float32)
    for rows, cols in patches:
        field[rows, cols] = 0.5
    return field


def test_problem_zones_need_three_pixels_and_report_area():
    field = _field_with(
        [
            (slice(3, 5), slice(3, 5)),  # 2×2 = 4 piksel → 400 m²
            (slice(9, 10), slice(3, 5)),  # 1×2 = 2 piksel → elenir
            (slice(9, 10), slice(9, 10)),  # tek piksel → elenir
        ]
    )
    zones = analyze_scene(scene(field), GARDEN).sorunlu_bolgeler
    assert len(zones["features"]) == 1
    props = zones["features"][0]["properties"]
    assert props["piksel"] == 4 and props["alan_m2"] == pytest.approx(400.0)
    assert props["ortalama_ndvi"] == pytest.approx(0.5, abs=1e-3)
    lng, lat = zones["features"][0]["geometry"]["coordinates"][0][0]
    assert 30 < lng < 40 and 35 < lat < 40  # EPSG:4326'ya çevrilmiş


def test_three_pixel_cluster_is_included_but_diagonal_pixels_are_not_merged():
    l_shape = _field_with([(slice(3, 5), slice(3, 4)), (slice(4, 5), slice(4, 5))])  # L: 3 piksel
    assert len(analyze_scene(scene(l_shape), GARDEN).sorunlu_bolgeler["features"]) == 1

    diagonal = _field_with(
        [(slice(3, 4), slice(3, 4)), (slice(4, 5), slice(4, 5)), (slice(5, 6), slice(5, 6))]
    )
    assert (
        analyze_scene(scene(diagonal), GARDEN).sorunlu_bolgeler["features"] == []
    )  # 4-komşuluk: ayrı tekler


def test_uniform_field_has_no_problem_zones():
    assert analyze_scene(scene(0.7), GARDEN).sorunlu_bolgeler["features"] == []


def test_zone_threshold_is_ten_hundredths_below_median():
    field = _field_with([])
    field[3:5, 3:5] = 0.61  # medyan 0,70'in 0,09 altı → sorunlu değil
    assert analyze_scene(scene(field), GARDEN).sorunlu_bolgeler["features"] == []
    field[3:5, 3:5] = 0.59  # 0,11 altı → sorunlu
    assert len(analyze_scene(scene(field), GARDEN).sorunlu_bolgeler["features"]) == 1


def test_image_corners_order_and_extent():
    corners = image_corners(TRANSFORM, CRS_UTM, (SIZE, SIZE))
    tl, tr, br, bl = corners
    assert tl[1] > bl[1] and tr[1] > br[1]  # üst köşeler daha kuzeyde
    assert tr[0] > tl[0] and br[0] > bl[0]  # sağ köşeler daha doğuda
    assert abs((tr[0] - tl[0]) * 111_320 * 0.8 - SIZE * 10) < 5  # ≈ 140 m genişlik


# --- uyarı kuralı
def obs(day: date, mean: float | None, durum: str = "tamam") -> NdviObservationModel:
    return NdviObservationModel(
        tarih=day, scene_id=f"s-{day}", durum=durum, ortalama=mean, gecerli_piksel_orani=1.0
    )


TODAY = date(2026, 10, 1)


def test_alert_when_drop_exceeds_ten_percent_vs_10_to_25_days_earlier():
    alert = drop_alert([obs(TODAY - timedelta(days=17), 0.70), obs(TODAY, 0.60)])  # −%14,3
    assert alert and alert.tur == "ndvi_dusus"
    assert alert.degisim_yuzde == pytest.approx(-14.29, abs=0.01)
    assert alert.onceki_tarih == TODAY - timedelta(days=17) and alert.son_tarih == TODAY
    assert "%14,3" in alert.mesaj and "0,70" in alert.mesaj and "0,60" in alert.mesaj


def test_no_alert_for_small_drop_or_no_comparison_image():
    assert drop_alert([obs(TODAY - timedelta(days=17), 0.70), obs(TODAY, 0.64)]) is None  # −%8,6
    assert (
        drop_alert([obs(TODAY - timedelta(days=17), 0.70), obs(TODAY, 0.63)]) is None
    )  # tam %10: eşik aşılmadı
    assert drop_alert([obs(TODAY - timedelta(days=5), 0.70), obs(TODAY, 0.40)]) is None  # < 10 gün
    assert drop_alert([obs(TODAY - timedelta(days=40), 0.70), obs(TODAY, 0.40)]) is None  # > 25 gün
    assert drop_alert([obs(TODAY, 0.5)]) is None


def test_alert_ignores_cloudy_observations_and_uses_latest_valid():
    series = [
        obs(TODAY - timedelta(days=20), 0.72),
        obs(TODAY - timedelta(days=12), 0.71),  # aralıktaki en yeni geçerli
        obs(TODAY - timedelta(days=3), None, "bulutlu"),
        obs(TODAY - timedelta(days=1), 0.60),  # son geçerli
        obs(TODAY, None, "bulutlu"),  # en yeni ama bulutlu: sayılmaz
    ]
    alert = drop_alert(series)
    assert alert and alert.son_tarih == TODAY - timedelta(days=1)
    assert alert.onceki_tarih == TODAY - timedelta(days=12)


def test_months_back():
    assert months_back(date(2026, 10, 10), 13) == date(2025, 9, 10)
    assert months_back(date(2026, 3, 31), 13) == date(2025, 2, 28)
    assert months_back(date(2026, 1, 15), 1) == date(2025, 12, 15)
