from datetime import date

import pytest

from bahcelab_backend.domain.water import era5
from bahcelab_backend.domain.water.era5_sync import merge_day
from bahcelab_backend.domain.water.models import ERA5, MODEL


def test_model_layers_map_to_era5_layers_by_depth_weighting() -> None:
    # model katmanları: 0–1 cm 0.30, 1–3 cm 0.20, 3–9 cm 0.10, 9–27 cm 0.40, 27–81 cm 0.50
    mapped = era5.model_to_era5_layers([0.30, 0.20, 0.10, 0.40, 0.50])
    assert mapped[0] == pytest.approx((1 * 0.30 + 2 * 0.20 + 4 * 0.10) / 7)  # 0–7 cm: 3–9 cm katmanının 4/6'sı
    assert mapped[1] == pytest.approx((2 * 0.10 + 18 * 0.40 + 1 * 0.50) / 21)  # 7–28 cm: 7–9 + 9–27 + 27–28
    assert mapped[2] == pytest.approx(0.50)  # 28–100 cm: modelde yalnız 28–81 cm var (%74 örtü) → o kısmın ortalaması
    assert mapped[3] is None  # 100–255 cm modelde yok: uydurma yok


def test_layer_needs_enough_depth_coverage_or_it_is_empty() -> None:
    assert era5.overlap_mean([0.2, 0.2, None, None, None], era5.MODEL_LAYERS_CM, 0, 28) is None  # 28 cm'nin yalnız 3'ü örtülü
    assert era5.overlap_mean([0.2, 0.2, 0.2, 0.2, 0.3], era5.MODEL_LAYERS_CM, 0, 28) == pytest.approx(0.2 + (0.3 - 0.2) * 1 / 28)


def hours(value: float | None, n: int = 24) -> list[float | None]:
    return [value] * n


def test_daily_aggregation_means_sums_and_minimum_hours() -> None:
    agg = era5.aggregate_day({"sm0": hours(0.3), "sm1": hours(0.25), "sm2": hours(0.2), "sm3": hours(0.15), "yagis": [0.5] * 24, "et0": [0.1] * 24, "t2m": [10.0] * 12 + [20.0] * 12})
    assert agg.sm == pytest.approx([0.3, 0.25, 0.2, 0.15]) and agg.yagis_mm == pytest.approx(12.0) and agg.et0_mm == pytest.approx(2.4)
    assert agg.t_ort == pytest.approx(15.0) and (agg.t_min, agg.t_max) == (10.0, 20.0)
    partial = era5.aggregate_day({"sm0": [0.3] * 3 + [None] * 21, "yagis": [None] * 24})
    assert partial.sm[0] is None and partial.yagis_mm is None  # 18 saatten az veri: günlük değer yok (uydurma yok)


def test_group_by_day_uses_local_hour_slots() -> None:
    out = era5.group_by_day(["2024-01-10T00:00", "2024-01-10T01:00", "2024-01-11T00:00"], {"x": [1.0, 2.0, 3.0]})
    assert out[date(2024, 1, 10)]["x"][:3] == [1.0, 2.0, None] and out[date(2024, 1, 11)]["x"][0] == 3.0


def test_parse_functions_read_open_meteo_payloads() -> None:
    times = ["2024-01-10T00:00", "2024-01-10T01:00"]
    land = era5.parse_era5_land({"hourly": {"time": times, **{v: [0.3, 0.31] for v in era5.SOIL_VARS}, "temperature_2m": [10.0, 11.0]}})
    assert land[date(2024, 1, 10)]["sm2"][:2] == [0.3, 0.31] and land[date(2024, 1, 10)]["t2m"][1] == 11.0
    rean = era5.parse_era5({"hourly": {"time": times, "precipitation": [0.0, 0.2], "et0_fao_evapotranspiration": [0.1, 0.1]}})
    assert rean[date(2024, 1, 10)]["yagis"][1] == 0.2
    model = era5.parse_model({"hourly": {"time": times, **{v: [0.2, 0.2] for v in era5.MODEL_SOIL_VARS}, "precipitation": [0.0, 0.0], "et0_fao_evapotranspiration": [0.0, 0.0], "temperature_2m": [5.0, 5.0]}})
    assert model[date(2024, 1, 10)]["sm0"][0] == pytest.approx(0.2) and model[date(2024, 1, 10)]["sm3"][0] is None


