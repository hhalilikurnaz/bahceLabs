import io
from datetime import date, timedelta

import numpy as np
import pytest
from PIL import Image
from rasterio.crs import CRS
from rasterio.transform import Affine
from rasterio.warp import transform_geom

from bahcelab_backend.domain.ndvi import indices as ix
from bahcelab_backend.domain.ndvi.models import IndexObservationModel, SceneObservationModel
from bahcelab_backend.domain.ndvi.persist import missing_outputs
from bahcelab_backend.domain.ndvi.processing import (
    MIN_VALID_RATIO,
    SceneBands,
    analyze_scene,
    colorize,
    image_corners,
    png_scale,
    scl_valid_mask,
    to_reflectance,
)
from bahcelab_backend.domain.ndvi.repository import SceneWithIndices
from bahcelab_backend.domain.ndvi.rules import build_alerts, months_back

CRS_UTM = CRS.from_epsg(32636)
X0, Y1 = 500_000.0, 4_060_000.0
SIZE = 14  # 14 × 14 piksel (10 m)
TRANSFORM = Affine(10, 0, X0, 0, -10, Y1)

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


def bands_for(ndvi=0.7, ndre=0.35, ndmi=0.2, cigreen=1.5) -> dict[str, np.ndarray]:
    """Hedef indekslerden yapay bantlar (aynı formüllerin tersi)."""

    def f(v):
        return (
            np.full((SIZE, SIZE), v, dtype=np.float32)
            if np.isscalar(v)
            else np.asarray(v, np.float32)
        )

    n, r, m, c = f(ndvi), f(ndre), f(ndmi), f(cigreen)
    nir = np.full_like(n, 0.4)
    b8a = np.full_like(n, 0.42)
    b03 = nir / (1 + c)
    return {
        "B08": nir,
        "B04": nir * (1 - n) / (1 + n),
        "B8A": b8a,
        "B05": b8a * (1 - r) / (1 + r),
        "B11": b8a * (1 - m) / (1 + m),
        "B03": b03,
        "B02": b03 * 0.5,
    }


def scene(bands=None, scl=None) -> SceneBands:
    return SceneBands(
        bands=bands or bands_for(),
        scl=scl if scl is not None else np.full((SIZE, SIZE), 4, dtype=np.uint8),
        transform=TRANSFORM,
        crs=CRS_UTM,
    )


def decode(png: bytes) -> np.ndarray:
    return np.array(Image.open(io.BytesIO(png)).convert("RGBA"))


# --- formüller
def test_ndvi_formula():
    ndvi = ix.compute_ndvi(
        np.array([0.1, 0.2, 0.0], np.float32), np.array([0.5, 0.2, 0.0], np.float32)
    )
    assert ndvi[0] == pytest.approx(0.4 / 0.6)
    assert ndvi[1] == pytest.approx(0.0)
    assert np.isnan(ndvi[2])  # payda 0


def test_msavi2_formula_and_soil_correction():
    red = np.array([0.08, 0.1, 0.3], np.float32)
    nir = np.array([0.4, 0.2, 0.3], np.float32)
    msavi = ix.compute_msavi2(red, nir)
    expected = (2 * nir + 1 - np.sqrt((2 * nir + 1) ** 2 - 8 * (nir - red))) / 2
    assert msavi == pytest.approx(expected, abs=1e-5)
    assert msavi[2] == pytest.approx(0.0, abs=1e-5)  # NIR = RED → bitki yok
    assert msavi[0] < ix.compute_ndvi(red, nir)[0]  # MSAVI, NDVI'dan temkinli


def test_ndre_ndmi_cigreen_formulas():
    assert ix.compute_ndre(np.array([0.5], np.float32), np.array([0.3], np.float32))[
        0
    ] == pytest.approx(0.25)
    assert ix.compute_ndmi(np.array([0.5], np.float32), np.array([0.3], np.float32))[
        0
    ] == pytest.approx(0.25)
    assert ix.compute_ndmi(np.array([0.2], np.float32), np.array([0.4], np.float32))[
        0
    ] == pytest.approx(-1 / 3)
    assert ix.compute_cigreen(np.array([0.4], np.float32), np.array([0.1], np.float32))[
        0
    ] == pytest.approx(3.0)
    assert np.isnan(ix.compute_cigreen(np.array([0.4], np.float32), np.array([0.0], np.float32))[0])


