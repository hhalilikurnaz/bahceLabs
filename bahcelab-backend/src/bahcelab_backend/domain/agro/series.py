"""Sezon serileri (SAF): birikmiş yağış ve GDD (etkili sıcaklık toplamı), bu sezon + geçen sezon aynı gün."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta


@dataclass(frozen=True)
class DayWeather:
    tarih: date
    tmin: float | None
    tmax: float | None
    yagis: float | None


@dataclass(frozen=True)
class SeriesDay:
    tarih: date
    tmin: float | None
    tmax: float | None
    yagis_mm: float | None
    yagis_birikimli_mm: float
    gdd: float | None
    gdd_birikimli: float | None


def daily_gdd(tmin: float | None, tmax: float | None, base_c: float | None) -> float | None:
    """max(0, (Tmax+Tmin)/2 − taban). Sıcaklık ya da taban yoksa None (uydurma değer yok)."""
    if tmin is None or tmax is None or base_c is None:
        return None
    return max(0.0, (tmax + tmin) / 2 - base_c)


def one_year_earlier(day: date) -> date:
    try:
        return day.replace(year=day.year - 1)
    except ValueError:  # 29 Şubat
        return day.replace(year=day.year - 1, day=28)


def build_season(
    rows: dict[date, DayWeather], start: date, end: date, base_c: float | None
) -> list[SeriesDay]:
    """`start`–`end` (dahil) günlük seri; eksik günlerde birikim önceki değerde kalır."""
    out: list[SeriesDay] = []
    rain_total = 0.0
    gdd_total = 0.0
    any_gdd = False
    day = start
    while day <= end:
        row = rows.get(day)
        rain = row.yagis if row else None
        if rain is not None:
            rain_total += rain
        g = daily_gdd(row.tmin, row.tmax, base_c) if row else None
        if g is not None:
            gdd_total += g
            any_gdd = True
        out.append(
            SeriesDay(
                tarih=day,
                tmin=row.tmin if row else None,
                tmax=row.tmax if row else None,
                yagis_mm=rain,
                yagis_birikimli_mm=round(rain_total, 1),
                gdd=round(g, 2) if g is not None else None,
                gdd_birikimli=round(gdd_total, 1) if (any_gdd or base_c is not None) else None,
            )
        )
        day += timedelta(days=1)
    return out


def coverage(rows: dict[date, DayWeather], start: date, end: date) -> float:
    """[start, end] aralığında yağış verisi olan günlerin oranı."""
    total = (end - start).days + 1
    if total <= 0:
        return 0.0
    have = sum(1 for i in range(total) if (r := rows.get(start + timedelta(days=i))) is not None and r.yagis is not None)
    return have / total
