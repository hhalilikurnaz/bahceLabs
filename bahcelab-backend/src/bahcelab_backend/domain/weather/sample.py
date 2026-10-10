"""Ağsız demo için deterministik örnek hava verisi (Akdeniz kıyısı iklimine yakın, `kaynak = ornek`)."""

from __future__ import annotations

import math
from datetime import date, datetime, timedelta

from bahcelab_backend.domain.weather.provider import Current, DailyPoint, Forecast, HourlyPoint

RAINY_DAYS = {3}  # tahminde 3. gün yağışlı


def _seasonal_mean(day: date) -> float:
    """Yıllık ortalama ~19 °C, ±9 °C; en sıcak ay Temmuz sonu."""
    phase = (day.timetuple().tm_yday - 205) / 365 * 2 * math.pi
    return 19.0 + 9.0 * math.cos(phase)


def _day_values(day: date) -> tuple[float, float, float, float]:
    """(min, max, yağış mm, ET₀ mm) — gün numarasından türeyen deterministik dalgalanma."""
    wiggle = math.sin(day.toordinal() * 1.7) * 2.0
    mean = _seasonal_mean(day) + wiggle
    tmin, tmax = mean - 5.0, mean + 5.5
    rain_signal = math.sin(day.toordinal() * 0.9) + math.cos(day.toordinal() * 0.37)
    month_wet = 1.0 if day.month in (10, 11, 12, 1, 2, 3) else 0.15
    rain = round(max(0.0, rain_signal - 1.1) * 9.0 * month_wet, 1)
    et0 = round(max(0.4, 0.35 * (tmax - 4.0) / 2.0 - rain * 0.05), 2)
    return round(tmin, 1), round(tmax, 1), rain, et0


def build_sample_history(today: date, days: int) -> list[DailyPoint]:
    points = []
    for i in range(days, 0, -1):
        day = today - timedelta(days=i)
        tmin, tmax, rain, et0 = _day_values(day)
        points.append(DailyPoint(tarih=day, min=tmin, max=tmax, yagis=rain, et0=et0))
    return points


def build_sample_forecast(now: datetime) -> Forecast:
    """Bugünden itibaren 7 gün saatlik + son 7 gün günlük."""
    today = now.date()
    daily: list[DailyPoint] = []
    hourly: list[HourlyPoint] = []
    for offset in range(-7, 7):
        day = today + timedelta(days=offset)
        tmin, tmax, rain, et0 = _day_values(day)
        if offset in RAINY_DAYS:
            rain = max(rain, 7.5)
        rainy = rain >= 1.0
        daily.append(
            DailyPoint(
                tarih=day,
                min=tmin,
                max=tmax,
                yagis=rain,
                et0=et0,
                kod=63 if rainy else (2 if offset % 3 == 0 else 0),
                yagis_olasiligi=80.0 if rainy else 10.0,
                ruzgar_max=18.0 if rainy else 12.0,
                hamle_max=30.0 if rainy else 21.0,
            )
        )
        if offset < 0:
            continue
        for hour in range(24):
            # Gün içi sıcaklık: 05:00 en düşük, 15:00 en yüksek
            frac = (math.cos((hour - 15) / 24 * 2 * math.pi) + 1) / 2
            wind = 8.0 + 8.0 * math.sin((hour - 9) / 24 * 2 * math.pi) ** 2 + (6.0 if rainy else 0.0)
            in_rain = rainy and 8 <= hour <= 15
            hourly.append(
                HourlyPoint(
                    zaman=f"{day.isoformat()}T{hour:02d}:00",
                    sicaklik=round(tmin + (tmax - tmin) * frac, 1),
                    nem=round(75 - 30 * frac + (10 if rainy else 0), 0),
                    yagis=round(rain / 8, 1) if in_rain else 0.0,
                    yagis_olasiligi=80.0 if rainy and 5 <= hour <= 17 else 10.0,
                    ruzgar=round(wind, 1),
                    hamle=round(wind * 1.6, 1),
                    et0=round(et0 / 24 * 2 * frac, 2),
                    kod=63 if in_rain else (2 if offset % 3 == 0 else 0),
                )
            )
    h = now.hour
    current = hourly[min(h, len(hourly) - 1)]
    return Forecast(
        current=Current(
            zaman=now.strftime("%Y-%m-%dT%H:%M"),
            sicaklik=current.sicaklik,
            hissedilen=round(current.sicaklik - 1.0, 1),
            nem=current.nem,
            yagis=current.yagis,
            ruzgar=current.ruzgar,
            hamle=current.hamle,
            yon=270.0,
            kod=current.kod,
            gunduz=6 <= h < 19,
        ),
        hourly=hourly,
        daily=daily,
    )
