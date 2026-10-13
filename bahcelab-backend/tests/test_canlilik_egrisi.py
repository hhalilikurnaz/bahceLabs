"""Kesintisiz canlılık eğrisi (ADR 0018): ağırlıklı Whittaker, belirsizlik bandı, tahmini işareti, ekstrapolasyon sınırı ve radar boşluk işaretleri — saf fonksiyonlar."""

from datetime import date, timedelta

import numpy as np
import pytest

from bahcelab_backend.domain.agro.catalog import load_catalog
from bahcelab_backend.domain.series import curve as cv

RULE = load_catalog().egri
D0 = date(2025, 1, 1)


def obs(offset: int, value: float, weight: float = 1.0, source: str = "s2") -> cv.Obs:
    return cv.Obs(D0 + timedelta(days=offset), value, weight, source)


def test_a_flat_series_gives_a_flat_curve_with_a_narrow_band_at_observations() -> None:
    series = [obs(i * 5, 0.70) for i in range(20)]
    points, sigma = cv.build_curve(series, D0, D0 + timedelta(days=95), RULE)
    assert len(points) == 96 and all(abs(p.deger - 0.70) < 0.005 for p in points) and sigma == RULE.sigma_taban
    at_obs = next(p for p in points if p.tarih == D0 + timedelta(days=50))
    assert not at_obs.tahmini and at_obs.ust - at_obs.alt == pytest.approx(2 * RULE.belirsizlik_z * RULE.sigma_taban, rel=0.05)


def test_the_curve_bridges_a_gap_and_marks_far_days_as_estimated_with_a_widening_band() -> None:
    series = [obs(i * 4, 0.60 + 0.002 * i * 4) for i in range(8)] + [obs(60 + i * 4, 0.60 + 0.002 * (60 + i * 4)) for i in range(8)]  # 28–60. günler arası 32 günlük boşluk
    points, _ = cv.build_curve(series, D0, D0 + timedelta(days=92), RULE)
    by = {p.tarih: p for p in points}
    mid = by[D0 + timedelta(days=44)]
    assert mid.tahmini and by[D0 + timedelta(days=8)].tahmini is False
    assert 0.64 < mid.deger < 0.74  # doğrusal gidişle uyumlu doldurma (≈ 0,688)
    near, far = by[D0 + timedelta(days=30)], by[D0 + timedelta(days=44)]
    assert (far.ust - far.alt) > 1.5 * (near.ust - near.alt)  # gözleme uzaklaştıkça bant genişler


def test_weights_decide_which_observation_the_curve_trusts() -> None:
    base = [obs(i * 3, 0.70) for i in range(15)]
    outlier_trusted = [*base[:7], obs(21, 0.30, 1.0), *base[8:]]
    outlier_doubted = [*base[:7], obs(21, 0.30, 0.02), *base[8:]]
    low, _ = cv.build_curve(outlier_trusted, D0, D0 + timedelta(days=42), RULE)
    ok, _ = cv.build_curve(outlier_doubted, D0, D0 + timedelta(days=42), RULE)
    at = D0 + timedelta(days=21)
    assert next(p for p in low if p.tarih == at).deger < next(p for p in ok if p.tarih == at).deger - 0.05
    assert next(p for p in ok if p.tarih == at).deger > 0.66  # düşük güvenli (bulutlu) gözlem eğriyi bozmaz


def test_same_day_observations_are_combined_and_zero_weight_or_nan_is_dropped() -> None:
    merged = cv.combine_by_day([obs(0, 0.60, 1.0), obs(0, 0.70, 1.0, "hls"), obs(1, 0.5, 0.0), obs(2, float("nan"), 1.0)])
    assert merged == {D0: (pytest.approx(0.65), 1.0)}


def test_fewer_than_three_observations_gives_no_curve_instead_of_a_made_up_one() -> None:
    assert cv.build_curve([obs(0, 0.7), obs(10, 0.7)], D0, D0 + timedelta(days=20), RULE) == ([], 0.0)


def test_extrapolation_after_the_last_observation_is_limited_and_always_estimated() -> None:
    series = [obs(i * 5, 0.70) for i in range(10)]  # son gözlem 45. gün
    points, _ = cv.build_curve(series, D0, D0 + timedelta(days=200), RULE)
    assert points[-1].tarih == D0 + timedelta(days=45 + RULE.ekstrapolasyon_azami_gun) and points[-1].tahmini
    assert next(p for p in points if p.tarih == D0 + timedelta(days=45)).tahmini is False


def test_whittaker_with_a_large_lambda_is_smoother_than_with_a_small_one() -> None:
    rng = np.random.default_rng(1)
    y = 0.7 + rng.normal(0, 0.03, 200)
    w = np.ones(200)
    rough, smooth = cv.whittaker(y, w, 1.0), cv.whittaker(y, w, 2000.0)
    assert float(np.abs(np.diff(smooth, 2)).mean()) < float(np.abs(np.diff(rough, 2)).mean()) / 10


def test_radar_marks_appear_only_inside_optical_gaps_and_never_carry_a_value() -> None:
    optical = [D0, D0 + timedelta(days=5), D0 + timedelta(days=40)]  # 5–40: 35 günlük boşluk
    radar = [D0 + timedelta(days=d) for d in (2, 12, 24, 30, 38, 41)]
    marks = cv.radar_marks(radar, {D0 + timedelta(days=24)}, optical, D0 + timedelta(days=50), RULE)
    assert [(m.tarih - D0).days for m in marks] == [12, 24, 30, 38]  # boşluk içindekiler; optik gözlem varken (2) ve son gözlemden sonra kısa süre (41) yok
    assert [m.degisim for m in marks] == [False, True, False, False] and not hasattr(marks[0], "deger")
    assert cv.radar_marks(radar, set(), optical, D0 + timedelta(days=60), RULE)[-1].tarih == D0 + timedelta(days=41)  # son gözlemden beri boşluk uzadı
