"""Normal bantlar (SAF): yüzdelikler, asgari yıl şartları, hariç yıllar, eksik ay."""

import numpy as np
import pytest

from bahcelab_backend.domain.acquisitions.normal_bands import (
    BandThresholds,
    compute_normal_bands,
    position_in_band,
)

TH = BandThresholds(min_years_quartile=5, min_years_decile=8)


def series(year_values: dict[int, float], month: int = 6) -> dict[int, dict[int, float]]:
    return {y: {month: v} for y, v in year_values.items()}


def test_percentiles_with_enough_years() -> None:
    vals = {2015 + i: 0.50 + 0.01 * i for i in range(10)}  # 10 yıl
    band = compute_normal_bands(series(vals), allowed_years=None, first_year=2015, last_year=2025, thresholds=TH)[5]
    arr = np.array(list(vals.values()))
    assert band.yil_sayisi == 10 and band.ceyrek_yeterli and band.onluk_yeterli
    assert band.p50 == pytest.approx(np.percentile(arr, 50)) and band.p10 == pytest.approx(np.percentile(arr, 10)) and band.p90 == pytest.approx(np.percentile(arr, 90))


def test_quartile_needs_five_years_and_decile_needs_eight() -> None:
    four = compute_normal_bands(series({2016 + i: 0.5 for i in range(4)}), allowed_years=None, first_year=2015, last_year=2025, thresholds=TH)[5]
    assert not four.ceyrek_yeterli and four.p25 is None and four.p50 is None  # «yetersiz geçmiş»
    six = compute_normal_bands(series({2016 + i: 0.5 + i * 0.01 for i in range(6)}), allowed_years=None, first_year=2015, last_year=2025, thresholds=TH)[5]
    assert six.ceyrek_yeterli and six.p25 is not None and not six.onluk_yeterli and six.p10 is None and six.p90 is None


def test_excluded_and_out_of_range_years_do_not_enter_the_band() -> None:
    vals = {2015 + i: 0.5 for i in range(11)}
    vals[2020] = 5.0  # uyumsuz yıl: banda girmemeli
    vals[2026] = 9.0  # aralık dışı (cari yıl)
    band = compute_normal_bands(series(vals), allowed_years=set(range(2015, 2026)) - {2020}, first_year=2015, last_year=2025, thresholds=TH)[5]
    assert 2020 not in band.yillar and 2026 not in band.yillar and band.yil_sayisi == 10 and band.p90 == pytest.approx(0.5)


def test_missing_months_stay_missing() -> None:
    bands = compute_normal_bands(series({2015 + i: 0.5 for i in range(10)}, month=6), allowed_years=None, first_year=2015, last_year=2025, thresholds=TH)
    assert bands[0].yil_sayisi == 0 and bands[0].p50 is None and bands[5].yil_sayisi == 10  # ocak verisi yok → uydurulmaz


def test_value_position_relative_to_the_band() -> None:
    band = compute_normal_bands(series({2015 + i: 0.50 + 0.01 * i for i in range(10)}), allowed_years=None, first_year=2015, last_year=2025, thresholds=TH)[5]
    assert position_in_band(band.p50, band) == "normal" and position_in_band(band.p75 + 0.1, band) == "ust"
    assert position_in_band(band.p25 - 0.001, band) == "alt" and position_in_band(band.p10 - 0.05, band) == "en_dusuk"
    short = compute_normal_bands(series({2016: 0.5}), allowed_years=None, first_year=2015, last_year=2025, thresholds=TH)[5]
    assert position_in_band(0.5, short) is None
