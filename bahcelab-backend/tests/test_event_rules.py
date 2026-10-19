"""Olay motoru kuralları (ADR 0018): don, aşırı yağış, rüzgâr, S2 bitişik düşüş, birleştirme ve güven — saf fonksiyonlar."""

from datetime import date, timedelta

import numpy as np
import pytest

from bahcelab_backend.domain.agro.catalog import load_catalog
from bahcelab_backend.domain.events import rules as er

RULE = load_catalog().olay
D0 = date(2024, 1, 10)


def hd(offset: int, *, t=5.0, rain=0.0, gust=10.0, model=False) -> er.HourDay:  # noqa: ANN001
    return er.HourDay(D0 + timedelta(days=offset), [t] * 24, [rain / 24] * 24, [gust] * 24, model, f"cell:{D0 + timedelta(days=offset)}")


def test_frost_threshold_severity_and_consecutive_days_form_one_episode() -> None:
    days = [hd(0), hd(1, t=-0.5), hd(2, t=-2.5), hd(3), hd(6, t=-1.0)]
    signals = er.frost_signals(days, RULE)
    assert [(s.baslangic, s.bitis, s.siddet) for s in signals] == [(D0 + timedelta(days=1), D0 + timedelta(days=2), "siddetli"), (D0 + timedelta(days=6), D0 + timedelta(days=6), "normal")]
    assert signals[0].ayrinti["en_dusuk_c"] == -2.5 and len(signals[0].kaynaklar) == 2 and signals[0].kaynaklar[0].tablo == "era5_daily"
    assert er.frost_signals([hd(0, t=0.1)], RULE) == []  # 0 °C üstü don değil


def test_rain_uses_a_rolling_24_hour_window_across_midnight() -> None:
    first = er.HourDay(D0, [5.0] * 24, [0.0] * 12 + [4.0] * 12, [0.0] * 24, False, "c:1")  # günün ikinci yarısında 48 mm
    second = er.HourDay(D0 + timedelta(days=1), [5.0] * 24, [4.0] * 12 + [0.0] * 12, [0.0] * 24, False, "c:2")  # ertesi sabah 48 mm daha
    assert er.rain_signals([first], RULE) == []  # tek başına 48 mm < 50
    signals = er.rain_signals([first, second], RULE)  # gece yarısını aşan 24 saatte 96 mm
    assert len(signals) == 1 and signals[0].ayrinti["en_yuksek_24s_mm"] == pytest.approx(96.0)
    gap = [first, er.HourDay(D0 + timedelta(days=3), [5.0] * 24, [4.0] * 12 + [0.0] * 12, [0.0] * 24, False, "c:4")]
    assert er.rain_signals(gap, RULE) == []  # ardışık olmayan günler toplanmaz


def test_wind_is_low_confidence_in_the_past_and_medium_in_forecast_data() -> None:
    past = er.wind_signals([hd(0, gust=62.0)], RULE)
    assert past[0].guven == "dusuk" and er.wind_signals([hd(0, gust=59.9)], RULE) == []
    assert er.wind_signals([hd(0, gust=70.0, model=True)], RULE)[0].guven == "orta"


def grids(shape=(40, 40)):  # noqa: ANN001, ANN201
    base = np.full(shape, 0.7)
    return base.copy(), base.copy()


def floor_grid(shape=(40, 40), level=0.62):  # noqa: ANN001, ANN201
    """Pikselin dönem p10'u (diğer yılların aynı ±15 günü): sağlıklı bahçede 0,62."""
    return np.full(shape, level)


def test_s2_drop_needs_a_contiguous_patch_that_is_also_below_the_periods_p10() -> None:
    prev, cur = grids()
    cur[5:25, 5:25] -= 0.15  # 20×20 = 400 piksel = 40 da bitişik düşüş; 0,55 < p10 (0,62) ve Δ = −0,15
    patch = er.s2_patch(prev, cur, floor_grid(), RULE)
    assert patch is not None and patch[0] == pytest.approx(40.0, rel=0.01) and patch[1] <= -0.08 and patch[2].sum() == 400 and patch[3] == pytest.approx(400 / 1600)
    prev, cur = grids()
    rng = np.random.default_rng(0)
    cur.ravel()[rng.choice(1600, size=500, replace=False)] -= 0.15  # dağınık %31 piksel: tek bir bitişik yama yok
    assert er.s2_patch(prev, er.smooth_valid(cur, RULE.s2_yumusatma), floor_grid(), RULE) is None  # hat içinde görüntüler önce yumuşatılır
    prev, cur = grids()
    cur[5:9, 5:9] -= 0.15  # 16 piksel = 1,6 da < min(%25, 5 da)
    assert er.s2_patch(prev, cur, floor_grid(), RULE) is None
    prev, cur = grids()
    cur[5:25, 5:25] -= 0.05  # eşik altı Δ
    assert er.s2_patch(prev, cur, floor_grid(), RULE) is None


