"""Yıllık kompozit dosya biçimi (SAF yardımcılar)."""

from __future__ import annotations

import io
import uuid

import numpy as np


def composite_key(garden_id: uuid.UUID, year: int) -> str:
    return f"multiyear/{garden_id}/{year}.npy"


def encode_array(values: np.ndarray) -> bytes:
    buffer = io.BytesIO()
    np.save(buffer, values.astype(np.float32), allow_pickle=False)
    return buffer.getvalue()


def decode_array(data: bytes) -> np.ndarray:
    return np.asarray(np.load(io.BytesIO(data), allow_pickle=False), dtype=np.float32)
