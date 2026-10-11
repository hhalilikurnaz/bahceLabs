"""Agro kuralları: katalog, sezon/evre tarihleri, seriler, skor, «Bugün» (saf birim testleri; veritabanı gerekmez)."""

from datetime import date, timedelta

import pytest

from bahcelab_backend.config import Settings
from bahcelab_backend.domain.agro import catalog as cat
from bahcelab_backend.domain.agro.score import (
    SceneValue,
    ScoreConfig,
    assess,
    baseline,
    derive_status,
    deviation_points,
)
from bahcelab_backend.domain.agro.series import (
    DayWeather,
    build_season,
    coverage,
    daily_gdd,
    one_year_earlier,
)
from bahcelab_backend.domain.agro.today import Girdi, build_today

CFG = ScoreConfig.from_settings(Settings())
SPANS = {"ndvi": 0.9, "ndmi": 0.8}
TODAY = date(2026, 10, 10)


# ----------------------------------------------------------------------------- katalog
def test_catalog_loads_and_every_rule_carries_status_and_source():
    catalog = cat.load_catalog()
    assert catalog.surum >= 1 and {"limon", "portakal", "mandalina", "greyfurt", "diger"} <= set(catalog.urunler)
    for code, product in catalog.urunler.items():
        for block in (product.fenoloji, product.kc, product.gdd):
            if block is None:
                continue
            assert block.kaynak.strip(), code
            assert block.durum == "dogrulanmadi", f"{code}: onaysız kural 'doğrulanmadı' işaretli olmalı"
        assert any(c.kod == "diger" for c in product.cesitler)


def test_lemon_varieties_and_unknown_product_has_no_rules():
    catalog = cat.load_catalog()
    assert {c.kod for c in catalog.urun("limon").cesitler} >= {"enterdonat", "kutdiken", "lamas", "meyer", "yediveren", "diger"}  # type: ignore[union-attr]
    rules = cat.effective_rules(catalog, "diger", None)
    assert rules.fenoloji is None and rules.kc is None and rules.gdd is None


def test_approved_rule_requires_reviewer():
    with pytest.raises(ValueError):
        cat.KuralBlok(durum="muhendis_onayli", kaynak="x")
    assert cat.KuralBlok(durum="muhendis_onayli", kaynak="x", onaylayan="A", onay_tarihi=date(2026, 1, 1)).onaylayan == "A"


@pytest.mark.parametrize(
    ("text", "expected"),
    [("Interdonato", "enterdonat"), ("  KÜTDİKEN ", "kutdiken"), ("yedi veren", "yediveren"), ("Lamas", "lamas"), ("Bilinmeyen çeşit", "diger"), ("", None), (None, None)],
)
def test_free_text_variety_maps_to_catalog_code(text, expected):
    assert cat.match_variety(cat.load_catalog(), "limon", text) == expected


def test_stage_windows_cross_the_year_and_stay_in_the_season():
    # Kış dinlenmesi 15 Ara → 15 Şub: 2025 sezonunda 2025-12-15 → 2026-02-15
    assert cat.stage_window("12-15", "02-15", 2025) == (date(2025, 12, 15), date(2026, 2, 15))
    # Olgunlaşma 1 Eki → 14 Ara aynı takvim yılında
    assert cat.stage_window("10-01", "12-14", 2025) == (date(2025, 10, 1), date(2025, 12, 14))
    # Meyve büyümesi 16 Haz → 30 Eyl sezonun ikinci yılında
    assert cat.stage_window("06-16", "09-30", 2025) == (date(2026, 6, 16), date(2026, 9, 30))


def test_every_catalog_stage_falls_inside_one_season_without_gaps_or_overlap():
    rules = cat.effective_rules(cat.load_catalog(), "limon", "lamas").fenoloji
    assert rules is not None
    windows = sorted(cat.stage_window(e.baslangic, e.bitis, 2025) for e in rules.evreler)
    assert windows[0][0] == date(2025, 10, 1) and windows[-1][1] <= date(2026, 9, 30)
    for (_, previous_end), (next_start, _) in zip(windows, windows[1:], strict=False):
        assert next_start == previous_end + timedelta(days=1)


def test_season_start_year_uses_1_october():
    assert cat.season_start_year(date(2026, 9, 30)) == 2025
    assert cat.season_start_year(date(2026, 10, 1)) == 2026


# ----------------------------------------------------------------------------- seriler
def test_daily_gdd_clamps_at_zero_and_never_invents_values():
    assert daily_gdd(8.0, 20.0, 12.5) == pytest.approx(1.5)
    assert daily_gdd(2.0, 10.0, 12.5) == 0.0
    assert daily_gdd(None, 20.0, 12.5) is None and daily_gdd(8.0, 20.0, None) is None


