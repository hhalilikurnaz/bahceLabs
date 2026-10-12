"""Yıl veri yeterliliği (SAF): bir yılın analiz penceresindeki net sahne sayısı ve zamansal kapsamı.

«Yetersiz veri» ile «uyumsuz yıl» farklıdır: yetersiz yıl (ör. arşivin başladığı 2015, tek sahneli 2016) kompozitte gösterilir ama analize
girmez ve kullanıcıya uyumsuzluk sorusu sorulmaz. Eşikler ürün kataloğundaki analiz penceresindedir («ön değer»).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

PERIOD_DAYS = 10  # zamansal kapsam dönemi (gün); seçim ve yeterlilik aynı dönemi kullanır


@dataclass(frozen=True)
class Sufficiency:
    net_scenes: int
    net_days: int  # farklı gün sayısı (aynı gün birden çok karo tek sayılır)
    periods_covered: int
    period_count: int
    period_coverage: float  # en az bir net sahne olan 10 günlük dönemlerin payı (0–1)
    insufficient: bool
    reason: str | None


def period_count(first: date, last: date, period_days: int) -> int:
    """Pencerenin kaç (kısmi dahil) dönem içerdiği."""
    span = (last - first).days + 1
    return -(-span // period_days)


def assess_sufficiency(
    scene_dates: list[date], first: date, last: date, *, min_scenes: int, min_period_coverage: float, period_days: int
) -> Sufficiency:
    inside = sorted({d for d in scene_dates if first <= d <= last})
    total = period_count(first, last, period_days)
    covered = len({(d - first).days // period_days for d in inside})
    coverage = round(covered / total, 3) if total else 0.0
    reason: str | None = None
    if len(inside) < min_scenes:
        reason = f"Yetersiz veri: {len(inside)} net sahne (en az {min_scenes} gerekir)"
    elif coverage < min_period_coverage:
        reason = f"Yetersiz veri: net sahneler {total} dönemin yalnızca {covered}'ini kapsıyor (en az %{min_period_coverage * 100:.0f} gerekir)"
    return Sufficiency(len(inside), len(inside), covered, total, coverage, reason is not None, reason)
