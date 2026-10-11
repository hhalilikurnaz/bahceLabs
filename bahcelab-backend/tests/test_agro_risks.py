"""Risk motoru ve sulama hesabı: eşik sınırları, veri yetersizliği (saf birim testleri)."""

from datetime import date, timedelta

import pytest

from bahcelab_backend.domain.agro import catalog as cat
from bahcelab_backend.domain.agro.irrigation import (
    DayInput,
    StageKc,
    effective_rain,
    kc_for_date,
    recommend,
    window,
)
from bahcelab_backend.domain.agro.risks import (
    GunVerisi,
    fly_cycles,
    fruit_fly,
    mal_secco,
    red_spider,
)
from bahcelab_backend.domain.agro.rulebook import load_irrigation_rules, load_risk_rules
from bahcelab_backend.domain.agro.simulation import MAX_HIGH_SHARE, simulate_year

from .support.weather_year import load_year

RISKS = load_risk_rules()
IRR = load_irrigation_rules()
FLY = RISKS.kurallar["akdeniz_meyve_sinegi"]
SPIDER = RISKS.kurallar["kirmizi_orumcek"]
SECCO = RISKS.kurallar["kuruma_hastaligi"]


def test_every_risk_and_irrigation_rule_is_unverified_and_sourced():
    assert RISKS.surum >= 1 and set(RISKS.kurallar) == {
        "akdeniz_meyve_sinegi",
        "kirmizi_orumcek",
        "kuruma_hastaligi",
    }
    for rule in RISKS.kurallar.values():
        assert rule.durum == "dogrulanmadi" and rule.kaynak.strip() and rule.urunler
    for block in (IRR.etkili_yagis, IRR.sulama_sistemleri):
        assert block.durum == "dogrulanmadi" and block.kaynak.strip()
    assert IRR.sulama_sistemleri.sistemler["yok"].verimlilik is None


# ----------------------------------------------------------------------------- meyve sineği
def history(start: date, days: int, mean: float) -> dict[date, GunVerisi]:
    return {
        start + timedelta(days=i): GunVerisi(start + timedelta(days=i), mean - 4, mean + 4)
        for i in range(days)
    }


def fly(today: date, hist, stage="meyve_gelisimi"):
    return fruit_fly(FLY, hist, today, stage, "Meyve büyümesi")


def test_fruit_fly_cycle_resets_when_the_generation_threshold_is_reached():
    start = date(2026, 3, 1)
    per = float(
        FLY.parametreler["nesil_gdd"]
    )  # 400 → ortalama 20 °C'de günlük 10 GDD → 40 günde bir kuşak
    hist = history(start, 130, 20.0)
    done, in_cycle, total, have, span = fly_cycles(
        hist, start, start + timedelta(days=40), 10.0, per
    )
    assert (
        (done, in_cycle) == (1, 0.0) and total == 400.0 and have == span == 40
    )  # eşiğe ulaşınca sayaç sıfırlanır
    done, in_cycle, *_ = fly_cycles(hist, start, start + timedelta(days=125), 10.0, per)
    assert done == 3 and in_cycle == pytest.approx(50.0)  # 1250 GDD = 3 kuşak + 50
    done, in_cycle, *_ = fly_cycles(hist, start, start + timedelta(days=39), 10.0, per)
    assert (done, in_cycle) == (0, 390.0)  # eşiğin hemen altı: kuşak sayılmaz


def test_fruit_fly_is_never_high_without_trap_data_and_needs_activity_and_a_sensitive_stage():
    start = date(2026, 3, 1)
    hist = history(start, 130, 20.0)
    today = start + timedelta(days=125)
    res = fly(today, hist)
    assert (
        res.seviye == "orta" and "tuzak kontrolü önerilir" in res.gerekce
    )  # koşullar uygun ama tuzak yok: tavan "orta"
    assert fly(today, hist, stage="ciceklenme").seviye == "dusuk"  # meyve duyarlı değil
    hot = {
        **hist,
        **{
            today - timedelta(days=i): GunVerisi(today - timedelta(days=i), 30, 40)
            for i in range(1, 11)
        },
    }
    assert (
        fly(today, hot).seviye == "dusuk" and "etkinliğe uygun değil" in fly(today, hot).gerekce
    )  # son 10 gün aktif aralık dışı
    cold = history(start, 130, 8.0)
    assert fly(today, cold).seviye == "dusuk"