def test_compute_index_dispatch_uses_the_right_bands():
    bands = bands_for(ndvi=0.7, ndre=0.35, ndmi=0.2, cigreen=1.5)
    assert ix.compute_index("ndvi", bands)[0, 0] == pytest.approx(0.7, abs=1e-4)
    assert ix.compute_index("ndre", bands)[0, 0] == pytest.approx(0.35, abs=1e-4)
    assert ix.compute_index("ndmi", bands)[0, 0] == pytest.approx(0.2, abs=1e-4)
    assert ix.compute_index("cigreen", bands)[0, 0] == pytest.approx(1.5, abs=1e-4)
    assert 0 < ix.compute_index("msavi", bands)[0, 0] < 0.7


def test_bands_needed_per_output():
    assert ix.bands_needed({"ndre"}) == {
        "B04",
        "B08",
        "B05",
        "B8A",
    }  # çekirdek (bulut kararı) her zaman
    assert ix.bands_needed({"ndmi"}) == {"B04", "B08", "B8A", "B11"}
    assert ix.bands_needed({ix.TRUE_COLOR}) == {"B04", "B08", "B03", "B02"}
    assert ix.bands_needed(set(ix.ALL_OUTPUTS)) == set(ix.ALL_BANDS)


def test_reflectance_applies_offset_and_nodata():
    dn = np.array([0, 1000, 2000, 10000], dtype=np.uint16)
    refl = to_reflectance(dn, scale=0.0001, offset=-0.1)
    assert np.isnan(refl[0])
    assert refl[1] == pytest.approx(0.0, abs=1e-6)
    assert refl[2] == pytest.approx(0.1, abs=1e-6)
    with_offset = ix.compute_ndvi(
        to_reflectance(np.array([2000]), offset=-0.1), to_reflectance(np.array([4000]), offset=-0.1)
    )
    without = ix.compute_ndvi(to_reflectance(np.array([2000])), to_reflectance(np.array([4000])))
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
def test_all_indices_and_true_color_come_from_one_scene():
    result = analyze_scene(scene(), GARDEN)
    assert not result.bulutlu and result.gecerli_piksel_orani == pytest.approx(1.0)
    assert set(result.indeksler) == set(ix.INDEX_IDS)
    assert result.gercek_renk_png is not None
    expected = {"ndvi": 0.7, "ndre": 0.35, "ndmi": 0.2, "cigreen": 1.5}
    for name, value in expected.items():
        stats = result.indeksler[name]
        assert stats.ortalama == pytest.approx(value, abs=1e-3)
        assert stats.medyan == pytest.approx(value, abs=1e-3)
        assert stats.minimum == pytest.approx(value, abs=1e-3) and stats.maksimum == pytest.approx(
            value, abs=1e-3
        )
    assert (result.satir, result.sutun) == (SIZE, SIZE) and len(result.koordinatlar) == 4


def test_only_requested_outputs_are_produced():
    result = analyze_scene(scene(), GARDEN, {"ndre"})
    assert set(result.indeksler) == {"ndre"} and result.gercek_renk_png is None


