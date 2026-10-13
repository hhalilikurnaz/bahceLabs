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


def test_root_zone_fill_uses_root_distribution_weights_and_the_deepest_layer_has_none() -> None:
    clims = [CLIM, CLIM, CLIM, CLIM]
    assert wb.root_zone_fill([0.40, 0.40, 0.10, 0.10], clims, (15, 35, 50, 0)) == pytest.approx((100 * 15 + 100 * 35 + 0 * 50) / 100)
    assert wb.root_zone_fill([None, 0.25, 0.25, 0.4], clims, (15, 35, 50, 0)) == pytest.approx(50.0)  # eksik katman atlanır
    assert wb.root_zone_fill([None, None, None, 0.3], clims, (15, 35, 50, 0)) is None  # 100–255 cm ağırlığı 0: tek başına doluluk vermez


def test_fill_classes_follow_the_catalog_thresholds() -> None:
    assert [wb.classify_fill(v, RULE) for v in (80.0, 60.0, 50.0, 35.0, 10.0, None)] == ["nemli", "nemli", "orta", "kuru", "kuru", "bilinmiyor"]


def decide(fill, forecast, taw=100.0, now=None, day=date(2026, 10, 13)):  # noqa: ANN001, ANN201
    return wb.irrigation_decision(fill, day, forecast, now, taw, RULE)


def test_decision_compares_with_the_seasons_normal_and_names_the_month() -> None:
    taw = 100.0
    wet_future = wb.simulate(days_of([5.0] * 7, et0=2.0), taw, 10.0)
    wet = decide(80.0, wet_future)
    assert wet.cumle == "Kök bölgesi Ekim normaline göre nemli (%80); önümüzdeki 7 gün sulama gerekmiyor." and wet.durum == "gerekmiyor" and not wet.gerekli and wet.donem == "Ekim"
    assert "orta nemde (%50)" in decide(50.0, wet_future).cumle and "izleyin" in decide(50.0, wet_future).cumle
    assert decide(None, wet_future).durum == "veri_yok" and decide(None, wet_future).cumle.startswith("Kök bölgesi nemi için yeterli veri yok")
    assert "hesaplanamadığından" in decide(80.0, wet_future, taw=None).cumle and not decide(80.0, wet_future, taw=None).gerekli


def test_absolute_dry_wording_needs_both_low_vs_season_and_a_water_balance_deficit() -> None:
    taw = 100.0
    dry_future = wb.simulate(days_of([0.0] * 7, et0=9.0), taw, 45.0)  # 7 gün içinde kova stres eşiğine (50 mm) iner
    now_ok = wb.DayBalance(D0, 0.0, 0.0, 0.0, 10.0, 90.0, 0.0, False, False)
    both = decide(20.0, dry_future, now=now_ok)  # mevsim normaline göre düşük VE açık oluşuyor
    assert both.gerekli and both.durum == "sulama" and "Ekim normaline göre kuru (%20)" in both.cumle and "sulama planlayın" in both.cumle and both.ihtiyac_mm is not None and both.ihtiyac_mm >= 50
    low_only = decide(20.0, wb.simulate(days_of([5.0] * 7, et0=2.0), taw, 10.0), now=now_ok)  # düşük ama su dengesi açık vermiyor
    assert not low_only.gerekli and low_only.durum == "izle" and "kuru" not in low_only.cumle.replace("düşük", "") and "açık vermiyor" in low_only.cumle
    deficit_only = decide(80.0, dry_future, now=now_ok)  # denge açığa iniyor ama mevsim normaline göre dolu
    assert not deficit_only.gerekli and deficit_only.durum == "izle" and "sulama gerekmiyor" in deficit_only.cumle and "kuru" not in deficit_only.cumle
    now_deficit = wb.DayBalance(D0, 0.0, 0.0, 0.0, 70.0, 30.0, 0.0, False, False)  # tükenme 70 ≥ RAW 50
    already = decide(20.0, dry_future, now=now_deficit)
    assert already.gerekli and "stres eşiğinin altında" in already.cumle
    assert not decide(80.0, dry_future, now=now_deficit).gerekli  # dolu: tek başına denge açığı sulama dedirtmez


