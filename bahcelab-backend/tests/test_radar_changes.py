from datetime import date, timedelta

import numpy as np
import pytest

from bahcelab_backend.domain.acquisitions import radar_changes as rc

RULE = rc.ChangeRule(anlamli_degisim_db=2.0, anlamli_alan_orani=0.10, baseline_sahne=3, art_arda_sahne=2)
BAND = rc.BandLimits(alt=-17.0, ust=-12.0)
WIDE = rc.BandLimits(alt=-22.0, ust=-8.0)  # düşüş bandın İÇİNDE kalır
BASE = date(2024, 5, 1)


def scene(i: int, level_db: float, *, band: rc.BandLimits | None = BAND, area: float = 1.0, noise: float = 0.0) -> rc.SceneSample:
    """level_db: bahçenin `area` payındaki piksellerin düzeyi; kalanı −15 dB (değişmeyen kesim)."""
    rng = np.random.default_rng(i)
    grid = np.full((20, 20), -15.0) + rng.normal(0, noise, (20, 20))
    cut = int(round(area * 20))
    grid[:, :cut] = level_db + rng.normal(0, noise, (20, cut))
    return rc.SceneSample(BASE + timedelta(days=12 * i), f"S{i}", grid, float(np.nanmean(grid)), band)


def series(levels: list[float], **kw) -> list[rc.SceneSample]:
    return [scene(i, v, **kw) for i, v in enumerate(levels)]


def test_a_single_scene_jump_is_noise_not_a_candidate() -> None:
    out = rc.evaluate_series(series([-15, -15, -15, -15, -19.5, -15, -15, -15], band=WIDE), RULE)  # tek sahne −4,5 dB, bant içi
    assert [(r.durum, r.isaret) for r in out if r.scene_id == "S4"] == [(rc.GURULTU, rc.AZALIS)]
    assert all(r.durum != rc.ADAY for r in out)


def test_two_consecutive_drops_make_a_candidate_on_the_second_scene() -> None:
    out = rc.evaluate_series(series([-15, -15, -15, -15, -19.5, -19.5, -19.5, -19.5], band=WIDE), RULE)
    by = {r.scene_id: r for r in out}
    assert by["S4"].durum == rc.GURULTU and by["S5"].durum == rc.ADAY and by["S5"].art_arda
    assert "S6" not in by  # üçüncü sahnede baseline düşmüş düzeye gelir: yeni ani değişim yok
    assert by["S5"].buyukluk_db == pytest.approx(-4.5, abs=0.01) and by["S5"].alan_orani == pytest.approx(1.0)


def test_a_single_drop_below_the_months_band_is_a_candidate_by_persistent_deviation() -> None:
    out = rc.evaluate_series(series([-15, -15, -15, -15, -19.5, -19.5]), RULE)
    assert {r.scene_id: r.durum for r in out}["S4"] == rc.ADAY  # ortalama −19,5 < bant alt sınırı −17
    assert next(r for r in out if r.scene_id == "S4").kalici_sapma == rc.BANT_ALTI


def test_gradual_seasonal_decline_inside_the_band_produces_nothing() -> None:
    levels = [-12.5 - 0.6 * i for i in range(8)]  # her adım < 2 dB, hepsi bant içinde
    assert rc.evaluate_series([scene(i, v, band=rc.BandLimits(-20, -10)) for i, v in enumerate(levels)], RULE) == []


def test_a_jump_inside_the_band_with_no_follow_up_is_noise() -> None:
    wide = rc.BandLimits(-22.0, -8.0)
    out = rc.evaluate_series(series([-15, -15, -15, -15, -18.0, -15, -15], band=wide), RULE)
    assert [(r.durum, r.kalici_sapma) for r in out] == [(rc.GURULTU, rc.BANT_ICI)]


def test_area_share_threshold_small_patches_do_not_count() -> None:
    small = rc.evaluate_series(series([-15, -15, -15, -15, -21, -21], area=0.05), RULE)  # alanın %5'i: eşik %10
    assert small == []
    enough = rc.evaluate_series(series([-15, -15, -15, -15, -21, -21], area=0.3), RULE)
    assert enough and enough[0].alan_orani == pytest.approx(0.3, abs=0.06)


def test_increase_is_detected_with_its_own_sign_and_needs_bands_upper_edge() -> None:
    out = rc.evaluate_series(series([-15, -15, -15, -15, -9.0, -15]), RULE)
    assert out[0].isaret == rc.ARTIS and out[0].durum == rc.ADAY and out[0].kalici_sapma == rc.BANT_USTU