def test_png_is_clipped_to_polygon_at_fine_resolution():
    """Bahçe sınırının dışına taşan piksel blokları olmamalı (kırpma ince çözünürlükte yapılır)."""
    # Poligonu piksel ızgarasına oturmayacak şekilde kaydır: yarım piksel (5 m) çapraz
    shifted = {
        "type": "Polygon",
        "coordinates": [[[x + 5, y - 5] for x, y in GARDEN_UTM["coordinates"][0]]],
    }
    geometry = transform_geom(CRS_UTM, "EPSG:4326", shifted)
    result = analyze_scene(scene(), geometry, {"ndvi"})
    png = decode(result.indeksler["ndvi"].png)

    factor = png_scale((SIZE, SIZE))
    assert png.shape[:2] == (SIZE * factor, SIZE * factor)  # keskin büyütme
    opaque = png[..., 3] > 0
    # Opak pikseller poligonun içinde: köşeler dışında kalmaz
    ys, xs = np.nonzero(opaque)
    fine = 10 / factor
    x_min, x_max = X0 + xs.min() * fine, X0 + (xs.max() + 1) * fine
    y_max, y_min = Y1 - ys.min() * fine, Y1 - (ys.max() + 1) * fine
    assert x_min >= X0 + 25 - fine and x_max <= X0 + 125 + fine
    assert y_max <= Y1 - 25 + fine and y_min >= Y1 - 125 - fine
    # Bahçe dışındaki tam piksel bloklarının hiçbiri opak değil (blok taşması yok)
    assert not opaque[: 2 * factor].any() and not opaque[13 * factor :].any()
    assert not opaque[:, : 2 * factor].any() and not opaque[:, 13 * factor :].any()
    # Sınırdaki piksel blokları poligonla kesilir: yarım piksel kayıklıkta kenar bloğunun yalnızca bir kısmı opaktır
    edge_block = opaque[2 * factor : 3 * factor, 5 * factor : 6 * factor]
    assert 0 < edge_block.sum() < edge_block.size


def test_cloud_pixels_are_transparent_and_excluded_from_stats():
    ndvi = np.full((SIZE, SIZE), 0.7, dtype=np.float32)
    ndvi[2:7, 2:12] = 0.2
    scl = np.full((SIZE, SIZE), 4, dtype=np.uint8)
    scl[2:5, 2:12] = 9  # 30 piksel bulut → geçerli oran 0,70
    result = analyze_scene(scene(bands_for(ndvi=ndvi), scl), GARDEN, {"ndvi"})
    assert not result.bulutlu and result.gecerli_piksel_orani == pytest.approx(0.7)
    factor = png_scale((SIZE, SIZE))
    assert (
        decode(result.indeksler["ndvi"].png)[2 * factor : 5 * factor, 2 * factor : 12 * factor][
            ..., 3
        ]
        == 0
    ).all()
    assert result.indeksler["ndvi"].ortalama == pytest.approx((20 * 0.2 + 50 * 0.7) / 70, abs=1e-3)


@pytest.mark.parametrize("cls", [3, 8, 9, 10])
def test_below_threshold_is_marked_cloudy_and_skipped(cls: int):
    scl = np.full((SIZE, SIZE), 4, dtype=np.uint8)
    scl[2:5, 2:12] = cls
    scl[5, 2:3] = cls  # 31 piksel → geçerli oran 0,69
    result = analyze_scene(scene(scl=scl), GARDEN)
    assert result.bulutlu and result.gecerli_piksel_orani == pytest.approx(0.69)
    assert result.indeksler == {} and result.gercek_renk_png is None
    assert MIN_VALID_RATIO == 0.70


def test_nodata_pixels_count_as_invalid():
    bands = bands_for()
    bands["B04"][2:6, 2:12] = np.nan  # 40 piksel veri yok → oran 0,60
    assert analyze_scene(scene(bands), GARDEN).bulutlu


def test_index_specific_nodata_leaves_other_indices_intact():
    bands = bands_for()
    bands["B11"][:, :] = np.nan  # SWIR yok: NDMI hesaplanamaz, diğerleri sağlam
    result = analyze_scene(scene(bands), GARDEN)
    assert "ndmi" not in result.indeksler and {"ndvi", "msavi", "ndre", "cigreen"} <= set(
        result.indeksler
    )


# --- ham ızgara
def test_grid_roundtrips_float32_with_nan_for_invalid():
    scl = np.full((SIZE, SIZE), 4, dtype=np.uint8)
    scl[2:4, 2:5] = 9  # 6 piksel bulut (oran 0,94: geçerli)
    result = analyze_scene(scene(scl=scl), GARDEN, {"ndvi"})
    grid = np.frombuffer(result.indeksler["ndvi"].grid, dtype="<f4").reshape(SIZE, SIZE)
    assert np.isnan(grid[0, 0])  # bahçe dışı
    assert np.isnan(grid[2, 2])  # bulut
    assert grid[8, 8] == pytest.approx(0.7, abs=1e-3)
    assert np.isfinite(grid[INSIDE]).sum() == 94
    assert np.isnan(grid[0, :]).all() and np.isnan(grid[:, 0]).all()