def test_cumulative_series_skips_missing_days_and_leap_day_shift():
    rows = {date(2025, 10, 1): DayWeather(date(2025, 10, 1), 10, 20, 5.0), date(2025, 10, 3): DayWeather(date(2025, 10, 3), 12, 24, 2.5)}
    days = build_season(rows, date(2025, 10, 1), date(2025, 10, 3), 12.5)
    assert [d.yagis_birikimli_mm for d in days] == [5.0, 5.0, 7.5]  # eksik gün birikimi değiştirmez
    assert days[1].yagis_mm is None and days[1].gdd is None
    assert days[2].gdd_birikimli == pytest.approx(2.5 + 5.5, abs=0.1)
    assert one_year_earlier(date(2024, 2, 29)) == date(2023, 2, 28)
    assert coverage(rows, date(2025, 10, 1), date(2025, 10, 3)) == pytest.approx(2 / 3)


# ----------------------------------------------------------------------------- skor
def series(start: date, values: list[float], step: int = 5) -> list[SceneValue]:
    return [SceneValue(start + timedelta(days=i * step), {"ndvi": v, "ndmi": 0.2}) for i, v in enumerate(values)]


def test_deviation_points_boundaries():
    assert deviation_points(0.60, 0.60, 0.9, CFG) == 100
    assert deviation_points(0.60 - 0.045, 0.60, 0.9, CFG) == 100  # tam tolerans (%5 aralık)
    assert deviation_points(0.60 - 0.27, 0.60, 0.9, CFG) == 0  # %30 aralık
    mid = deviation_points(0.60 - 0.1575, 0.60, 0.9, CFG)  # toleransla sıfır arasının ortası
    assert 45 <= mid <= 55
    assert deviation_points(0.9, 0.5, 0.9, CFG) == 100  # artış cezalandırılmaz


def test_baseline_prefers_same_period_last_year_then_recent_days_then_none():
    latest = date(2026, 6, 1)
    last_year = [(date(2025, 5, 25) + timedelta(days=i * 5), 0.6) for i in range(4)]
    recent = [(latest - timedelta(days=80 - i * 10), 0.5) for i in range(6)]
    assert baseline(last_year + recent, latest, CFG).kaynak == "gecmis_sezon"  # type: ignore[union-attr]
    assert baseline(recent, latest, CFG).kaynak == "son_gunler"  # type: ignore[union-attr]
    assert baseline(recent[:2], latest, CFG) is None  # yetersiz geçmiş
    assert baseline([], latest, CFG) is None


def test_normal_garden_scores_high_and_is_labelled_good():
    scenes = series(date(2026, 6, 1), [0.62, 0.61, 0.63, 0.62, 0.61] * 4)
    result = assess(scenes, spans=SPANS, sat_severities=[], weather_severities=[], today=scenes[-1].tarih + timedelta(days=2), cfg=CFG)
    assert result.veri_yeterli and result.skor == 100 and result.durum == "iyi"
    assert result.guven.seviye in ("orta", "yuksek") and "kendi" in result.bilesenler[0].neden


def test_sudden_drop_lowers_score_and_names_the_cause():
    base = [0.62] * 19
    scenes = series(date(2026, 6, 1), [*base, 0.40])
    result = assess(scenes, spans=SPANS, sat_severities=[], weather_severities=[], today=scenes[-1].tarih, cfg=CFG)
    assert result.skor is not None and result.skor < 75
    vigor = next(b for b in result.bilesenler if b.kod == "canlilik")
    assert vigor.puan is not None and vigor.puan < 50 and "altında" in vigor.neden and "%" in vigor.neden
    assert "Canlılık" in result.ozet


def test_homogeneous_constant_garden_does_not_break_scoring():
    scenes = [SceneValue(date(2026, 6, 1) + timedelta(days=5 * i), {"ndvi": 0.5, "ndmi": 0.1}) for i in range(20)]
    result = assess(scenes, spans=SPANS, sat_severities=[], weather_severities=None, today=scenes[-1].tarih, cfg=CFG)
    assert result.skor == 100  # hava bileşeni (yok) dışarıda kalır, kalan ağırlıklar yeniden normalleştirilir
    assert next(b for b in result.bilesenler if b.kod == "hava").kullanilabilir is False


def test_insufficient_history_gives_no_score_with_reason():
    scenes = series(date(2026, 9, 1), [0.6, 0.6])
    result = assess(scenes, spans=SPANS, sat_severities=[], weather_severities=[], today=scenes[-1].tarih, cfg=CFG)
    assert result.skor is None and not result.veri_yeterli
    assert "yeterli geçmiş" in (result.veri_yetersiz_nedeni or "") and result.guven.seviye == "dusuk"