def test_fruit_fly_high_only_when_trap_data_exceeds_the_threshold():
    start = date(2026, 3, 1)
    hist = history(start, 130, 20.0)
    today = start + timedelta(days=125)
    traps = FLY.parametreler["tuzak_esikleri"]

    def with_traps(count: float):
        return fruit_fly(FLY, hist, today, "meyve_gelisimi", "Meyve büyümesi", trap_per_week=count)

    assert with_traps(float(traps["yuksek"])).seviye == "yuksek"
    assert with_traps(float(traps["yuksek"]) - 0.1).seviye == "orta"
    assert with_traps(float(traps["orta"])).seviye == "orta"
    assert with_traps(float(traps["orta"]) - 0.1).seviye == "dusuk"


def test_fruit_fly_before_season_start_and_missing_data():
    assert fly(date(2026, 2, 10), {}).seviye == "dusuk" and fly(date(2026, 2, 10), {}).veri_yeterli
    sparse = history(date(2026, 3, 1), 20, 20.0)  # 125 günün yalnızca 20'si dolu
    result = fly(date(2026, 7, 4), sparse)
    assert result.veri_yeterli is False and "veri yetersiz" in result.gerekce


def test_year_simulation_with_real_2025_weather_keeps_every_rule_below_the_high_share_limit():
    result = simulate_year(RISKS, load_year(), 2025)
    assert set(result) == {"akdeniz_meyve_sinegi", "kirmizi_orumcek", "kuruma_hastaligi"}
    for code, counts in result.items():
        total = sum(counts.values())
        assert total == 365
        assert counts["yuksek"] / total <= MAX_HIGH_SHARE, (
            f"{code}: yüksek %{100 * counts['yuksek'] / total:.1f}"
        )
    assert result["akdeniz_meyve_sinegi"]["yuksek"] == 0  # tuzak verisi olmadan asla "yüksek"
    assert (
        result["akdeniz_meyve_sinegi"]["dusuk"] > 0 and result["akdeniz_meyve_sinegi"]["orta"] > 0
    )  # yıl boyu tek seviyede takılmaz


# ----------------------------------------------------------------------------- kırmızı örümcek
TODAY = date(2026, 7, 10)


def spider_days(hot_dry_before_today: int, *, forecast_hot: int = 0, nem=None):
    days = []
    for i in range(7, -1, -1):  # 7 gün önce → bugün
        hot = i < hot_dry_before_today
        days.append(
            GunVerisi(TODAY - timedelta(days=i), 20, 34 if hot else 24, 0.0 if hot else 3.0)
        )
    for j in range(1, 4):
        days.append(
            GunVerisi(
                TODAY + timedelta(days=j), 20, 34 if j <= forecast_hot else 24, 0.0, nem_yuzde=nem
            )
        )
    return days


@pytest.mark.parametrize(("run", "level"), [(3, "dusuk"), (4, "orta"), (6, "orta"), (7, "yuksek")])
def test_red_spider_levels_follow_consecutive_hot_dry_days(run, level):
    assert red_spider(SPIDER, spider_days(run), TODAY).seviye == level


def test_red_spider_forecast_extends_the_run_and_humidity_or_rain_breaks_it():
    assert (
        red_spider(SPIDER, spider_days(3, forecast_hot=1), TODAY).seviye == "orta"
    )  # 3 + 1 tahmin günü
    assert "uzuyor" in red_spider(SPIDER, spider_days(3, forecast_hot=1), TODAY).gerekce
    humid = red_spider(
        SPIDER, spider_days(3, forecast_hot=3, nem=80.0), TODAY
    )  # nem yüksek: tahmin günleri sayılmaz
    assert humid.seviye == "dusuk"


def test_red_spider_without_recent_data_is_insufficient():
    result = red_spider(SPIDER, [GunVerisi(TODAY, 20, 34, 0.0)], TODAY)
    assert result.veri_yeterli is False and result.seviye == "dusuk"


# ----------------------------------------------------------------------------- kuruma hastalığı
def forecast(rain: float, wind: float, tmin: float = 12, tmax: float = 22, offset: int = 1):
    return [
        GunVerisi(
            TODAY + timedelta(days=i),
            tmin,
            tmax,
            rain if i == offset else 0.0,
            wind if i == offset else 5.0,
        )
        for i in range(7)
    ]


@pytest.mark.parametrize(
    ("rain", "wind", "level"),
    [
        (10.0, 30.0, "yuksek"),
        (9.9, 30.0, "orta"),
        (10.0, 29.9, "orta"),
        (5.0, 20.0, "orta"),
        (4.9, 40.0, "dusuk"),
        (20.0, 19.9, "dusuk"),
    ],
)
def test_mal_secco_thresholds(rain, wind, level):
    assert mal_secco(SECCO, forecast(rain, wind), TODAY).seviye == level