# --- renk skalaları
def test_colormaps_have_expected_character():
    values = np.array([[0.0, 0.45, 0.9]], dtype=np.float32)
    ok = np.ones((1, 3), dtype=bool)
    red, yellow, green = colorize(values, ok, 0.0, 0.9, "rdylgn")[0]
    assert (
        red[0] > 200 and red[1] < 80 and yellow[0] > 230 and yellow[1] > 200 and green[1] > green[0]
    )

    dry, wet = colorize(
        np.array([[-0.2, 0.6]], np.float32), np.ones((1, 2), bool), -0.2, 0.6, "mavi"
    )[0]
    assert dry[2] > 240 and dry[0] > 240  # çok açık
    assert wet[2] > wet[0] and wet[0] < 40  # koyu mavi (mavi tonlar)

    low, high = colorize(
        np.array([[0.0, 3.0]], np.float32), np.ones((1, 2), bool), 0.0, 3.0, "yesil"
    )[0]
    assert high[1] > high[0] and low[0] > 240  # açık sarıdan koyu yeşile

    clipped = colorize(np.array([[9.0]], np.float32), np.ones((1, 1), bool), 0.0, 0.9, "rdylgn")[
        0, 0
    ]
    assert tuple(clipped[:3]) == ix.COLORMAPS["rdylgn"][-1][1]


def test_true_color_has_no_scale_and_is_rgb_from_b04_b03_b02():
    result = analyze_scene(scene(), GARDEN, {ix.TRUE_COLOR})
    pixels = decode(result.gercek_renk_png)
    assert pixels.shape == (SIZE, SIZE, 4)
    r, g, b, a = (int(v) for v in pixels[5, 5])
    bands = bands_for()

    def expected(refl: float) -> int:
        return int(min(1.0, refl / 0.28) ** (1 / 1.3) * 255)

    assert a == 255
    assert (r, g, b) == (
        expected(bands["B04"][5, 5]),
        expected(bands["B03"][5, 5]),
        expected(bands["B02"][5, 5]),
    )
    assert g > r  # bitki yeşil bantta daha parlak
    assert pixels[0, 0][3] == 0  # bahçeden uzak pikseller saydam


# --- sorunlu bölgeler
def _field(patches) -> np.ndarray:
    field = np.full((SIZE, SIZE), 0.7, dtype=np.float32)
    for rows, cols in patches:
        field[rows, cols] = 0.5
    return field


def test_problem_zones_need_three_pixels_and_report_area():
    field = _field(
        [
            (slice(3, 5), slice(3, 5)),  # 2×2 = 4 piksel → 400 m²
            (slice(9, 10), slice(3, 5)),  # 2 piksel → elenir
            (slice(9, 10), slice(9, 10)),  # tek piksel → elenir
        ]
    )
    zones = (
        analyze_scene(scene(bands_for(ndvi=field)), GARDEN, {"ndvi"})
        .indeksler["ndvi"]
        .sorunlu_bolgeler
    )
    assert len(zones["features"]) == 1
    props = zones["features"][0]["properties"]
    assert props["piksel"] == 4 and props["alan_m2"] == pytest.approx(400.0)
    assert props["ortalama"] == pytest.approx(0.5, abs=1e-3)
    lng, lat = zones["features"][0]["geometry"]["coordinates"][0][0]
    assert 30 < lng < 40 and 35 < lat < 40


def test_zone_threshold_depends_on_the_index():
    # NDVI eşiği 0,10, NDRE eşiği 0,05
    ndre_field = np.full((SIZE, SIZE), 0.35, dtype=np.float32)
    ndre_field[3:5, 3:5] = 0.28  # 0,07 düşük: NDRE için sorunlu, NDVI eşiği için olmazdı
    result = analyze_scene(scene(bands_for(ndre=ndre_field)), GARDEN, {"ndre"})
    assert len(result.indeksler["ndre"].sorunlu_bolgeler["features"]) == 1

    ndvi_field = np.full((SIZE, SIZE), 0.7, dtype=np.float32)
    ndvi_field[3:5, 3:5] = 0.63  # 0,07 düşük: NDVI için sorunlu değil
    result = analyze_scene(scene(bands_for(ndvi=ndvi_field)), GARDEN, {"ndvi"})
    assert result.indeksler["ndvi"].sorunlu_bolgeler["features"] == []


