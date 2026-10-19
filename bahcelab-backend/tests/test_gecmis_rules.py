"""Geçmiş sayfası kuralları: yıl etiketi (diğer yıllara göre, tek etiket kuralı) ve güvenilir yeşerme başlangıcı (saf birim testleri)."""

from datetime import date, timedelta

from bahcelab_backend.domain.agro import catalog as cat
from bahcelab_backend.domain.gecmis import rules as gr

RULE = cat.load_catalog().gecmis
LABEL = cat.load_catalog().durum_v2


def test_summer_value_needs_enough_summer_months_and_ignores_other_months():
    assert gr.summer_value({6: 0.6, 7: 0.62, 8: 0.58, 9: 0.6, 1: 0.1}, RULE) == 0.6
    assert gr.summer_value({6: 0.6, 7: 0.6}, RULE) is None  # yetersiz yaz verisi: değer uydurulmaz
    assert gr.summer_value({1: 0.5, 2: 0.5, 3: 0.5}, RULE) is None


def test_year_levels_compare_each_year_with_the_other_years_only():
    values: dict[int, float | None] = {y: 0.60 + 0.002 * (y % 5) for y in range(2016, 2026)}
    values[2022] = 0.40  # belirgin düşük yıl
    values[2024] = 0.75  # belirgin yüksek yıl
    levels = gr.year_levels(values, RULE, LABEL)
    assert levels[2022] == "belirgin_dusuk" and levels[2024] == "belirgin_yuksek"
    assert levels[2018] == "normal"


def test_year_levels_are_empty_when_too_few_other_years_or_no_value():
    few = {2020: 0.6, 2021: 0.61, 2022: 0.5}
    assert set(gr.year_levels(few, RULE, LABEL).values()) == {None}
    values: dict[int, float | None] = {y: 0.6 + y * 0.0001 for y in range(2015, 2025)}
    values[2019] = None
    assert gr.year_levels(values, RULE, LABEL)[2019] is None


def _curve(year: int, base: float, peak: float, rise_day: int = 75, estimated: bool = False) -> list[gr.CurvePoint]:
    out = []
    for i in range(0, 200):
        day = date(year, 1, 1) + timedelta(days=i)
        v = base if i < rise_day else base + (peak - base) * min(1.0, (i - rise_day) / 30)
        out.append(gr.CurvePoint(day, v, estimated))
    return out


def _obs(year: int, n: int) -> list[date]:
    return [date(year, 2, 1) + timedelta(days=7 * i) for i in range(n)]


def test_green_up_is_found_when_the_curve_rises_and_evidence_is_enough():
    result = gr.green_up(2022, _curve(2022, 0.55, 0.70), _obs(2022, 12), RULE)
    assert result is not None and date(2022, 3, 15) <= result.tarih <= date(2022, 4, 5)
    assert result.taban == 0.55 and result.tepe == 0.7


def test_green_up_is_omitted_when_unreliable():
    assert gr.green_up(2022, _curve(2022, 0.55, 0.57), _obs(2022, 12), RULE) is None  # genlik küçük
    assert gr.green_up(2022, _curve(2022, 0.55, 0.70), _obs(2022, 4), RULE) is None  # az gözlem
    assert gr.green_up(2022, _curve(2022, 0.55, 0.70, estimated=True), _obs(2022, 12), RULE) is None  # eğri tahmini ağırlıklı
    assert gr.green_up(2022, [], _obs(2022, 12), RULE) is None


def test_green_up_requires_a_lasting_rise_not_a_one_day_spike():
    points = _curve(2022, 0.55, 0.70)
    spike = [gr.CurvePoint(p.tarih, 0.9 if p.tarih == date(2022, 2, 10) else p.deger, False) for p in points]
    result = gr.green_up(2022, spike, _obs(2022, 12), RULE)
    assert result is None or result.tarih > date(2022, 2, 10)
