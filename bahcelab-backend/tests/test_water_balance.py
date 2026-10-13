from datetime import date, timedelta

import pytest

from bahcelab_backend.domain.agro.catalog import load_catalog
from bahcelab_backend.domain.water import balance as wb

RULE = load_catalog().su
D0 = date(2026, 9, 1)


def test_kc_from_ndvi_is_linear_and_clipped_and_never_invented() -> None:
    assert wb.kc_from_ndvi(0.30, RULE) == pytest.approx(0.45) and wb.kc_from_ndvi(0.80, RULE) == pytest.approx(0.75)
    assert wb.kc_from_ndvi(0.55, RULE) == pytest.approx(0.60)
    assert wb.kc_from_ndvi(0.10, RULE) == pytest.approx(0.45) and wb.kc_from_ndvi(0.95, RULE) == pytest.approx(0.75)
    assert wb.kc_from_ndvi(None, RULE) is None and wb.etc_mm(None, 0.6) is None and wb.etc_mm(5.0, 0.6) == pytest.approx(3.0)


def test_ndvi_interpolates_between_scenes_and_stops_beyond_45_days() -> None:
    days = [D0 + timedelta(days=i) for i in (0, 5, 10, 120)]
    out = wb.interpolate_ndvi(days, [(D0, 0.5), (D0 + timedelta(days=10), 0.7)])
    assert out[0] == pytest.approx(0.5) and out[1] == pytest.approx(0.6) and out[2] == pytest.approx(0.7) and out[3] is None
    assert wb.interpolate_ndvi(days, []) == [None] * 4


def days_of(rain: list[float | None], et0: float = 4.0, kc: float = 0.6) -> list[wb.DayInput]:
    return [wb.DayInput(D0 + timedelta(days=i), r, et0, kc) for i, r in enumerate(rain)]


def test_bucket_depletes_with_etc_and_refills_with_rain_and_is_clamped_at_both_ends() -> None:
    out = wb.simulate(days_of([0.0, 0.0, 0.0, 30.0, 0.0]), taw_mm=100.0, initial_depletion_mm=10.0)
    assert [round(d.tukenme_mm, 1) for d in out] == [12.4, 14.8, 17.2, 0.0, 2.4]  # ETc = 4 × 0,6 = 2,4; 30 mm yağış kovayı doldurur ve taşar
    assert out[3].kullanilabilir_mm == pytest.approx(100.0)
    assert out[-1].birikimli_mm == pytest.approx(30.0 - 5 * 2.4)
    dry = wb.simulate(days_of([0.0] * 100), taw_mm=50.0, initial_depletion_mm=0.0)
    assert dry[-1].tukenme_mm == 50.0 and dry[-1].kullanilabilir_mm == 0.0  # solma noktasından aşağı inmez


def test_missing_inputs_never_change_the_bucket() -> None:
    days = [wb.DayInput(D0, 0.0, 4.0, 0.6), wb.DayInput(D0 + timedelta(days=1), None, 4.0, 0.6), wb.DayInput(D0 + timedelta(days=2), 0.0, None, 0.6), wb.DayInput(D0 + timedelta(days=3), 0.0, 4.0, None)]
    out = wb.simulate(days, 100.0, 0.0)
    assert [d.veri_eksik for d in out] == [False, True, True, True] and all(d.tukenme_mm == pytest.approx(2.4) for d in out)


CLIM = wb.Climatology(p_alt=0.10, p_ust=0.40, normal_alt=0.16, normal_ust=0.34)


def test_fill_is_normalized_to_the_cells_own_climatology_p2_to_p98() -> None:
    assert wb.normalized_fill(0.10, CLIM) == 0.0 and wb.normalized_fill(0.40, CLIM) == 100.0
    assert wb.normalized_fill(0.25, CLIM) == pytest.approx(50.0)
    assert wb.normalized_fill(0.05, CLIM) == 0.0 and wb.normalized_fill(0.60, CLIM) == 100.0  # kırpılır
    assert wb.normalized_fill(None, CLIM) is None and wb.normalized_fill(0.2, wb.Climatology(0.2, 0.2, 0.2, 0.2)) is None


def test_root_zone_fill_is_thickness_weighted_over_the_first_three_layers_and_ignores_missing_ones() -> None:
    clims = [CLIM, CLIM, CLIM, CLIM]
    assert wb.root_zone_fill([0.40, 0.40, 0.10, 0.10], clims, (7, 21, 72)) == pytest.approx((100 * 7 + 100 * 21 + 0 * 72) / 100)
    assert wb.root_zone_fill([None, 0.25, 0.25, 0.4], clims, (7, 21, 72)) == pytest.approx(50.0)  # katman 3 ve 4 hesaba girmez/eksik katman atlanır
    assert wb.root_zone_fill([None, None, None, 0.3], clims, (7, 21, 72)) is None