def test_diagonal_pixels_are_not_merged():
    field = _field(
        [(slice(3, 4), slice(3, 4)), (slice(4, 5), slice(4, 5)), (slice(5, 6), slice(5, 6))]
    )
    result = analyze_scene(scene(bands_for(ndvi=field)), GARDEN, {"ndvi"})
    assert result.indeksler["ndvi"].sorunlu_bolgeler["features"] == []


def test_image_corners_order_and_extent():
    tl, tr, br, bl = image_corners(TRANSFORM, CRS_UTM, (SIZE, SIZE))
    assert tl[1] > bl[1] and tr[1] > br[1] and tr[0] > tl[0] and br[0] > bl[0]
    assert abs((tr[0] - tl[0]) * 111_320 * 0.8 - SIZE * 10) < 5


# --- eksik çıktı tespiti (eski yalnızca-NDVI kayıtları tamamlama)
def _scene_item(durum="tamam", indices=None, true_color=None, kaynak="sentinel-2"):
    scene_row = SceneObservationModel(
        tarih=date(2026, 9, 1),
        scene_id="s",
        durum=durum,
        gecerli_piksel_orani=1.0,
        gercek_renk_png_yolu=true_color,
        kaynak=kaynak,
    )
    rows = {
        name: IndexObservationModel(
            tarih=date(2026, 9, 1),
            indeks=name,
            ortalama=0.5,
            medyan=0.5,
            p10=0.4,
            p90=0.6,
            minimum=0.3,
            maksimum=0.7,
            png_yolu="p",
            veri_yolu=veri,
        )
        for name, veri in (indices or {}).items()
    }
    return SceneWithIndices(scene_row, rows)


def test_missing_outputs_for_new_old_and_complete_scenes():
    assert missing_outputs(None) == set(ix.ALL_OUTPUTS)
    assert missing_outputs(_scene_item("bulutlu")) == set()  # bulutlu: bir şey beklenmez
    legacy = _scene_item(indices={"ndvi": None})  # eski kayıt: NDVI satırı var, ham ızgara yok
    assert missing_outputs(legacy) == set(ix.ALL_OUTPUTS)
    done = _scene_item(indices={i: "k.bin" for i in ix.INDEX_IDS}, true_color="tc.png")
    assert missing_outputs(done) == set()
    partly = _scene_item(indices={"ndvi": "k.bin", "msavi": "k.bin"}, true_color="tc.png")
    assert missing_outputs(partly) == {"ndre", "ndmi", "cigreen"}


# --- uyarı kuralları
TODAY = date(2026, 10, 1)


def _series(**by_index):
    """by_index: {"ndvi": [(gün_önce, değer), ...]} → SceneWithIndices listesi"""
    days = sorted({d for series in by_index.values() for d, _ in series}, reverse=True)
    items = []
    for ago in days:
        day = TODAY - timedelta(days=ago)
        rows = {}
        for name, series in by_index.items():
            for d, value in series:
                if d == ago:
                    rows[name] = IndexObservationModel(
                        tarih=day,
                        indeks=name,
                        ortalama=value,
                        medyan=value,
                        p10=value,
                        p90=value,
                        minimum=value,
                        maksimum=value,
                        png_yolu="p",
                        veri_yolu="v",
                        sorunlu_bolge_geojson={"type": "FeatureCollection", "features": []},
                    )
        scene_row = SceneObservationModel(
            tarih=day, scene_id=f"s{ago}", durum="tamam", gecerli_piksel_orani=1.0
        )
        items.append(SceneWithIndices(scene_row, rows))
    return sorted(items, key=lambda i: i.scene.tarih)


