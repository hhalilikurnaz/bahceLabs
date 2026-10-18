"""Uydu uyarıları için bahçenin kendi tabanı (geçen yılın aynı dönemi ya da son günleri). Durum kademesi bunu KULLANMAZ (Durum v2, ADR 0018); yalnız `ndvi/rules.build_alerts`."""

from __future__ import annotations

import statistics
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Literal

from bahcelab_backend.config import Settings, get_settings

Series = list[tuple[date, float]]


@dataclass(frozen=True)
class BaselineConfig:
    period_half_window_days: int
    period_min_points: int
    fallback_window_days: int
    fallback_exclude_days: int
    fallback_min_points: int
    fallback_min_span_days: int

    @classmethod
    def from_settings(cls, s: Settings | None = None) -> BaselineConfig:
        s = s or get_settings()
        return cls(
            s.baseline_period_half_window_days,
            s.baseline_period_min_points,
            s.baseline_fallback_window_days,
            s.baseline_fallback_exclude_days,
            s.baseline_fallback_min_points,
            s.baseline_fallback_min_span_days,
        )


@dataclass(frozen=True)
class Baseline:
    deger: float
    kaynak: Literal["gecmis_sezon", "son_gunler"]
    nokta_sayisi: int


def baseline(series: Series, latest: date, cfg: BaselineConfig) -> Baseline | None:
    """Önce geçen yılların AYNI dönemi (±pencere), yoksa son 60–90 günün kendi tabanı; ikisi de yoksa None."""
    values: list[float] = []
    for years in (1, 2):
        try:
            anchor = latest.replace(year=latest.year - years)
        except ValueError:
            anchor = latest.replace(year=latest.year - years, day=28)
        half = timedelta(days=cfg.period_half_window_days)
        values += [v for d, v in series if anchor - half <= d <= anchor + half]
    if len(values) >= cfg.period_min_points:
        return Baseline(statistics.median(values), "gecmis_sezon", len(values))

    start = latest - timedelta(days=cfg.fallback_window_days)
    end = latest - timedelta(days=cfg.fallback_exclude_days)
    window = [(d, v) for d, v in series if start <= d <= end]
    if (
        len(window) >= cfg.fallback_min_points
        and (window[-1][0] - window[0][0]).days >= cfg.fallback_min_span_days
    ):
        return Baseline(statistics.median(v for _, v in window), "son_gunler", len(window))
    return None
