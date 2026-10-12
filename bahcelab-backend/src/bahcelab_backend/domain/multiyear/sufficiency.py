"""Yıl veri yeterliliği (SAF): bir yılın analiz penceresindeki net sahne sayısı ve AY kapsamı.

«Yetersiz veri» ile «uyumsuz yıl» farklıdır: yetersiz yıl (ör. arşivin başladığı 2015) kompozitte gösterilir ama analize girmez ve kullanıcıya
uyumsuzluk sorusu sorulmaz. Eşikler ürün kataloğundaki analiz penceresindedir («ön değer»). Sahne bütçesi ay başına en iyi 2 net sahne olduğundan
kapsam ay biriminde ölçülür: pencerenin kaç ayında en az bir net sahne var.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class Sufficiency:
    net_scenes: int
    net_days: int  # farklı gün sayısı (aynı gün birden çok karo tek sayılır)
    periods_covered: int  # net sahnesi olan ay sayısı
    period_count: int  # penceredeki ay sayısı
    period_coverage: float  # net sahnesi olan ayların payı (0–1)
    insufficient: bool
    reason: str | None


def window_months(first: date, last: date) -> list[tuple[int, int]]:
    """Pencerenin (yıl, ay) listesi."""
    out: list[tuple[int, int]] = []
    y, m = first.year, first.month
    while (y, m) <= (last.year, last.month):
        out.append((y, m))
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return out


def period_count(first: date, last: date) -> int:
    return len(window_months(first, last))


def assess_sufficiency(scene_dates: list[date], first: date, last: date, *, min_scenes: int, min_month_coverage: float) -> Sufficiency:
    inside = sorted({d for d in scene_dates if first <= d <= last})
    months = window_months(first, last)
    covered = len({(d.year, d.month) for d in inside})
    coverage = round(covered / len(months), 3) if months else 0.0
    reason: str | None = None
    if len(inside) < min_scenes:
        reason = f"Yetersiz veri: {len(inside)} net sahne (en az {min_scenes} gerekir)"
    elif coverage < min_month_coverage:
        reason = f"Yetersiz veri: net sahneler {len(months)} ayın yalnızca {covered}'ini kapsıyor (en az %{min_month_coverage * 100:.0f} gerekir)"
    return Sufficiency(len(inside), len(inside), covered, len(months), coverage, reason is not None, reason)
