"""Yıllık kompozit (SAF): ürün kataloğundaki analiz penceresinde net sahnelerin piksel medyanı."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from itertools import zip_longest

import numpy as np

from bahcelab_backend.domain.imagery.provider import SceneRef
from bahcelab_backend.domain.multiyear.grid import CanonicalGrid, align_to_grid
from bahcelab_backend.domain.ndvi.indices import compute_index
from bahcelab_backend.domain.ndvi.processing import MIN_VALID_RATIO, SceneBands


def window_dates(year: int, month_start: int, month_end: int) -> tuple[date, date]:
    """Analiz penceresi (ay_baslangic ayının 1'i … ay_bitis ayının son günü)."""
    first = date(year, month_start, 1)
    last = date(year + 1, 1, 1) if month_end == 12 else date(year, month_end + 1, 1)
    return first, date.fromordinal(last.toordinal() - 1)


def spread_by_period(candidates: list[SceneRef], first: date, period_days: int) -> list[SceneRef]:
    """Okuma sırası: her dönemin (ör. 10 gün) en az bulutlu sahnesi önce, sonra ikinciler… Sahne bütçesi dolarsa bile yıl boyunca
    zamansal kapsam korunur (aksi halde en temiz sahneler birkaç döneme yığılır ve yıl «yetersiz» görünür)."""
    by_period: dict[int, list[SceneRef]] = {}
    for ref in sorted(candidates, key=lambda s: (s.bulut_orani if s.bulut_orani is not None else 100.0, s.tarih)):
        by_period.setdefault((ref.tarih - first).days // period_days, []).append(ref)
    rounds = zip_longest(*(by_period[p] for p in sorted(by_period)))
    return [ref for rnd in rounds for ref in rnd if ref is not None]


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