def test_mal_secco_needs_mild_temperatures_and_reports_the_validity_window():
    assert mal_secco(SECCO, forecast(15.0, 35.0, tmin=2, tmax=8), TODAY).seviye == "dusuk"  # soğuk
    result = mal_secco(SECCO, forecast(12.0, 32.0), TODAY)
    assert result.gecerlilik_baslangic == TODAY + timedelta(days=1)
    assert result.gecerlilik_bitis == TODAY + timedelta(
        days=1 + int(SECCO.parametreler["koruma_penceresi_gun"])
    )
    assert "enfeksiyon" in result.gerekce
    assert mal_secco(SECCO, [], TODAY).veri_yeterli is False


# ----------------------------------------------------------------------------- sulama
LEMON = cat.effective_rules(cat.load_catalog(), "limon", "lamas")


def stages() -> list[StageKc]:
    assert LEMON.fenoloji and LEMON.kc
    return [
        StageKc(e.kod, e.baslangic, e.bitis, LEMON.kc.degerler[e.kod])
        for e in LEMON.fenoloji.evreler
    ]


def test_effective_rain_ignores_small_scales_and_caps():
    rule = IRR.etkili_yagis
    assert effective_rain(None, rule) == 0.0 and effective_rain(1.9, rule) == 0.0
    assert effective_rain(2.0, rule) == pytest.approx(2.0 * rule.oran)
    assert effective_rain(100.0, rule) == rule.gunluk_ust_sinir_mm


def test_kc_follows_the_phenology_window_across_the_year_end():
    s = stages()
    assert kc_for_date(s, date(2026, 1, 10)) == LEMON.kc.degerler["kis_dinlenme"]  # type: ignore[union-attr]  (15 Ara → 15 Şub)
    assert kc_for_date(s, date(2026, 4, 1)) == LEMON.kc.degerler["ciceklenme"]  # type: ignore[union-attr]
    assert kc_for_date(s, date(2026, 10, 5)) == LEMON.kc.degerler["olgunlasma"]  # type: ignore[union-attr]
    assert kc_for_date([], date(2026, 4, 1)) is None


def week(start: date, et0: float | None, rain: float | None) -> list[DayInput]:
    return [DayInput(start + timedelta(days=i), et0, rain) for i in range(7)]


def test_window_sums_etc_and_effective_rain_and_counts_missing_days():
    days = [*week(date(2026, 7, 1), 5.0, 0.0), DayInput(date(2026, 7, 8), None, 0.0)]
    w = window(days, stages(), IRR.etkili_yagis)
    assert w is not None and w.gun == 7 and w.eksik_gun == 1
    assert w.etc_mm == pytest.approx(7 * 5.0 * 0.65, abs=0.1)  # temmuz: meyve büyümesi Kc 0,65
    assert window([DayInput(date(2026, 7, 1), None, None)], stages(), IRR.etkili_yagis) is None


def test_recommendation_by_system_efficiency_and_threshold():
    future = week(date(2026, 7, 11), 6.0, 0.0)  # ≈ 27,3 mm net ihtiyaç
    drip = recommend([], future, stages(), IRR, dekar=20.0, system="damla")
    flood = recommend([], future, stages(), IRR, dekar=20.0, system="salma")
    none = recommend([], future, stages(), IRR, dekar=20.0, system="yok")
    assert drip.gerekli and drip.ihtiyac_mm == pytest.approx(27.3, abs=0.1)
    assert drip.brut_ihtiyac_mm == pytest.approx(27.3 / 0.9, abs=0.2)
    assert (
        flood.brut_ihtiyac_mm and flood.brut_ihtiyac_mm > drip.brut_ihtiyac_mm
    )  # salma daha verimsiz
    assert drip.ton_dekar == pytest.approx(drip.brut_ihtiyac_mm)  # 1 mm = 1 ton/dekar
    assert drip.toplam_ton == pytest.approx((drip.ton_dekar or 0) * 20, abs=0.5)
    assert none.brut_ihtiyac_mm is None and "verimlilik uygulanmadı" in none.cumle
    assert "yaklaşık" in drip.cumle

    rainy = recommend(
        [], week(date(2026, 7, 11), 1.0, 10.0), stages(), IRR, dekar=20.0, system="damla"
    )  # yağış ihtiyacı karşılar
    assert rainy.gerekli is False and rainy.ihtiyac_mm == 0.0 and "görünmüyor" in rainy.cumle
    assert recommend([], [], stages(), IRR, dekar=20.0, system=None).ihtiyac_mm is None
