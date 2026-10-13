"""TEST DESTEĞİ: ağsız sahte Landsat sağlayıcısı (LandsatProvider sözleşmesi). Ürün kodunda kullanılmaz.

30 m penceresi bahçenin kanonik ızgarasının çevresine 400 m taşırılır; bahçe içi `garden_offset` kadar tampondan farklı sıcaklıkta olabilir.
"""

from __future__ import annotations

import threading
from datetime import date, timedelta
from typing import Any

import numpy as np
from rasterio.transform import Affine

from bahcelab_backend.domain.imagery.landsat import LandsatPiece, LandsatRef
from bahcelab_backend.domain.multiyear.grid import canonical_grid

PIXEL = 30.0
MARGIN_M = 400.0


class FakeLandsatProvider:
    def __init__(self, geometry: dict[str, Any], step_days: int = 8, start: date = date(2015, 1, 1)) -> None:
        self.grid = canonical_grid(geometry)
        self.step_days, self.start = step_days, start
        self.base_c = 30.0
        self.garden_offset = 0.0  # bahçe − tampon (°C)
        self.cloudy_dates: set[date] = set()
        self.fail_dates: set[date] = set()
        self.read_calls: list[date] = []
        self._lock = threading.Lock()

    def search(self, geometry: dict[str, Any], start: date, end: date) -> list[LandsatRef]:  # noqa: ARG002
        out, day = [], self.start
        while day <= end:
            if day >= start:
                out.append(LandsatRef(day, f"LC09_{day.isoformat()}", 5.0, "landsat-9", "176/035", None))
            day += timedelta(days=self.step_days)
        return out

    def read(self, ref: LandsatRef, geometry: dict[str, Any], buffer_m: float = 300.0) -> LandsatPiece:  # noqa: ARG002
        with self._lock:
            self.read_calls.append(ref.tarih)
        if ref.tarih in self.fail_dates:
            raise RuntimeError("ağ hatası")
        g = self.grid
        x0 = g.transform.c - MARGIN_M
        y0 = g.transform.f + MARGIN_M
        width = int((g.shape[1] * 10 + 2 * MARGIN_M) / PIXEL) + 1
        height = int((g.shape[0] * 10 + 2 * MARGIN_M) / PIXEL) + 1
        transform = Affine(PIXEL, 0, x0, 0, -PIXEL, y0)
        values = np.full((height, width), self.base_c + 0.5 * np.sin(ref.tarih.toordinal() / 40), dtype=np.float32)
        # bahçe içi (pencere merkezindeki dikdörtgen) tampondan farklı: pikseller merkezde
        r0 = int(MARGIN_M / PIXEL)
        values[r0 : height - r0, r0 : width - r0] += self.garden_offset
        if ref.tarih in self.cloudy_dates:
            values[:] = np.nan
        return LandsatPiece(sicaklik_c=values, transform=transform, crs=g.crs)
