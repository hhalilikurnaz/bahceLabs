"""LAI (yaprak alan indeksi): SNAP/S2TBX biyofizik işlemcisi v2.1'in Python port'u (SAF; ağ yok).

Algoritma: Weiss & Baret (2016), ATBD. 11 girdi → [-1, 1] normalizasyon → 5 nöron tanh → doğrusal çıkış → denormalizasyon.
Girdi sırası: B03, B04, B05, B06, B07, B8A, B11, B12 (BOA yansıtımı 0–1) + cos(görüş zeniti) + cos(güneş zeniti) + cos(göreli azimut).
SNAP denetimleri korunur: (1) bant başına tanım alanı, (2) tanım alanının dışbükey zarfı (ızgara), (3) uç değerler (tolerans içi eşiklenir,
dışı geçersiz). Geçersiz = NaN (uydurma değer yok). Ağırlıklar ve lisans: `auxdata/snap_lai_v2_1/README.md`, ADR 0015.
Model 20 m içindir: 10 m bantlar (B03, B04) 2×2 blok ortalamasıyla 20 m'ye indirilir (bloklar Sentinel-2 20 m kafesine hizalı).
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import numpy as np

AUXDATA = Path(__file__).parent / "auxdata" / "snap_lai_v2_1"
FORMULA_VERSION = "snap-biophys-2.1"
# Girdi sırası (SNAP L2BInput): rol adları
INPUT_ROLES = ("green", "red", "rededge", "rededge2", "rededge3", "nir_narrow", "swir1", "swir2")
BANDS_10M_ROLES = ("green", "red")  # 20 m'ye blok ortalamasıyla indirilir


def _load(name: str) -> np.ndarray:
    return np.loadtxt(AUXDATA / name, delimiter=",", ndmin=1)


@dataclass(frozen=True)
class LaiNetwork:
    norm: np.ndarray  # (11, 2) min, max
    w1: np.ndarray  # (5, 11)
    b1: np.ndarray  # (5,)
    w2: np.ndarray  # (5,)
    b2: float
    denorm: tuple[float, float]
    extremes: tuple[float, float, float]  # tolerans, en küçük, en büyük
    domain: np.ndarray  # (2, 8) bant başına min/max
    grid_codes: frozenset[int]

    @classmethod
    def load(cls) -> LaiNetwork:
        return _cached()

    def extreme_cases(self) -> tuple[float, float]:
        return self.extremes[1], self.extremes[2]

    @staticmethod
    def _grid_code(cells: np.ndarray) -> np.ndarray:
        """Izgara hücre indekslerini (1…~11) tek tamsayıya çevirir (taban 16)."""
        code = np.zeros(cells.shape[:-1], dtype=np.int64)
        for k in range(cells.shape[-1]):
            code = code * 16 + cells[..., k].astype(np.int64)
        return code

    def input_in_domain(self, x: np.ndarray) -> np.ndarray:
        lo, hi = self.domain[0], self.domain[1]
        bands = x[:, :8]
        ok = np.all((bands >= lo) & (bands <= hi), axis=1)
        cells = np.floor(10 * (bands - lo) / (hi - lo) + 1)
        hull = np.isin(self._grid_code(np.where(ok[:, None], cells, 0)), np.fromiter(self.grid_codes, dtype=np.int64))
        return ok & hull

    def apply_extremes(self, raw: np.ndarray) -> np.ndarray:
        tol, low, high = abs(self.extremes[0]), self.extremes[1], self.extremes[2]
        out = raw.astype(np.float64).copy()
        out[raw < low - tol] = np.nan
        out[(raw >= low - tol) & (raw < low)] = low
        out[(raw > high) & (raw <= high + tol)] = high
        out[raw > high + tol] = np.nan
        return out

    def predict(self, x: np.ndarray) -> np.ndarray:
        """(N, 11) girdi → (N,) LAI; tanım alanı dışı ve uç değerler NaN."""
        x = np.asarray(x, dtype=np.float64)
        finite = np.all(np.isfinite(x), axis=1)
        safe = np.where(finite[:, None], x, 0.0)
        xn = 2.0 * (safe - self.norm[:, 0]) / (self.norm[:, 1] - self.norm[:, 0]) - 1.0
        hidden = np.tanh(xn @ self.w1.T + self.b1)
        raw = 0.5 * ((hidden @ self.w2 + self.b2) + 1.0) * (self.denorm[1] - self.denorm[0]) + self.denorm[0]
        out = self.apply_extremes(raw)
        out[~(finite & self.input_in_domain(safe))] = np.nan
        return out


@lru_cache(maxsize=1)
def _cached() -> LaiNetwork:
    grid = _load("LAI_DefinitionDomain_Grid").astype(np.int64)
    codes = frozenset(int(c) for c in LaiNetwork._grid_code(grid))
    return LaiNetwork(
        norm=_load("LAI_Normalisation"), w1=_load("LAI_Weights_Layer1_Neurons"), b1=_load("LAI_Weights_Layer1_Bias"),
        w2=_load("LAI_Weights_Layer2_Neurons"), b2=float(_load("LAI_Weights_Layer2_Bias")[0]),
        denorm=(float(_load("LAI_Denormalisation")[0]), float(_load("LAI_Denormalisation")[1])),
        extremes=(float(_load("LAI_ExtremeCases")[0]), float(_load("LAI_ExtremeCases")[1]), float(_load("LAI_ExtremeCases")[2])),
        domain=_load("LAI_DefinitionDomain_MinMax"), grid_codes=codes,
    )


def block_mean_20m(values: np.ndarray, parity: tuple[int, int]) -> np.ndarray:
    """10 m ızgarada, Sentinel-2 20 m kafesine hizalı 2×2 blok ortalaması (NaN'lı blok → ortalama geçerli piksellerden). `parity`:
    pencerenin (satır, sütun) ofsetinin 2'ye göre kalanı; bloklar çifte hizalanır. Sonuç yine 10 m ızgarada (blok içi sabit)."""
    rows, cols = values.shape
    pr, pc = parity
    padded = np.full((rows + pr + 1, cols + pc + 1), np.nan, dtype=np.float64)
    padded[pr : pr + rows, pc : pc + cols] = values
    h, w = (padded.shape[0] // 2) * 2, (padded.shape[1] // 2) * 2
    blocks = padded[:h, :w].reshape(h // 2, 2, w // 2, 2)
    with np.errstate(all="ignore"):
        mean = np.nanmean(blocks, axis=(1, 3))
    up = np.repeat(np.repeat(mean, 2, axis=0), 2, axis=1)
    return up[pr : pr + rows, pc : pc + cols].astype(np.float32)


def lai_from_bands(
    bands: dict[str, np.ndarray], *, sun_zenith: float, sun_azimuth: float, view_zenith: float, view_azimuth: float, parity: tuple[int, int] = (0, 0)
) -> np.ndarray:
    """Sahne bantlarından (rol → yansıtım dizisi) LAI haritası; geçersiz = NaN."""
    shape = next(iter(bands.values())).shape
    columns: list[np.ndarray] = []
    for role in INPUT_ROLES:
        arr = bands[role].astype(np.float64)
        columns.append((block_mean_20m(arr, parity) if role in BANDS_10M_ROLES else arr).ravel())
    cos_vz = np.cos(np.radians(view_zenith))
    cos_sz = np.cos(np.radians(sun_zenith))
    cos_raz = np.cos(np.radians(sun_azimuth - view_azimuth))
    n = columns[0].size
    x = np.column_stack([*columns, np.full(n, cos_vz), np.full(n, cos_sz), np.full(n, cos_raz)])
    return LaiNetwork.load().predict(x).reshape(shape).astype(np.float32)