def test_ndvi_alert_needs_more_than_ten_percent_in_window():
    alerts = build_alerts(_series(ndvi=[(17, 0.70), (0, 0.60)]))  # −%14,3
    assert [a.indeks for a in alerts] == ["ndvi"] and alerts[0].degisim_yuzde == pytest.approx(
        -14.29, abs=0.01
    )
    assert alerts[0].baslik == "NDVI düşüşü" and "%14,3" in alerts[0].mesaj
    assert build_alerts(_series(ndvi=[(17, 0.70), (0, 0.64)])) == []  # −%8,6
    assert build_alerts(_series(ndvi=[(17, 0.70), (0, 0.63)])) == []  # tam %10 eşik aşılmadı
    assert build_alerts(_series(ndvi=[(5, 0.70), (0, 0.40)])) == []  # < 10 gün
    assert build_alerts(_series(ndvi=[(40, 0.70), (0, 0.40)])) == []  # > 25 gün


def test_ndre_threshold_is_twelve_percent_and_mentions_nutrition():
    assert build_alerts(_series(ndre=[(17, 0.40), (0, 0.36)])) == []  # −%10: NDRE için yetmez
    (alert,) = build_alerts(_series(ndre=[(17, 0.40), (0, 0.34)]))  # −%15
    assert (
        alert.indeks == "ndre"
        and "besin eksikliği" in alert.mesaj
        and "yaprak kontrolü" in alert.mesaj
    )


def test_ndmi_alert_on_sharp_drop_or_below_historic_median():
    (alert,) = build_alerts(_series(ndmi=[(17, 0.30), (0, 0.22)]))  # −%26,7
    assert alert.baslik == "Olası su stresi" and "NDMI" in alert.mesaj

    history = [(d, 0.30) for d in (90, 80, 70, 60, 50, 40, 30)]
    (below,) = build_alerts(
        _series(ndmi=[*history, (0, 0.23)])
    )  # pencere yok ama medyanın 0,07 altında
    assert "medyan" in below.mesaj
    assert build_alerts(_series(ndmi=[*history, (0, 0.27)])) == []  # 0,03 altı: belirgin değil
    assert (
        build_alerts(_series(ndmi=[(17, 0.02), (0, 0.001)])) == []
    )  # taban sıfıra yakın: bağıl düşüş anlamsız


def test_alerts_priority_rises_when_indices_drop_in_the_same_area():
    items = _series(ndvi=[(17, 0.70), (0, 0.55)], ndre=[(17, 0.40), (0, 0.30)])
    zone = {
        "type": "Feature",
        "properties": {},
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [34.3830, 36.6590],
                    [34.3834, 36.6590],
                    [34.3834, 36.6594],
                    [34.3830, 36.6594],
                    [34.3830, 36.6590],
                ]
            ],
        },
    }
    for item in items[-1:]:
        for row in item.indices.values():
            row.sorunlu_bolge_geojson = {"type": "FeatureCollection", "features": [zone]}
    alerts = build_alerts(items)
    assert alerts[0].tur == "coklu_indeks" and alerts[0].oncelik == "yuksek"
    assert set(alerts[0].indeksler) == {"ndvi", "ndre"} and "saha kontrolü" in alerts[0].mesaj
    assert {a.indeks: a.oncelik for a in alerts if a.tur == "indeks_dusus"} == {
        "ndvi": "yuksek",
        "ndre": "yuksek",
    }

    # Bölgeler farklı yerlerdeyse öncelik yükselmez
    far = dict(
        zone,
        geometry={
            "type": "Polygon",
            "coordinates": [
                [
                    [34.40, 36.70],
                    [34.4004, 36.70],
                    [34.4004, 36.7004],
                    [34.40, 36.7004],
                    [34.40, 36.70],
                ]
            ],
        },
    )
    items[-1].indices["ndre"].sorunlu_bolge_geojson = {
        "type": "FeatureCollection",
        "features": [far],
    }
    separate = build_alerts(items)
    assert all(a.oncelik == "normal" for a in separate) and all(
        a.tur == "indeks_dusus" for a in separate
    )


def test_months_back():
    assert months_back(date(2026, 10, 10), 13) == date(2025, 9, 10)
    assert months_back(date(2026, 3, 31), 13) == date(2025, 2, 28)
    assert months_back(date(2026, 1, 15), 1) == date(2025, 12, 15)