def test_a_seasonal_drop_that_stays_inside_the_normal_band_is_not_an_event_even_if_delta_is_large() -> None:
    prev, cur = grids()
    prev[:] = 0.85  # yüksek mevsim başı
    cur[:] = 0.74  # Δ = −0,11 (≥ 0,08) AMA 0,74 pikselin dönem p10'unun (0,62) ÜSTÜNDE: bu tarihte normal değer
    assert er.s2_patch(prev, cur, floor_grid(), RULE) is None
    cur[5:25, 5:25] = 0.55  # aynı Δ, p10 altı: olay adayı
    assert er.s2_patch(prev, cur, floor_grid(), RULE) is not None
    unknown = np.full((40, 40), np.nan)  # dönem dağılımı yok (örnek yetersiz): değerlendirilmez
    assert er.s2_patch(prev, cur, unknown, RULE) is None


def test_period_floor_uses_other_years_and_needs_enough_samples() -> None:
    few = [np.full((4, 4), 0.7) for _ in range(RULE.s2_min_ornek - 1)]
    assert np.isnan(er.period_percentile(few, RULE)).all()
    enough = [np.full((4, 4), 0.5 + 0.02 * i) for i in range(RULE.s2_min_ornek + 4)]
    floor = er.period_percentile(enough, RULE)
    assert np.isfinite(floor).all() and floor[0, 0] == pytest.approx(np.percentile([0.5 + 0.02 * i for i in range(RULE.s2_min_ornek + 4)], 10))
    assert er.circular_doy_gap(date(2020, 1, 3), date(2019, 12, 30)) <= 6 and er.circular_doy_gap(date(2020, 6, 1), date(2019, 6, 10)) == 8


def test_persistence_requires_the_following_scene_to_stay_below_the_floor() -> None:
    patch = np.zeros((40, 40), dtype=bool)
    patch[5:25, 5:25] = True
    following = np.full((40, 40), 0.7)
    following[5:25, 5:25] = 0.55  # hâlâ p10 altında
    assert er.s2_persists(following, floor_grid(), patch, RULE)
    recovered = np.full((40, 40), 0.7)  # toparlandı: tek görüntülük düşüş
    assert not er.s2_persists(recovered, floor_grid(), patch, RULE)
    half = np.full((40, 40), 0.7)
    half[5:15, 5:25] = 0.55  # yamanın yarısı sürüyor: eşik %50 → sürer
    assert er.s2_persists(half, floor_grid(), patch, RULE)


def candidate(day: int = 20) -> er.Signal:
    return er.Signal("s2_dusus", D0 + timedelta(days=day - 5), D0 + timedelta(days=day), "orta", alan_da=12.0)


def test_recovered_drop_is_an_atmosphere_suspicion_and_a_drop_in_the_latest_scene_waits_for_confirmation() -> None:
    today = D0 + timedelta(days=25)
    assert er.classify_s2(candidate(), True, 0.4, [], RULE, today).durum == "olay"
    recovered = er.classify_s2(candidate(), False, 0.4, [], RULE, today)
    assert recovered.durum == "suphe" and recovered.ayrinti["neden"] == "toparlandi"
    waiting = er.classify_s2(candidate(), None, 0.4, [], RULE, today)  # en son sahne: sonraki net görüntü henüz yok
    assert waiting.durum == "bekliyor" and "neden" not in waiting.ayrinti  # ŞÜPHE DEĞİL: doğrulama bekliyor
    stale = er.classify_s2(candidate(), None, 0.4, [], RULE, D0 + timedelta(days=20 + RULE.s2_azami_aralik_gun + 1))
    assert stale.durum == "suphe" and stale.ayrinti["neden"] == "teyit_edilemedi"  # sonraki görüntü uzun süre gelmedi: doğrulanamadı


def test_a_pending_drop_is_its_own_event_with_medium_confidence_never_merged() -> None:
    frost = sig("don", 18, siddet="normal")
    waiting = er.classify_s2(candidate(), None, 0.4, [], RULE, D0 + timedelta(days=25))
    events = er.build_events([frost, waiting], RULE)
    pending = next(e for e in events if e.durum == "bekliyor")
    assert pending.guven == "orta" and pending.tur == "s2_dusus" and pending.anahtar.startswith("s2_dusus:") and len(events) == 2


