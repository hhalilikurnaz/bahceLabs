"""TEST ARACI (ürün kodu değil): ağsız HLS sağlayıcısı — deterministik mevsimsel NDVI (bulutlu geçişler dahil). `HLS_CLIENT=tests.support.fake_hls:FakeHlsProvider` (+ API_DEBUG)."""

import math
from datetime import date, timedelta
from typing import Any

import numpy as np
from rasterio.transform import from_origin
from shapely.geometry import shape

from bahcelab_backend.domain.imagery.hls import HlsPiece, HlsRef

STEP_DAYS = 3
PIXEL_DEG = 0.0003  # ≈ 30 m


def season_ndvi(day: date) -> float:
    return 0.66 + 0.06 * math.sin((day.timetuple().tm_yday - 120) / 365 * 2 * math.pi)


class FakeHlsProvider:
    cloudy_every = 5  # her 5. geçiş bulutlu (tüm pikseller geçersiz)

    def search(self, geometry: dict[str, Any], start: date, end: date) -> list[HlsRef]:  # noqa: ARG002
        first = date(2024, 1, 1)  # test sağlayıcısı: 2024'ten (üç günde bir ≈ 330 sahne); e2e her bahçe eklemede bunu çalıştırır, CI yavaşlamasın
        days = [first + timedelta(days=i) for i in range(0, (end - first).days + 1, STEP_DAYS)]
        return [HlsRef(d, f"HLS.S30.FAKE.{d.isoformat()}", "hls-s30", 90.0 if i % self.cloudy_every == 0 else 5.0, handle=(i % self.cloudy_every == 0, d)) for i, d in enumerate(days) if start <= d <= end]

    def read(self, ref: HlsRef, geometry: dict[str, Any]) -> HlsPiece:
        cloudy, day = ref.handle
        minx, miny, maxx, maxy = shape(geometry).bounds
        cols, rows = int((maxx - minx) / PIXEL_DEG) + 4, int((maxy - miny) / PIXEL_DEG) + 4
        grid = np.full((rows, cols), np.nan if cloudy else season_ndvi(day), dtype=np.float32)
        return HlsPiece(ndvi=grid, transform=from_origin(minx - 2 * PIXEL_DEG, maxy + 2 * PIXEL_DEG, PIXEL_DEG, PIXEL_DEG), crs="EPSG:4326")
