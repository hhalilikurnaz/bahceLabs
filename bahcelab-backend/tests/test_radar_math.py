import numpy as np
import pytest

from bahcelab_backend.domain.imagery import radar_math as rm


def test_db_conversion_roundtrip_and_known_values() -> None:
    assert rm.to_db(1.0) == pytest.approx(0.0)
    assert rm.to_db(0.1) == pytest.approx(-10.0)
    assert rm.to_db(0.01) == pytest.approx(-20.0)
    assert rm.from_db(-3.0) == pytest.approx(0.5011872, rel=1e-6)
    x = np.array([0.001, 0.05, 0.9, 3.0])
    assert np.allclose(rm.from_db(rm.to_db(x)), x)


def test_non_positive_values_have_no_db() -> None:
    out = rm.to_db(np.array([0.0, -0.1, 0.5]))
    assert np.isnan(out[0]) and np.isnan(out[1]) and out[2] == pytest.approx(-3.0103, abs=1e-3)


def test_rvi_is_linear_scale_formula() -> None:
    assert rm.rvi(np.array([0.05]), np.array([0.2]))[0] == pytest.approx(4 * 0.05 / 0.25)
    assert rm.rvi(np.array([0.1]), np.array([0.1]))[0] == pytest.approx(2.0)  # VH=VV → 2
    assert np.isnan(rm.rvi(np.array([0.0]), np.array([0.0]))[0])


def test_ratio_is_the_db_difference() -> None:
    vh, vv = np.array([0.02]), np.array([0.1])
    assert rm.ratio_db(vh, vv)[0] == pytest.approx(rm.to_db(vh)[0] - rm.to_db(vv)[0])
    assert rm.ratio_db(vh, vv)[0] == pytest.approx(10 * np.log10(0.2))


def test_log_ratio_sign_and_size() -> None:
    assert rm.log_ratio_db(np.array([0.02]), np.array([0.01]))[0] == pytest.approx(3.0103, abs=1e-3)
    assert rm.log_ratio_db(np.array([0.005]), np.array([0.01]))[0] < 0
    assert rm.log_ratio_db(np.array([0.01]), np.array([0.01]))[0] == pytest.approx(0.0)
    assert np.isnan(rm.log_ratio_db(np.array([0.0]), np.array([0.01]))[0])


def test_valid_mask_drops_nodata_shadow_and_overlay() -> None:
    vh = np.array([0.01, rm.RADAR_NODATA, 0.0001, 0.02, np.nan])  # −20 dB · nodata · −40 dB (gölge) · −17 dB · NaN
    vv = np.array([0.1, 0.1, 0.1, 5.0, 0.1])  # …· +7 dB (üst üste binme)
    mask = rm.valid_mask(vh, vv, shadow_vh_db=-30.0, overlay_vv_db=5.0)
    assert mask.tolist() == [True, False, False, False, False]


def test_lee_filter_reduces_speckle_variance_and_keeps_the_mean() -> None:
    rng = np.random.default_rng(1)
    truth = np.full((60, 60), 0.05)
    speckle = rng.gamma(shape=4.4, scale=1 / 4.4, size=truth.shape)  # çarpımsal kumlanma (ENL 4,4)
    noisy = truth * speckle
    valid = np.ones_like(noisy, dtype=bool)
    out = rm.lee_filter(noisy, valid, size=5, looks=4.4)
    assert out.std() < 0.6 * noisy.std()
    assert out.mean() == pytest.approx(noisy.mean(), rel=0.03)


def test_lee_filter_keeps_edges_better_than_a_box_filter_and_ignores_invalid_pixels() -> None:
    img = np.full((40, 40), 0.02)
    img[:, 20:] = 0.2
    valid = np.ones_like(img, dtype=bool)
    valid[5, 5] = False
    out = rm.lee_filter(img, valid)
    assert np.isnan(out[5, 5])
    assert out[10, 10] == pytest.approx(0.02, rel=1e-6) and out[10, 30] == pytest.approx(0.2, rel=1e-6)
    box = float(np.mean(img[8:13, 17:22]))
    assert abs(out[10, 19] - 0.02) < abs(box - 0.02)  # kenarda kutu ortalamasından daha az bulanık


def test_radar_stats_use_raw_linear_mean_not_the_mean_of_db() -> None:
    from bahcelab_backend.domain.imagery.radar_indicators import radar_stats

    vh = np.array([[0.01, 0.1]])  # −20 dB ve −10 dB
    vv = np.array([[0.1, 0.1]])
    mask = np.ones_like(vh, dtype=bool)
    stats = radar_stats(vh, vv, mask, mask)
    assert stats["vh_db"].ortalama == pytest.approx(10 * np.log10(0.055))  # ≈ −12,6 dB, dB ortalaması (−15) DEĞİL
    assert stats["vh_db"].ortalama != pytest.approx(-15.0, abs=0.5)
    assert stats["oran_db"].ortalama == pytest.approx(10 * np.log10(0.055 / 0.1))
    assert stats["rvi"].ortalama == pytest.approx(4 * 0.055 / (0.1 + 0.055))
    assert stats["vh_db"].gecerli_piksel == 2 and radar_stats(vh, vv, ~mask, mask) == {}


def test_radar_grids_are_filtered_but_stats_see_the_raw_pixels() -> None:
    from bahcelab_backend.domain.imagery.radar_indicators import radar_grids, radar_stats

    rng = np.random.default_rng(3)
    vh = 0.02 * rng.gamma(4.4, 1 / 4.4, size=(40, 40))
    vv = 0.1 * rng.gamma(4.4, 1 / 4.4, size=(40, 40))
    valid = np.ones_like(vh, dtype=bool)
    grids = radar_grids(vh, vv, valid)
    assert set(grids) == set(rm.INDICATORS) and np.nanstd(grids["vh_db"]) < np.nanstd(rm.to_db(vh))
    stats = radar_stats(vh, vv, valid, valid)
    assert stats["vh_db"].p10 < stats["vh_db"].medyan < stats["vh_db"].p90 and stats["vh_db"].minimum < stats["vh_db"].p10
