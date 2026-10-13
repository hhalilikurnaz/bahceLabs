"""Bahçe poligonu maskesi: saklanan gösterge ızgaraları kanonik bbox'ı doldurur (poligon dışı pikseller de sonludur); okurken poligon dışı NaN yapılır.

Böylece histogram, ortanca, yüzdelik sırası ve değişim alan payı YALNIZ bahçe pikselleriyle hesaplanır (istatistik tablosuyla tutarlı).
"""

from __future__ import annotations

from typing import Any

import numpy as np

from bahcelab_backend.domain.multiyear.grid import canonical_grid, garden_mask


def mask_for(geometry: dict[str, Any]) -> np.ndarray:
    grid = canonical_grid(geometry)
    return garden_mask(grid, geometry)


def apply(grid: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """Poligon dışı = NaN (şekil uyuşmuyorsa ızgara olduğu gibi döner)."""
    return np.where(mask, grid, np.nan).astype(grid.dtype) if grid.shape == mask.shape else grid
