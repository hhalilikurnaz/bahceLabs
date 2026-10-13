"""TEST DESTEĞİ: ağsız sahte radar sağlayıcısı (RadarProvider sözleşmesi). Ürün kodunda kullanılmaz.

Her yörünge kendi sıklığıyla geçer (yıl bazında sıklık değiştirilebilir: S1B arızası gibi); VH/VV doğrusal γ⁰ çarpımsal kumlanmayla üretilir,
pencere 3 piksel taşırılmış ızgarada verilir. `shadow` bahçenin soldan bu oranını gölge (çok düşük VH) yapar.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any

import numpy as np
from rasterio.transform import Affine

from bahcelab_backend.domain.imagery.radar import OrbitInfo, RadarPiece, RadarRef
from bahcelab_backend.domain.multiyear.grid import canonical_grid

PAD = 3


@dataclass
class FakeItem:
    properties: dict[str, Any] = field(default_factory=lambda: {"s1:orbit_source": "POEORB"})


@dataclass(frozen=True)
class FakeOrbit:
    yorunge: int
    yon: str
    step_days: int = 12
    offset: int = 0


class FakeRadarProvider:
    def __init__(self, geometry: dict[str, Any], orbits: list[FakeOrbit] | None = None) -> None:
        self.grid = canonical_grid(geometry)
        self.orbits = orbits or [FakeOrbit(87, "cikis", 12, 0), FakeOrbit(167, "inis", 12, 4), FakeOrbit(94, "inis", 12, 8)]
        self.step_by_year: dict[int, int] = {}  # yıl → yörünge adımı (gün); arızalı yıllarda seyrek
        self.vh_level = 0.03
        self.vv_level = 0.15
        self.level_by_date: dict[date, float] = {}  # tarih → VH çarpanı (değişim/ıslaklık simülasyonu)
        self.shadow = 0.0
        self.jitter_db = 0.0  # sahne başına bahçe düzeyi oynaması (gerçekte yıllar/sahneler arası değişkenlik; normal bant genişliği)
        self.noise = True
        self.fail_months: set[tuple[int, int]] = set()
        self.read_calls: list[date] = []
        self.search_calls = 0
        self._lock = threading.Lock()

    def _days(self, orbit: FakeOrbit, start: date, end: date) -> list[date]:
        out, day = [], date(2015, 1, 1) + timedelta(days=orbit.offset)
        while day <= end:
            step = self.step_by_year.get(day.year, orbit.step_days)
            if day >= start:
                out.append(day)
            day += timedelta(days=step)
        return out

    def search(self, geometry: dict[str, Any], start: date, end: date) -> list[RadarRef]:  # noqa: ARG002
        with self._lock:
            self.search_calls += 1
        if (start.year, start.month) in self.fail_months:
            from bahcelab_backend.domain.imagery.provider import ImageryError

            raise ImageryError("Radar kaynağına ulaşılamadı.")
        refs = [
            RadarRef(tarih=d, scene_id=f"S1-{o.yorunge}-{d.isoformat()}", yorunge=o.yorunge, yon=o.yon, platform="SENTINEL-1A", handle=[FakeItem()])
            for o in self.orbits
            for d in self._days(o, start, end)
        ]
        return sorted(refs, key=lambda r: (r.tarih, r.yorunge))

    def orbit_summary(self, geometry: dict[str, Any], start: date, end: date) -> list[OrbitInfo]:  # noqa: ARG002
        out = []
        for o in self.orbits:
            days = self._days(o, start, end)
            yearly: dict[int, int] = {}
            for d in days:
                yearly[d.year] = yearly.get(d.year, 0) + 1
            out.append(OrbitInfo(o.yorunge, o.yon, len(days), yearly))
        return sorted(out, key=lambda i: -i.sahne_sayisi)

    def read(self, ref: RadarRef, geometry: dict[str, Any]) -> list[RadarPiece]:  # noqa: ARG002
        with self._lock:
            self.read_calls.append(ref.tarih)
        h, w = self.grid.shape
        rng = np.random.default_rng(ref.tarih.toordinal() * 31 + ref.yorunge)
        shape = (h + 2 * PAD, w + 2 * PAD)
        speckle_h = rng.gamma(4.4, 1 / 4.4, shape) if self.noise else np.ones(shape)
        speckle_v = rng.gamma(4.4, 1 / 4.4, shape) if self.noise else np.ones(shape)
        factor = self.level_by_date.get(ref.tarih, 1.0) * 10 ** (rng.normal(0, self.jitter_db) / 10)
        vh = (self.vh_level * factor * speckle_h).astype(np.float32)
        vv = (self.vv_level * speckle_v).astype(np.float32)
        if self.shadow > 0:
            cols = int(round(self.shadow * w))
            vh[:, PAD : PAD + cols] = 1e-5  # gölge: çok düşük VH
        transform = Affine(10, 0, self.grid.transform.c - PAD * 10, 0, -10, self.grid.transform.f + PAD * 10)
        return [RadarPiece(vh=vh, vv=vv, transform=transform, crs=self.grid.crs)]
