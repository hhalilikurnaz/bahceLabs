"""Bulut/gölge maskeleri (sağlayıcıya özgü sınıflandırmadan sağlayıcıdan bağımsız `valid` maskesine)."""

from __future__ import annotations

import numpy as np

# Sentinel-2 SCL sınıfları: 3 bulut gölgesi, 8 orta olasılıklı bulut, 9 yüksek olasılıklı bulut, 10 ince bulut
MASKED_SCL = (3, 8, 9, 10)


def scl_valid_mask(scl: np.ndarray) -> np.ndarray:
    """Bulut/bulut gölgesi sınıfları (3, 8, 9, 10) dışındaki pikseller geçerlidir."""
    return ~np.isin(scl, MASKED_SCL)