def day(value: float | None, **extra: list[float | None]) -> dict[str, list[float | None]]:
    return {"sm0": hours(value), "sm1": hours(value), "sm2": hours(value), "sm3": hours(value), "t2m": hours(10.0), **extra}


def test_merge_prefers_era5_land_soil_and_era5_weather_and_falls_back_to_the_model_per_group() -> None:
    both = merge_day(day(0.3), {"yagis": hours(0.1), "et0": hours(0.05)}, day(0.2, yagis=hours(0.0), et0=hours(0.0)))
    assert both is not None and both["toprak_kaynak"] == ERA5 and both["hava_kaynak"] == ERA5 and both["sm0"] == pytest.approx(0.3)
    # son günler: ERA5-Land nemi henüz yok → model; ET0/yağış ERA5'ten gelmiş olabilir
    mixed = merge_day(day(None), {"yagis": hours(0.1), "et0": hours(0.05)}, day(0.2, yagis=hours(0.0), et0=hours(0.0)))
    assert mixed is not None and mixed["toprak_kaynak"] == MODEL and mixed["hava_kaynak"] == ERA5 and mixed["sm0"] == pytest.approx(0.2)
    future = merge_day(None, None, day(0.2, yagis=hours(0.0), et0=hours(0.01)))
    assert future is not None and future["toprak_kaynak"] == MODEL and future["hava_kaynak"] == MODEL
    assert merge_day(day(None), None, None) is None  # hiçbir kaynakta veri yok: satır yazılmaz


def test_year_chunks_split_the_archive_calls() -> None:
    chunks = era5.year_chunks(date(2015, 1, 1), date(2016, 3, 5))
    assert chunks == [(date(2015, 1, 1), date(2015, 12, 31)), (date(2016, 1, 1), date(2016, 3, 5))]


def test_model_is_shifted_by_the_overlap_bias_so_the_transition_day_has_no_artificial_jump() -> None:
    from bahcelab_backend.domain.water.era5_sync import apply_offsets, model_offsets

    days = [date(2026, 10, d) for d in range(1, 8)]
    era5_rows = {d: {"sm0": 0.30, "sm1": 0.25, "sm2": 0.27, "sm3": 0.20, "toprak_kaynak": ERA5} for d in days}
    model = {d: {"sm0": [0.21] * 24, "sm1": [0.24] * 24, "sm2": [0.17] * 24, "sm3": [None] * 24} for d in days}
    offsets = model_offsets(era5_rows, model, days[-1])
    assert offsets[0] == pytest.approx(0.09) and offsets[1] == pytest.approx(0.01) and offsets[2] == pytest.approx(0.10) and offsets[3] is None
    row = {"sm0": 0.213, "sm1": 0.206, "sm2": 0.183, "sm3": None, "toprak_kaynak": MODEL, "saatlik": {"sm0": [0.213] * 24}}
    fixed = apply_offsets(row, offsets)
    assert fixed["sm0"] == pytest.approx(0.303) and fixed["sm2"] == pytest.approx(0.283) and fixed["sm3"] is None
    assert fixed["saatlik"]["model_ofset"]["sm0"] == pytest.approx(0.09) and fixed["saatlik"]["sm0"][0] == pytest.approx(0.303)
    assert apply_offsets(row, [None] * 4) == row  # örtüşme yoksa düzeltme yapılmaz
    short = {d: era5_rows[d] for d in days[:2]}
    assert model_offsets(short, model, days[1]) == [None, None, None, None]  # < 3 gün örtüşme
