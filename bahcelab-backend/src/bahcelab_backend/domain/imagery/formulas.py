"""Gösterge formülleri — TEK MODÜL (SAF). Arşiv işi sahneden bu beş göstergeyi hesaplayıp saklar; ham bant saklanmaz.

Formül değişirse `FORMULA_VERSION` artırılır; kayıtlar sürümü taşır ve arşivden yeniden hesaplanır (ADR 0015).
NDVI/NDMI/NDRE/MSAVI formülleri `ndvi/indices.py`'dedir (arayüzle ortak tanımlar); LAI `imagery/biophys.py`'dedir (SNAP port'u).
"""

from __future__ import annotations

import numpy as np

from bahcelab_backend.domain.imagery.biophys import FORMULA_VERSION as LAI_VERSION
from bahcelab_backend.domain.imagery.biophys import INPUT_ROLES as LAI_ROLES
from bahcelab_backend.domain.imagery.biophys import lai_from_bands
from bahcelab_backend.domain.imagery.roles import Band
from bahcelab_backend.domain.ndvi.indices import compute_index
from bahcelab_backend.domain.ndvi.processing import SceneBands

FORMULA_VERSION = f"f1+{LAI_VERSION}"
INDICATORS: tuple[str, ...] = ("ndvi", "ndmi", "ndre", "msavi", "lai")
# Arşiv çekiminde okunacak bant rolleri: dört indeks + LAI girdileri
ROLES_NEEDED: tuple[str, ...] = tuple(
    sorted({Band.RED.value, Band.NIR.value, Band.REDEDGE.value, Band.NIR_NARROW.value, Band.SWIR1.value, *LAI_ROLES})
)


def compute_indicators(scene: SceneBands) -> dict[str, np.ndarray]:
    """Sahne → {gösterge: float32 dizi}; bulut/gölge ve veri yok = NaN. LAI açı bilgisi yoksa üretilmez (diğerleri etkilenmez)."""
    valid = scene.valid
    out: dict[str, np.ndarray] = {}
    for name in ("ndvi", "ndmi", "ndre", "msavi"):
        values = compute_index(name, scene.bands)
        out[name] = np.where(valid & np.isfinite(values), values, np.nan).astype(np.float32)
    if scene.acilar is not None and all(role in scene.bands for role in LAI_ROLES):
        a = scene.acilar
        lai = lai_from_bands(
            scene.bands, sun_zenith=a.sun_zenith, sun_azimuth=a.sun_azimuth, view_zenith=a.view_zenith, view_azimuth=a.view_azimuth, parity=scene.parite
        )
        out["lai"] = np.where(valid & np.isfinite(lai), lai, np.nan).astype(np.float32)
    return out
