"""Agro kuralları: katalog, sezon/evre tarihleri, seriler, «Bugün» (saf birim testleri; veritabanı gerekmez)."""

from datetime import date, timedelta

import pytest

from bahcelab_backend.domain.agro import catalog as cat
from bahcelab_backend.domain.agro.series import (
    DayWeather,
    build_season,
    coverage,
    daily_gdd,
    one_year_earlier,
)
from bahcelab_backend.domain.agro.today import Girdi, build_today

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


# ----------------------------------------------------------------------------- bugün
EMPTY = Girdi(hava_uyarilari=[], zararli_riskleri=[], ilaclama=[], uydu_uyarilari=[], sulama=None)
PRIORITY = ("hava_uyarisi", "olay", "zararli_riski", "ilaclama", "indeks_dususu", "sulama")


def test_today_defaults_to_all_clear():
    items = build_today(EMPTY, TODAY, PRIORITY, 3)
    assert [i.tur for i in items] == ["her_sey_yolunda"]


def test_today_orders_by_priority_and_limits_to_three():
    data = Girdi(
        hava_uyarilari=[("sari", "Sıcak dalgası", "…"), ("kirmizi", "Don riski", "…")],
        zararli_riskleri=[("yuksek", "Meyve sineği", "Sade cümle.", "GDD …"), ("dusuk", "Kırmızı örümcek", "—", "…")],
        ilaclama=[(TODAY, "06:00", "10:00")],
        uydu_uyarilari=[("kirmizi", "Canlılık düşüşü", "…", None)],
        sulama=(12.0, "Önümüzdeki hafta yaklaşık 12 mm su ihtiyacı var."),
    )
    items = build_today(data, TODAY, PRIORITY, 3)
    assert [i.tur for i in items] == ["hava_uyarisi", "zararli_riski", "hava_uyarisi"]  # önem sırası: iki kritik (kırmızı don, YÜKSEK risk), sonra önemli (sarı)
    assert items[0].baslik == "Don riski" and items[0].oncelik == "kritik" and items[1].oncelik == "kritik" and items[2].oncelik == "onemli"
    assert all(i.tur != "her_sey_yolunda" for i in items) and len(items) == 3


def test_today_spray_window_wording_and_lower_priorities():
    data = Girdi([], [], [(TODAY + timedelta(days=1), "05:00", "09:00")], [("sari", "Klorofil düşüşü", "…", None)], None)
    items = build_today(data, TODAY, PRIORITY, 3)
    assert items[0].tur == "ilaclama" and items[0].baslik == "İlaçlama: yarın 05:00–09:00"
    assert items[1].tur == "indeks_dususu" and items[1].sekme == "durum"


def test_today_spray_items_are_merged_into_a_single_line():
    data = Girdi([], [], [(TODAY, "07:30", "10:00"), (TODAY + timedelta(days=1), "07:15", "09:00")], [], None)
    items = [i for i in build_today(data, TODAY, PRIORITY, 3) if i.tur == "ilaclama"]
    assert [i.baslik for i in items] == ["İlaçlama: bugün 07:30–10:00, yarın 07:15–09:00"]


def test_today_risk_item_is_plain_with_technical_detail_kept_separately():
    data = Girdi([], [("orta", "Akdeniz meyve sineği", "Meyve sineği için koşullar uygun – tuzakları kontrol edin.", "400 GDD, eşik …")], [], [], None)
    item = build_today(data, TODAY, PRIORITY, 3)[0]
    assert item.baslik == "Akdeniz meyve sineği" and item.metin.startswith("Meyve sineği için koşullar uygun")
    assert "GDD" not in item.metin and item.ayrinti and "GDD" in item.ayrinti and "teşhis değildir" in item.ayrinti
    low = Girdi([], [("dusuk", "X", "—", "…")], [], [], None)
    assert build_today(low, TODAY, PRIORITY, 3)[0].tur == "her_sey_yolunda"


def test_today_lists_events_and_risks_by_importance_then_kind_priority_with_one_action_each() -> (
    None
):
    data = Girdi(
        hava_uyarilari=[("sari", "Sıcak uyarısı", "m")], zararli_riskleri=[("orta", "Meyve sineği", "sade", "neden")], ilaclama=[], uydu_uyarilari=[], sulama=None,
        olaylar=[("bilgi", "Küçük olay", "m", "durum"), ("kritik", "Don olayı", "m", "hava"), ("onemli", "Kuvvetli rüzgâr olayı", "m", "hava")],
    )
    items = build_today(data, date(2026, 10, 13), PRIORITY, 4)
    assert [i.baslik for i in items] == ["Don olayı", "Sıcak uyarısı", "Kuvvetli rüzgâr olayı", "Meyve sineği"]  # kritik, sonra önemliler (tür önceliği), bilgi dışarıda (limit 4)
    assert all(i.sekme in ("durum", "analiz", "hava", "gunluk", "rapor") and i.oncelik in ("kritik", "onemli", "bilgi") for i in items)
