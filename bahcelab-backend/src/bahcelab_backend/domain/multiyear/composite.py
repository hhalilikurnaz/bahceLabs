"""Yıllık kompozit (SAF): ürün kataloğundaki analiz penceresinde net sahnelerin piksel medyanı."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

import numpy as np


def window_dates(year: int, month_start: int, month_end: int) -> tuple[date, date]:
    """Analiz penceresi (ay_baslangic ayının 1'i … ay_bitis ayının son günü)."""
    first = date(year, month_start, 1)
    last = date(year + 1, 1, 1) if month_end == 12 else date(year, month_end + 1, 1)
    return first, date.fromordinal(last.toordinal() - 1)


@dataclass(frozen=True)
class Composite:
    values: np.ndarray  # (H, W) float32 medyan, geçersiz = NaN
    scene_count: int


def median_composite(maps: list[np.ndarray]) -> Composite | None:
    if not maps:
        return None
    stack = np.stack(maps)
    with np.errstate(all="ignore"):
        values = np.nanmedian(stack, axis=0).astype(np.float32)
    return Composite(values, len(maps))
