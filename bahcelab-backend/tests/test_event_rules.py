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


def test_s2_drop_needs_a_contiguous_patch_not_scattered_pixels() -> None:
    prev, cur = grids()
    cur[5:25, 5:25] -= 0.15  # 20×20 = 400 piksel = 40 da bitişik düşüş, delta 0,15 ≥ 0,08
    patch = er.s2_patch(prev, cur, RULE)
    assert patch is not None and patch[0] == pytest.approx(40.0, rel=0.2) and patch[1] <= -0.08 and patch[2] >= 300
    prev, cur = grids()
    rng = np.random.default_rng(0)
    idx = rng.choice(1600, size=500, replace=False)  # dağınık %31 piksel: toplamda pay yüksek ama tek yama yok
    cur.ravel()[idx] -= 0.15
    assert er.s2_patch(prev, cur, RULE) is None
    prev, cur = grids()
    cur[5:9, 5:9] -= 0.15  # 16 piksel = 1,6 da < min(%25, 5 da)
    assert er.s2_patch(prev, cur, RULE) is None
    prev, cur = grids()
    cur[5:25, 5:25] -= 0.05  # eşik altı düşüş
    assert er.s2_patch(prev, cur, RULE) is None


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
    separate = er.build_events([frost, sig("s2_dusus", 7, alan_da=9.0)], RULE)
    assert len(separate) == 2


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