def test_a_drop_over_ninety_percent_of_the_garden_needs_weather_or_radar_support_within_five_days() -> None:
    frost = er.Signal("don", D0 + timedelta(days=18), D0 + timedelta(days=18), "orta", siddet="normal")
    far = er.Signal("don", D0 + timedelta(days=40), D0 + timedelta(days=40), "orta")
    radar = er.Signal("radar_degisim", D0 + timedelta(days=24), D0 + timedelta(days=24), "orta")
    assert er.classify_s2(candidate(), True, 0.95, [], RULE).ayrinti["neden"] == "tum_bahce_destek_yok"
    assert er.classify_s2(candidate(), True, 0.95, [far], RULE).durum == "suphe"  # destek ±5 gün dışında
    assert er.classify_s2(candidate(), True, 0.95, [frost], RULE).durum == "olay"
    assert er.classify_s2(candidate(), True, 0.95, [radar], RULE).durum == "olay"
    assert er.classify_s2(candidate(), True, 0.90, [], RULE).durum == "olay"  # %90 sınırın üstü değil (> 0,90 gerekir)
    assert er.classify_s2(candidate(), True, 0.5, [], RULE).durum == "olay"  # kısmi düşüş destek istemez


def test_suspicions_are_recorded_separately_never_merged_and_have_low_confidence() -> None:
    frost = sig("don", 18, siddet="normal")
    suspect = er.classify_s2(candidate(), False, 0.4, [], RULE)
    events = er.build_events([frost, suspect], RULE)
    assert [e.durum for e in events].count("suphe") == 1 and [e.durum for e in events].count("olay") == 1
    s = next(e for e in events if e.durum == "suphe")
    assert s.tur == "s2_suphe" and s.guven == "dusuk" and s.anahtar.startswith("s2_suphe:")


def sig(tur, start, end=None, guven="orta", **kw):  # noqa: ANN001, ANN003, ANN201
    return er.Signal(tur, D0 + timedelta(days=start), D0 + timedelta(days=start if end is None else end), guven, **kw)


def test_signals_within_five_days_become_one_event_and_confidence_grows_with_source_families() -> None:
    frost = sig("don", 0, siddet="normal")
    s2 = sig("s2_dusus", 3, alan_da=12.0)
    radar = sig("radar_degisim", 5)
    events = er.build_events([frost, s2, radar], RULE)
    assert len(events) == 1
    e = events[0]
    assert e.tur == "don" and e.turler == ("don", "s2_dusus", "radar_degisim") and e.guven == "yuksek" and e.alan_da == 12.0 and e.katman == "degisim" and e.siddet == "normal"
    assert e.baslangic == D0 and e.bitis == D0 + timedelta(days=5)
    # 6 gün sonraki sinyal ayrı olay
    separate = er.build_events([frost, sig("s2_dusus", 40, alan_da=9.0)], RULE)
    assert len(separate) == 2  # don sonrası 21 günden sonra başlayan düşüş ayrı olay (21 gün içindeyse hasar izi olarak bağlanır)


def test_confidence_levels_single_sources_and_combinations() -> None:
    assert er.confidence([sig("don", 0)], RULE) == "orta"
    assert er.confidence([sig("ruzgar", 0, guven="dusuk")], RULE) == "dusuk"  # tek düşük güvenli sinyal
    assert er.confidence([sig("s2_dusus", 0), sig("radar_degisim", 1)], RULE) == "yuksek"
    assert er.confidence([sig("s2_dusus", 0), sig("ruzgar", 1, guven="dusuk")], RULE) == "orta"  # 2 + 1 = 3
    assert er.confidence([sig("don", 0), sig("asiri_yagis", 1)], RULE) == "orta"  # aynı aile (hava) iki kez sayılmaz


def test_chained_signals_cannot_make_an_unbounded_event() -> None:
    chain = [sig("ruzgar", i * 4, guven="dusuk") for i in range(6)]  # her biri 4 gün arayla: zincirleme 20 güne yayılırdı
    events = er.build_events(chain, RULE)
    assert len(events) >= 2 and all((e.bitis - e.baslangic).days <= RULE.birlestirme_azami_sure_gun for e in events)


def test_event_key_is_stable_and_forecast_flag() -> None:
    e = er.build_events([sig("don", 2)], RULE)[0]
    assert e.anahtar == f"don:{D0 + timedelta(days=2)}" and er.is_forecast(e, D0) and not er.is_forecast(e, D0 + timedelta(days=3))


