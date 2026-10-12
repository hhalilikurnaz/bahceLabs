"""Ay bazlı sahne seçimi ve ay aralıkları (SAF). Bütçe: ay başına en iyi N net sahne, aralarında en az G gün (ADR 0015)."""

from __future__ import annotations

from datetime import date, timedelta


def month_first(d: date) -> date:
    return d.replace(day=1)


def month_last(first: date) -> date:
    nxt = date(first.year + 1, 1, 1) if first.month == 12 else date(first.year, first.month + 1, 1)
    return nxt - timedelta(days=1)


def months_between(start: date, end: date) -> list[date]:
    """`start` ayından `end` ayına (dahil) ayların ilk günleri."""
    out: list[date] = []
    cur = month_first(start)
    while cur <= month_first(end):
        out.append(cur)
        cur = date(cur.year + 1, 1, 1) if cur.month == 12 else date(cur.year, cur.month + 1, 1)
    return out


def is_spaced(candidate: date, accepted: list[date], min_gap_days: int) -> bool:
    """Aday tarih, kabul edilmiş net sahnelerden en az `min_gap_days` gün uzakta mı."""
    return all(abs((candidate - d).days) >= min_gap_days for d in accepted)


def next_candidate_order(candidates: list[tuple[date, float | None, str]]) -> list[tuple[date, float | None, str]]:
    """Okuma sırası: en az bulutlu önce (bulut bilinmiyorsa sona), eşitlikte erken tarih."""
    return sorted(candidates, key=lambda c: (c[1] if c[1] is not None else 101.0, c[0]))
