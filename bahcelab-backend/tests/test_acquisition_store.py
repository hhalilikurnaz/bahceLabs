"""Gösterge ızgarası depolama biçimi: float16 gidiş-dönüş, NaN korunumu, boyut, istatistikler."""

import numpy as np
import pytest

from bahcelab_backend.domain.acquisitions.store import (
    decode_grids,
    encode_grids,
    grid_key,
    pixel_stats,
)


def test_float16_round_trip_keeps_nan_and_precision() -> None:
    rng = np.random.default_rng(1)
    ndvi = rng.uniform(0.2, 0.9, (40, 30)).astype(np.float32)
    ndvi[5:8, 5:8] = np.nan
    lai = rng.uniform(0.0, 5.0, (40, 30)).astype(np.float32)
    data = encode_grids({"ndvi": ndvi, "lai": lai})
    back = decode_grids(data)
    assert set(back) == {"ndvi", "lai"} and np.isnan(back["ndvi"][5:8, 5:8]).all()
    assert np.nanmax(np.abs(back["ndvi"] - ndvi)) < 5e-4 and np.nanmax(np.abs(back["lai"] - lai)) < 3e-3  # float16 duyarlılığı
    assert len(data) < 2 * 2 * ndvi.size * 2  # iki gösterge × float16'dan küçük


def test_pixel_stats_use_only_valid_pixels_inside_the_garden() -> None:
    values = np.array([[0.1, 0.2, 0.3, np.nan], [0.4, 0.5, 0.6, 0.7]], dtype=np.float32)
    mask = np.array([[True, True, True, True], [True, True, False, False]])
    stats = pixel_stats(values, mask)
    assert stats is not None and stats.gecerli_piksel == 5 and stats.medyan == pytest.approx(0.3) and stats.minimum == pytest.approx(0.1) and stats.maksimum == pytest.approx(0.5)
    assert pixel_stats(np.full((2, 2), np.nan, dtype=np.float32), np.ones((2, 2), dtype=bool)) is None


def test_storage_key_is_per_garden_and_scene() -> None:
    assert grid_key("g1", "S2A_X") == "acq/g1/S2A_X.npz"