def test_s2_drop_after_frost_within_21_days_joins_the_frost_event_as_damage_trace_with_high_confidence() -> None:
    frost = sig("don", 0, 1, siddet="siddetli")  # gün 0–1
    after = sig("s2_dusus", 6, 15, alan_da=12.0)  # önceki görüntü 5. gün, düşüşü gören görüntü 15. gün → düşüş don sonrası başlayabilir
    far = sig("s2_dusus", 40, 50, alan_da=9.0)  # don bitişinden 21 günden sonra başlayabilir
    before = sig("s2_dusus", -20, -10, alan_da=7.0)  # donu gören görüntü donundan ÖNCE: iz değil
    events = er.build_events([frost, after, far, before], RULE)
    merged = next(e for e in events if e.tur == "don")
    assert merged.turler == ("don", "s2_dusus") and merged.guven == "yuksek" and merged.alan_da == 12.0 and merged.siddet == "siddetli"
    assert merged.baslangic == D0 and merged.bitis == D0 + timedelta(days=15)  # birleşik olay hasar penceresini kapsar (10 günlük sınır muaf)
    assert sorted(e.tur for e in events) == ["don", "s2_dusus", "s2_dusus"]  # uzak ve önceki düşüşler AYRI olay


def test_damage_window_overlap_rule_uses_when_the_drop_could_have_started() -> None:
    frost = sig("don", 10, 12)
    assert er.frost_precedes(frost, sig("s2_dusus", 11, 40), RULE)  # önceki görüntü don sırasında: düşüş donla birlikte/sonra başlamış olabilir
    assert er.frost_precedes(frost, sig("s2_dusus", 12 + RULE.don_hasar_gun, 60), RULE) and not er.frost_precedes(frost, sig("s2_dusus", 12 + RULE.don_hasar_gun + 1, 60), RULE)
    assert not er.frost_precedes(frost, sig("s2_dusus", 0, 11), RULE)  # düşüşü gören görüntü donun bitişinden önce


def test_a_whole_garden_drop_is_supported_by_a_frost_in_the_previous_21_days() -> None:
    frost = er.Signal("don", D0 + timedelta(days=2), D0 + timedelta(days=3), "orta", siddet="normal")
    cand = er.Signal("s2_dusus", D0 + timedelta(days=15), D0 + timedelta(days=24), "orta", alan_da=12.0)  # don 21 gün penceresinde, ±5 gün dışında
    assert er.classify_s2(cand, True, 0.97, [frost], RULE).durum == "olay"
    old_frost = er.Signal("don", D0 - timedelta(days=30), D0 - timedelta(days=29), "orta")
    assert er.classify_s2(cand, True, 0.97, [old_frost], RULE).durum == "suphe"


def test_merged_same_kind_signals_keep_the_extreme_value_not_the_last_one() -> None:
    first = er.Signal("don", D0, D0 + timedelta(days=1), "orta", siddet="siddetli", ayrinti={"en_dusuk_c": -4.5})
    second = er.Signal("don", D0 + timedelta(days=3), D0 + timedelta(days=3), "orta", siddet="normal", ayrinti={"en_dusuk_c": -0.1})
    (event,) = er.build_events([first, second], RULE)
    assert event.ayrinti["don.en_dusuk_c"] == -4.5 and event.siddet == "siddetli"


# ----------------------------------------------------------------------------- dona bağlı değişim anomalisi
OTHERS = [-0.01, 0.0, -0.02, 0.01, -0.03, 0.0, -0.015, 0.005, -0.04, -0.02, 0.01, -0.005]


def test_change_anomaly_needs_a_delta_below_the_other_years_p10_and_enough_samples() -> None:
    p10 = er.anomaly_threshold(OTHERS, RULE)
    assert p10 is not None and -0.04 <= p10 <= -0.025
    assert er.is_change_anomaly(-0.10, OTHERS, RULE) and not er.is_change_anomaly(-0.01, OTHERS, RULE)
    assert not er.is_change_anomaly(0.05, OTHERS, RULE)  # artış anomali değil
    assert er.anomaly_threshold(OTHERS[: RULE.anomali_min_ornek - 1], RULE) is None
    assert not er.is_change_anomaly(-0.5, OTHERS[:2], RULE)  # örnek yetersiz: karşılaştırılamaz, olay üretmez


def test_change_anomaly_persistence_requires_half_of_the_drop_to_remain() -> None:
    assert er.anomaly_persists(-0.10, -0.08, RULE) is True  # sonraki görüntüde düşüşün %80'i sürüyor
    assert er.anomaly_persists(-0.10, -0.03, RULE) is False  # büyük kısmı toparlandı
    assert er.anomaly_persists(-0.10, None, RULE) is None  # sonraki net görüntü yok