def test_no_band_means_only_consecutive_scenes_can_confirm() -> None:
    out = rc.evaluate_series(series([-15, -15, -15, -15, -20, -15, -15], band=None), RULE)
    assert [(r.durum, r.kalici_sapma) for r in out] == [(rc.GURULTU, rc.BANT_YOK)]


def test_too_short_history_gives_no_result() -> None:
    assert rc.evaluate_series(series([-15, -15, -25]), RULE) == []


def test_wet_note_needs_known_rain_and_never_invents_it() -> None:
    assert rc.wet_note([0.0, 4.2, 0.3], 1.0) == (True, 4.5)
    assert rc.wet_note([0.0, 0.2, None], 1.0) == (False, 0.2)
    assert rc.wet_note([None, None], 1.0) == (None, None)


def test_smoothing_removes_isolated_noise_pixels_but_keeps_a_real_patch() -> None:
    rng = np.random.default_rng(5)
    base = np.full((30, 30), -15.0)
    noisy = base + rng.normal(0, 2.0, base.shape)  # piksel gürültüsü tek başına |Δ| ≥ 2 dB üretir
    assert rc.pixel_change(noisy, base, rc.ChangeRule(2.0, 0.10, 3, 2, 1)) is not None  # yumuşatma kapalı: sahte «anlamlı»
    assert rc.pixel_change(noisy, base, rc.ChangeRule(2.0, 0.10, 3, 2, 3)) is None  # yumuşatma açık: gürültü elenir
    patch = base.copy()
    patch[5:20, 5:20] -= 4.0
    sign, share, size, _ = rc.pixel_change(patch, base, rc.ChangeRule(2.0, 0.10, 3, 2, 3))  # type: ignore[misc]
    assert sign == rc.AZALIS and share > 0.2 and size == pytest.approx(-4.0, abs=0.3)
    assert np.isnan(rc.smooth_delta(np.array([[np.nan, 1.0], [1.0, 1.0]]), 3)[0, 0])


# ----------------------------------------------------------------------------- alan kuralı: pay (%25) VEYA mutlak alan (≥ 2 da)
BASE_RULE = dict(anlamli_degisim_db=2.0, anlamli_alan_orani=0.25, baseline_sahne=3, art_arda_sahne=2, yumusatma=1)


def patch(rows: int, cols: int, patch_px: int) -> tuple[np.ndarray, np.ndarray]:
    base = np.full((rows, cols), -15.0)
    cur = base.copy()
    cur.reshape(-1)[:patch_px] -= 4.0  # tam piksel sayısı kadar düşüş
    return cur, base


def test_small_garden_needs_the_quarter_share_because_two_decares_would_be_most_of_it() -> None:
    rule = rc.ChangeRule(**BASE_RULE, alan_min_m2=2000.0, birlesim="veya")  # 8×10 = 80 piksel = 8 da
    cur, base = patch(8, 10, 16)  # 1,6 da, %20
    assert rc.pixel_change(cur, base, rule) is None
    cur, base = patch(8, 10, 21)  # 2,1 da, %26
    assert rc.pixel_change(cur, base, rule) is not None


def test_large_garden_is_decided_by_the_absolute_area_not_the_share() -> None:
    rule = rc.ChangeRule(**BASE_RULE, alan_min_m2=2000.0, birlesim="veya")  # 30×40 = 1200 piksel = 120 da
    cur, base = patch(30, 40, 36)  # %3 ama 3,6 da
    result = rc.pixel_change(cur, base, rule)
    assert result is not None and result[3] == 36
    cur, base = patch(30, 40, 12)  # %1 ve 1,2 da
    assert rc.pixel_change(cur, base, rule) is None


def test_and_mode_needs_both_share_and_absolute_area() -> None:
    rule = rc.ChangeRule(**BASE_RULE, alan_min_m2=2000.0, birlesim="ve")
    cur, base = patch(30, 40, 36)
    assert rc.pixel_change(cur, base, rule) is None  # %3 < %25
    cur, base = patch(30, 40, 400)  # %33 ve 40 da
    assert rc.pixel_change(cur, base, rule) is not None


def test_wet_candidates_have_low_confidence_and_dry_or_unknown_do_not() -> None:
    assert rc.event_confidence(rc.ADAY, True) == "dusuk"
    assert rc.event_confidence(rc.ADAY, False) == "normal"
    assert rc.event_confidence(rc.ADAY, None) == "normal"  # bilinmiyor: güven düşürülmez, not da yok
    assert rc.event_confidence(rc.GURULTU, True) == "normal"
