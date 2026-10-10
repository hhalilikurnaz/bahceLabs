from datetime import date, timedelta

from bahcelab_backend.domain.weather import rules
from bahcelab_backend.domain.weather.provider import DailyPoint, HourlyPoint


def hours(count: int = 12, start_hour: int = 6, **overrides) -> list[HourlyPoint]:
    base = {
        "sicaklik": 20.0,
        "ruzgar": 8.0,
        "hamle": 14.0,
        "yagis": 0.0,
        "yagis_olasiligi": 5.0,
    }
    base.update(overrides)
    return [
        HourlyPoint(zaman=f"2026-10-12T{start_hour + i:02d}:00", **base) for i in range(count)
    ]


def status(**overrides) -> rules.SprayHour:
    return rules.classify_spray_hours(hours(**overrides))[0]


# --- ilaçlama penceresi
def test_calm_dry_mild_hour_is_suitable():
    result = status()
    assert result.durum == "uygun"
    assert result.nedenler == ["Rüzgâr, yağış ve sıcaklık koşulları uygun."]


def test_wind_thresholds():
    assert status(ruzgar=14.9).durum == "uygun"
    assert status(ruzgar=15.0).durum == "sinirda"
    assert status(ruzgar=19.9).durum == "sinirda"
    assert status(ruzgar=20.0).durum == "uygun_degil"


def test_gust_thresholds():
    assert status(hamle=24.9).durum == "uygun"
    assert status(hamle=25.0).durum == "sinirda"
    assert status(hamle=32.0).durum == "uygun_degil"


def test_rain_in_the_hour_is_never_suitable():
    result = status(yagis=0.1)
    assert result.durum == "uygun_degil"
    assert "yağış var" in result.nedenler[0]


def test_precipitation_probability_in_next_six_hours():
    data = hours(12)
    data[6] = data[6].model_copy(update={"yagis_olasiligi": 35.0})
    result = rules.classify_spray_hours(data)
    assert result[0].durum == "sinirda"  # 6 saat sonrası pencerede
    assert result[5].durum == "sinirda"
    data[6] = data[6].model_copy(update={"yagis_olasiligi": 60.0})
    assert rules.classify_spray_hours(data)[0].durum == "uygun_degil"
    # Pencerenin (6 saat) dışındaki saat etkilenmez
    far = hours(12)
    far[11] = far[11].model_copy(update={"yagis_olasiligi": 90.0})
    assert rules.classify_spray_hours(far)[0].durum == "uygun"


def test_temperature_band():
    assert status(sicaklik=10.0).durum == "uygun"
    assert status(sicaklik=28.0).durum == "uygun"
    assert status(sicaklik=9.0).durum == "sinirda"
    assert status(sicaklik=29.0).durum == "sinirda"
    assert status(sicaklik=7.0).durum == "uygun_degil"
    assert status(sicaklik=31.0).durum == "uygun_degil"


def test_worst_condition_wins_and_all_reasons_are_listed():
    result = status(ruzgar=16.0, sicaklik=31.0)
    assert result.durum == "uygun_degil"
    assert len(result.nedenler) == 2


def test_day_summary_counts_and_best_window():
    data = hours(10, start_hour=6)
    data[3] = data[3].model_copy(update={"ruzgar": 22.0})  # 09:00 uygun değil
    spray = rules.classify_spray_hours(data)
    summary = rules.summarize_spray_day([(h.zaman, s) for h, s in zip(data, spray, strict=True)])
    assert (summary.uygun_saat, summary.uygun_degil_saat) == (9, 1)
    assert summary.en_iyi_aralik == ("10:00", "16:00")  # 10:00–15:00 en uzun kesintisiz aralık


def test_day_without_suitable_hours_has_no_window():
    data = hours(4, ruzgar=30.0)
    spray = rules.classify_spray_hours(data)
    summary = rules.summarize_spray_day([(h.zaman, s) for h, s in zip(data, spray, strict=True)])
    assert summary.en_iyi_aralik is None and summary.uygun_saat == 0


# --- don ve sıcak
def night(temps: list[float], first_hour: int = 22, day: str = "2026-10-12") -> list[HourlyPoint]:
    points = []
    for i, t in enumerate(temps):
        hour = first_hour + i
        d = day if hour < 24 else "2026-10-13"
        points.append(HourlyPoint(zaman=f"{d}T{hour % 24:02d}:00", sicaklik=t))
    return points


def test_no_alert_above_two_degrees():
    assert rules.frost_alerts(night([6, 4, 3.5, 3]), "2026-10-12T20:00") == []


def test_frost_risk_is_yellow_with_duration():
    (alert,) = rules.frost_alerts(night([4, 2, 1.5, 1, 2, 5]), "2026-10-12T20:00")
    assert alert.seviye == "sari" and alert.baslik == "Don riski"
    assert alert.sure_saat == 4
    assert alert.deger == 1.0
    assert alert.baslangic == "2026-10-12T23:00"


