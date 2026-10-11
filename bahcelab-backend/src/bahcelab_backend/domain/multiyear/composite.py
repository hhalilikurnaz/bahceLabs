"""Yıllık kompozit (SAF): ürün kataloğundaki analiz penceresinde net sahnelerin piksel medyanı."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

import numpy as np

from bahcelab_backend.domain.multiyear.grid import CanonicalGrid, align_to_grid
from bahcelab_backend.domain.ndvi.indices import compute_index
from bahcelab_backend.domain.ndvi.processing import MIN_VALID_RATIO, SceneBands


def window_dates(year: int, month_start: int, month_end: int) -> tuple[date, date]:
    """Analiz penceresi (ay_baslangic ayının 1'i … ay_bitis ayının son günü)."""
    first = date(year, month_start, 1)
    last = date(year + 1, 1, 1) if month_end == 12 else date(year, month_end + 1, 1)
    return first, date.fromordinal(last.toordinal() - 1)


def net_index_map(scene: SceneBands, index_id: str, grid: CanonicalGrid, garden: np.ndarray) -> np.ndarray | None:
    """Sahnenin kanonik ızgaradaki indeks haritası (bulut/gölge ve veri yok = NaN). Bahçede geçerli piksel oranı < eşik
    ise (bulutlu) ya da ızgaraya hizalanamazsa None: sahne «net» değildir."""
    if not scene.bands:
        return None
    values = compute_index(index_id, scene.bands)
    values = np.where(scene.valid & np.isfinite(values), values, np.nan).astype(np.float32)
    aligned = align_to_grid(values, scene.transform, scene.crs.to_epsg(), grid)
    if aligned is None:
        return None
    total = int(garden.sum())
    if total == 0 or int((garden & np.isfinite(aligned)).sum()) / total < MIN_VALID_RATIO:
        return None
    return aligned


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