def test_no_images_means_no_data_but_red_weather_alert_still_shows_attention():
    result = assess([], spans=SPANS, sat_severities=[], weather_severities=[], today=TODAY, cfg=CFG)
    assert result.durum == "veri_yok" and result.skor is None
    red = assess([], spans=SPANS, sat_severities=[], weather_severities=["kirmizi"], today=TODAY, cfg=CFG)
    assert red.durum == "dikkat"


def test_stale_last_image_suppresses_the_score():
    scenes = series(date(2026, 3, 1), [0.6] * 10)
    result = assess(scenes, spans=SPANS, sat_severities=[], weather_severities=[], today=scenes[-1].tarih + timedelta(days=CFG.stale_image_days + 1), cfg=CFG)
    assert result.skor is None and "günlük" in (result.veri_yetersiz_nedeni or "")


def test_red_alert_caps_the_label_even_with_a_high_score():
    scenes = series(date(2026, 6, 1), [0.62] * 20)
    red = assess(scenes, spans=SPANS, sat_severities=["kirmizi"], weather_severities=[], today=scenes[-1].tarih, cfg=CFG)
    yellow = assess(scenes, spans=SPANS, sat_severities=["sari"], weather_severities=[], today=scenes[-1].tarih, cfg=CFG)
    assert red.durum == "dikkat" and yellow.durum == "izle"
    assert yellow.skor is not None and yellow.skor < 100  # uyarı bileşeni puanı düşürür


def test_label_thresholds_come_from_one_function():
    assert derive_status(has_data=True, severities=[], score=CFG.good_min, cfg=CFG) == "iyi"
    assert derive_status(has_data=True, severities=[], score=CFG.good_min - 1, cfg=CFG) == "izle"
    assert derive_status(has_data=True, severities=[], score=CFG.watch_min - 1, cfg=CFG) == "dikkat"


# ----------------------------------------------------------------------------- bugün
EMPTY = Girdi(hava_uyarilari=[], zararli_riskleri=[], ilaclama=[], uydu_uyarilari=[], sulama=None)
PRIORITY = ("hava_uyarisi", "zararli_riski", "ilaclama", "indeks_dususu", "sulama")


def test_today_defaults_to_all_clear():
    items = build_today(EMPTY, TODAY, PRIORITY, 3)
    assert [i.tur for i in items] == ["her_sey_yolunda"]


def test_today_orders_by_priority_and_limits_to_three():
    data = Girdi(
        hava_uyarilari=[("sari", "Sıcak dalgası", "…"), ("kirmizi", "Don riski", "…")],
        zararli_riskleri=[("yuksek", "Meyve sineği", "…"), ("dusuk", "Kırmızı örümcek", "…")],
        ilaclama=[(TODAY, "06:00", "10:00")],
        uydu_uyarilari=[("kirmizi", "Canlılık düşüşü", "…")],
        sulama=(12.0, "Önümüzdeki hafta yaklaşık 12 mm su ihtiyacı var."),
    )
    items = build_today(data, TODAY, PRIORITY, 3)
    assert [i.tur for i in items] == ["hava_uyarisi", "hava_uyarisi", "zararli_riski"]
    assert items[0].baslik == "Don riski" and items[0].oncelik == "kritik"  # kırmızı önce
    assert all(i.tur != "her_sey_yolunda" for i in items) and len(items) == 3


def test_today_spray_window_wording_and_lower_priorities():
    data = Girdi([], [], [(TODAY + timedelta(days=1), "05:00", "09:00")], [("sari", "Klorofil düşüşü", "…")], None)
    items = build_today(data, TODAY, PRIORITY, 3)
    assert items[0].tur == "ilaclama" and "Yarın" in items[0].baslik and "05:00–09:00" in items[0].metin
    assert items[1].tur == "indeks_dususu" and items[1].sekme == "durum"


def test_high_pest_risk_lowers_points_but_does_not_cap_the_label_by_itself():
    scenes = series(date(2026, 6, 1), [0.62] * 20)
    kwargs = {"spans": SPANS, "sat_severities": [], "weather_severities": [], "today": scenes[-1].tarih, "cfg": CFG}
    plain = assess(scenes, **kwargs)
    risky = assess(scenes, **kwargs, risk_high_count=1)
    heavy = assess(scenes, **kwargs, risk_high_count=9)  # alt sınır 0
    assert plain.skor == 100 and risky.skor is not None and risky.skor < plain.skor
    weather = next(b for b in risky.bilesenler if b.kod == "hava")
    assert weather.puan == 100 - CFG.risk_penalty_per_high and "risk tahmini" in weather.neden
    assert next(b for b in heavy.bilesenler if b.kod == "hava").puan == 0
    assert risky.durum == "iyi"  # etiketi yalnızca skor ve uyarılar belirler