def test_frost_danger_is_red_at_zero_or_below():
    (alert,) = rules.frost_alerts(night([3, 1, 0, -1.5, -0.5, 2, 4]), "2026-10-12T20:00")
    assert alert.seviye == "kirmizi" and alert.baslik == "Don tehlikesi"
    assert alert.deger == -1.5
    assert "3 saat 0 °C" in alert.mesaj


def test_exactly_two_and_zero_degrees_are_inclusive():
    assert rules.frost_alerts(night([2.0]), "2026-10-12T20:00")[0].seviye == "sari"
    assert rules.frost_alerts(night([0.0]), "2026-10-12T20:00")[0].seviye == "kirmizi"


def test_past_hours_are_ignored():
    assert rules.frost_alerts(night([-3, -3]), "2026-10-13T10:00") == []


def test_separate_nights_give_separate_alerts():
    first = night([1, 1], first_hour=2)
    second = [
        HourlyPoint(zaman=f"2026-10-14T{h:02d}:00", sicaklik=-1.0) for h in (3, 4)
    ]
    assert len(rules.frost_alerts(first + second, "2026-10-12T00:00")) == 2


def daily(day: date, tmax: float) -> DailyPoint:
    return DailyPoint(tarih=day, min=tmax - 10, max=tmax)


def test_heat_threshold_is_38():
    today = date(2026, 7, 20)
    assert rules.heat_alerts([daily(today, 37.9)], today) == []
    (alert,) = rules.heat_alerts([daily(today, 38.0), daily(today + timedelta(days=1), 39.4)], today)
    assert alert.seviye == "sari" and alert.deger == 39.4 and alert.sure_saat == 48
    (red,) = rules.heat_alerts([daily(today, 42.5)], today)
    assert red.seviye == "kirmizi"


def test_alerts_sorted_red_first():
    yellow = rules.frost_alerts(night([1.0], first_hour=2), "2026-10-12T00:00")[0]
    red = rules.heat_alerts([daily(date(2026, 10, 20), 43.0)], date(2026, 10, 12))[0]
    assert rules.sort_alerts([yellow, red])[0].seviye == "kirmizi"


# --- su dengesi ve yağış
def history(days: int, today: date, rain: float, et0: float) -> dict[date, DailyPoint]:
    return {
        today - timedelta(days=i): DailyPoint(tarih=today - timedelta(days=i), yagis=rain, et0=et0)
        for i in range(1, days + 1)
    }


def test_water_deficit():
    today = date(2026, 8, 10)
    balance = rules.water_balance(history(30, today, rain=0.2, et0=5.0), today, 7)
    assert balance is not None
    assert (balance.yagis_mm, balance.et0_mm, balance.denge_mm) == (1.4, 35.0, -33.6)
    assert rules.water_balance_note(balance).startswith("Son 7 günde su açığı 34 mm")


def test_water_surplus_and_missing_days():
    today = date(2026, 12, 10)
    rows = history(30, today, rain=10.0, et0=1.0)
    del rows[today - timedelta(days=2)]
    balance = rules.water_balance(rows, today, 7)
    assert balance is not None and balance.eksik_gun == 1 and balance.denge_mm == 54.0
    assert "aştı" in rules.water_balance_note(balance)


def test_water_balance_needs_data():
    assert rules.water_balance({}, date(2026, 10, 10), 7) is None


def test_season_start():
    assert rules.season_start(date(2026, 10, 10)) == date(2026, 9, 1)
    assert rules.season_start(date(2027, 3, 1)) == date(2026, 9, 1)
    assert rules.season_start(date(2026, 9, 1)) == date(2026, 9, 1)


def test_rain_total_with_last_year_comparison():
    today = date(2026, 10, 10)
    rows = {}
    for i in range(1, 400):
        day = today - timedelta(days=i)
        rows[day] = DailyPoint(tarih=day, yagis=2.0 if day.year == 2026 else 1.0)
    total = rules.rain_total(rows, today - timedelta(days=7), today - timedelta(days=1))
    assert total.mm == 14.0 and total.gecen_yil_mm == 7.0


def test_rain_total_is_none_when_data_is_mostly_missing():
    today = date(2026, 10, 10)
    rows = {today - timedelta(days=1): DailyPoint(tarih=today - timedelta(days=1), yagis=3.0)}
    total = rules.rain_total(rows, today - timedelta(days=7), today - timedelta(days=1))
    assert total.mm is None and total.gecen_yil_mm is None


def test_best_window_is_chosen_from_daytime_only():
    # Gece (00:00–04:00) uygun saatler olsa da pencere olarak önerilmez; 24:00 etiketi gün sonunu gösterir
    data = [
        HourlyPoint(zaman=f"2026-10-12T{h:02d}:00", sicaklik=20.0, ruzgar=5.0, hamle=8.0, yagis_olasiligi=0.0)
        for h in range(24)
    ]
    spray = rules.classify_spray_hours(data)
    summary = rules.summarize_spray_day([(h.zaman, s) for h, s in zip(data, spray, strict=True)])
    assert summary.uygun_saat == 24
    assert summary.en_iyi_aralik == ("05:00", "21:00")
