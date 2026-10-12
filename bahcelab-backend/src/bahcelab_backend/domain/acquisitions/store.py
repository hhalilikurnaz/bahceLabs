"""Gösterge ızgarası depolama biçimi (SAF): bahçe kanonik ızgarasında float16, sıkıştırılmış .npz; piksel istatistikleri."""

from __future__ import annotations

import io
from dataclasses import dataclass

import numpy as np


def grid_key(garden_id: object, scene_id: str) -> str:
    return f"acq/{garden_id}/{scene_id}.npz"


def encode_grids(grids: dict[str, np.ndarray]) -> bytes:
    """{gösterge: dizi} → sıkıştırılmış .npz (float16; NaN korunur)."""
    buffer = io.BytesIO()
    arrays = {name: arr.astype(np.float16) for name, arr in grids.items()}
    np.savez_compressed(buffer, **arrays)  # type: ignore[arg-type]
    return buffer.getvalue()


def decode_grids(data: bytes) -> dict[str, np.ndarray]:
    with np.load(io.BytesIO(data), allow_pickle=False) as z:
        return {name: z[name].astype(np.float32) for name in z.files}


@dataclass(frozen=True)
class PixelStats:
    ortalama: float
    medyan: float
    p10: float
    p25: float
    p75: float
    p90: float
    minimum: float
    maksimum: float
    gecerli_piksel: int


def pixel_stats(values: np.ndarray, mask: np.ndarray) -> PixelStats | None:
    """Bahçe içi (mask) geçerli piksellerin istatistikleri; geçerli piksel yoksa None."""
    selected = values[mask & np.isfinite(values)].astype(np.float64)
    if selected.size == 0:
        return None
    p10, p25, p50, p75, p90 = (float(np.percentile(selected, q)) for q in (10, 25, 50, 75, 90))
    return PixelStats(float(selected.mean()), p50, p10, p25, p75, p90, float(selected.min()), float(selected.max()), int(selected.size))