def test_rain_below_the_daily_threshold_is_not_counted_in_the_balance() -> None:
    days = days_of([1.9, 2.0, 0.0], et0=4.0)
    out = wb.simulate(days, 100.0, 20.0, min_rain_mm=2.0)
    assert [d.etkili_yagis_mm for d in out] == [0.0, 2.0, 0.0] and [d.yagis_mm for d in out] == [1.9, 2.0, 0.0]  # grafik ham yağışı, denge etkiliyi kullanır
    assert out[0].tukenme_mm == pytest.approx(22.4) and out[1].tukenme_mm == pytest.approx(22.8)  # 20 + 2,4 − 0 ; 22,4 − 2 + 2,4
    assert wb.simulate(days, 100.0, 20.0)[0].tukenme_mm == pytest.approx(20.5)  # eşik 0: 1,9 mm sayılır


def history(month: int, diffs: list[float]) -> list[tuple[date, float]]:
    return [(date(2016 + i, month, 10), d) for i, d in enumerate(diffs)]


def test_surface_air_difference_is_judged_against_the_gardens_own_same_month_band() -> None:
    sep = history(9, [4.0, 5.0, 6.0, 5.0, 4.5, 5.5, 6.5, 5.2, 4.8, 5.8])  # p25–p75 ≈ 4,95–5,75; ortanca ≈ 5,1
    day = date(2026, 9, 16)
    normal = wb.thermal_normal(sep, day, RULE)
    assert normal is not None and normal.sahne == 10 and normal.alt < normal.ortanca < normal.ust
    hot = wb.thermal_point(day, 40.0, 39.5, 31.0, normal, RULE)  # fark 9 > p75
    assert hot.durum == "ustunde" and hot.stres is True and hot.karisik_piksel is False and hot.sapma_c == pytest.approx(9.0 - normal.ortanca) and hot.ay == "Eylül"
    typical = wb.thermal_point(day, 36.0, 35.8, 31.0, normal, RULE)  # fark 5: bant içinde
    assert typical.durum == "icinde" and typical.stres is False
    cool = wb.thermal_point(day, 33.0, 33.0, 31.0, normal, RULE)
    assert cool.durum == "altinda" and cool.stres is False
    mixed = wb.thermal_point(day, 40.0, 37.0, 31.0, normal, RULE)  # bandın üstünde ama bahçe–tampon 3 °C: karışık piksel, stres denmez
    assert mixed.durum == "ustunde" and mixed.karisik_piksel is True and mixed.stres is False
    nobuffer = wb.thermal_point(day, 40.0, None, 31.0, normal, RULE)
    assert nobuffer.stres is None  # tampon bilinmiyor → karışıklık bilinmiyor → stres denmez


def test_too_little_same_month_history_means_no_judgement_not_a_made_up_normal() -> None:
    few = history(9, [5.0, 5.2, 5.1])
    assert wb.thermal_normal(few, date(2026, 9, 16), RULE) is None
    point = wb.thermal_point(date(2026, 9, 16), 40.0, 39.5, 31.0, None, RULE)
    assert point.durum == "yetersiz_gecmis" and point.stres is None and point.sapma_c is None
    other_month = history(7, [5.0] * 12)
    assert wb.thermal_normal(other_month, date(2026, 9, 16), RULE) is None  # başka aydan bant kurulmaz
    unknown = wb.thermal_point(date(2026, 9, 16), 33.0, None, None, None, RULE)
    assert unknown.fark_c is None and unknown.stres is None and unknown.durum == "bilinmiyor"
    sep = history(9, [5.0 + 0.1 * i for i in range(10)])
    assert wb.thermal_normal([*sep, (date(2026, 9, 16), 50.0)], date(2026, 9, 16), RULE).sahne == 10  # sahnenin kendisi bandı kirletmez


def test_monthly_rain_comparison_uses_effective_rain() -> None:
    era5 = {date(2025, 7, d): 1.5 for d in range(1, 29)} | {date(2025, 8, d): 4.0 for d in range(1, 29)}
    imerg = {date(2025, 7, d): 0.1 for d in range(1, 29)} | {date(2025, 8, d): 3.0 for d in range(1, 29)}
    raw = wb.monthly_rain(era5, imerg)
    eff = wb.monthly_rain(era5, imerg, min_rain_mm=2.0)
    assert raw[0].era5_mm == pytest.approx(42.0) and eff[0].era5_mm == 0.0 and eff[0].imerg_mm == 0.0  # temmuz çiseleme: etkili yağış yok
    assert eff[1].era5_mm == pytest.approx(112.0) and eff[1].imerg_mm == pytest.approx(84.0)  # ağustos: her ikisi de eşiğin üstünde


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