def test_fill_classes_follow_the_catalog_thresholds() -> None:
    assert [wb.classify_fill(v, RULE) for v in (80.0, 60.0, 50.0, 35.0, 10.0, None)] == ["nemli", "nemli", "orta", "kuru", "kuru", "bilinmiyor"]


def test_decision_sentence_names_the_state_and_the_forecast_outcome() -> None:
    taw = 100.0
    wet_future = wb.simulate(days_of([5.0] * 7, et0=2.0), taw, 10.0)
    assert wb.decision_sentence(80.0, wet_future, taw, RULE) == "Kök bölgesi nemli; önümüzdeki 7 gün sulama gerekmiyor."
    dry_future = wb.simulate(days_of([0.0] * 7, et0=9.0), taw, 45.0)
    assert "sulama planlayın" in wb.decision_sentence(80.0, dry_future, taw, RULE) and "kuruyor" in wb.decision_sentence(80.0, dry_future, taw, RULE)
    assert wb.decision_sentence(20.0, wet_future, taw, RULE).startswith("Kök bölgesi kuru;")
    assert "izleyin" in wb.decision_sentence(50.0, wet_future, taw, RULE)
    assert wb.decision_sentence(None, wet_future, taw, RULE).startswith("Kök bölgesi nemi için yeterli veri yok")
    assert "hesaplanamadı" in wb.decision_sentence(80.0, wet_future, None, RULE)


def test_surface_air_difference_stress_and_mixed_pixel_flags() -> None:
    hot = wb.thermal_point(D0, 38.0, 37.0, 31.0, RULE)
    assert hot.fark_c == pytest.approx(7.0) and hot.stres is True and hot.karisik_piksel is False and hot.bahce_tampon_fark_c == pytest.approx(1.0)
    mixed = wb.thermal_point(D0, 33.0, 30.5, 30.0, RULE)
    assert mixed.stres is False and mixed.karisik_piksel is True
    unknown = wb.thermal_point(D0, 33.0, None, None, RULE)
    assert unknown.fark_c is None and unknown.stres is None and unknown.karisik_piksel is None  # hava/tampon yoksa bilinmiyor


def month_pair(year: int, month: int, era5_per_day: float, imerg_per_day: float, days: int = 28) -> tuple[dict[date, float], dict[date, float]]:
    ds = [date(year, month, d) for d in range(1, days + 1)]
    return {d: era5_per_day for d in ds}, {d: imerg_per_day for d in ds}


def merged(pairs: list[tuple[dict[date, float], dict[date, float]]]) -> list[wb.MonthlyRain]:
    era5: dict[date, float] = {}
    imerg: dict[date, float] = {}
    for a, b in pairs:
        era5.update(a)
        imerg.update(b)
    return wb.monthly_rain(era5, imerg)


def test_rain_source_switches_to_imerg_only_when_era5_is_systematically_higher() -> None:
    systematic = merged([month_pair(2024, m, 2.0, 1.4) for m in range(1, 9)])  # oran 1,43 her ay
    source, reason = wb.choose_rain_source(systematic)
    assert source == "imerg" and "sistematik yüksek" in reason
    noisy = merged([month_pair(2024, m, 2.0 if m % 2 else 1.0, 1.5) for m in range(1, 9)])  # oran 1,33 / 0,67 dönüşümlü
    assert wb.choose_rain_source(noisy)[0] == "era5"
    close = merged([month_pair(2024, m, 1.5, 1.4) for m in range(1, 9)])
    assert wb.choose_rain_source(close)[0] == "era5"


def test_too_few_months_or_days_keeps_era5_and_says_why() -> None:
    few = merged([month_pair(2024, m, 2.0, 1.0) for m in range(1, 4)])
    source, reason = wb.choose_rain_source(few)
    assert source == "era5" and "yeterli ay yok" in reason
    short_months = merged([month_pair(2024, m, 2.0, 1.0, days=10) for m in range(1, 10)])
    assert short_months == []  # ortak gün < 25: ay sayılmaz


def test_decision_says_the_bucket_is_already_below_the_stress_threshold_when_it_is() -> None:
    taw = 100.0
    future = wb.simulate(days_of([0.0] * 7, et0=2.0), taw, 70.0)
    now = wb.DayBalance(D0, 0.0, 0.0, 70.0, 30.0, 0.0, False, False)  # tükenme 70 ≥ RAW 50
    assert wb.decision_sentence(20.0, future, taw, RULE, now) == "Kök bölgesi kuru; kullanılabilir su stres eşiğinin altında: sulama planlayın."
    assert "normale göre doluluk yüksek olsa da" in wb.decision_sentence(80.0, future, taw, RULE, now)
