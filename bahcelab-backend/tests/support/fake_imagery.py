"""TEST DESTEĞİ: ağsız sahte uydu sağlayıcısı (ImageryProvider sözleşmesini uygular). Ürün kodunda kullanılmaz.

Her yıl için bir NDVI deseni üretir (bahçenin kanonik ızgarasında); sahneleri gerçek penceredeki gibi 3 piksel taşırılmış ızgarada verir
(hizalama kodu gerçekten çalışsın). Hata/bulut enjekte edilebilir; okuma sayısı sayılır (idempotans testleri için).
"""

from __future__ import annotations

import threading
from collections.abc import Callable
from datetime import date
from typing import Any

import numpy as np
from rasterio.transform import Affine

from bahcelab_backend.domain.imagery.provider import (
    Capabilities,
    ImageryError,
    SceneRef,
    compute_capabilities_indices,
)
from bahcelab_backend.domain.imagery.roles import ALL_ROLES
from bahcelab_backend.domain.multiyear.grid import canonical_grid
from bahcelab_backend.domain.ndvi.processing import SceneBands

PAD = 3  # sahne penceresi kanonik ızgaradan her yönde bu kadar piksel büyük
NIR = 0.35


def bands_pattern(levels: list[float], shape: tuple[int, int]) -> np.ndarray:
    out = np.empty(shape, dtype=np.float32)
    edges = np.linspace(0, shape[1], len(levels) + 1).astype(int)
    for level, a, b in zip(levels, edges[:-1], edges[1:], strict=True):
        out[:, a:b] = level
    return out


class FakeImageryProvider:
    def __init__(
        self,
        geometry: dict[str, Any],
        first: date = date(2018, 6, 20),
        roles: frozenset[str] | None = None,
    ) -> None:
        self.geometry = geometry
        self.grid = canonical_grid(geometry)
        self.first = first
        self.roles = roles if roles is not None else frozenset(ALL_ROLES)
        self.pattern: Callable[[int], np.ndarray] = lambda year: bands_pattern(
            [0.45, 0.6, 0.75], self.grid.shape
        )
        self.noise = 0.01
        self.scenes_per_year = 8  # pencereye yayılır: 13 dönemin ≥ %50'si
        self.cloud_by_year: dict[
            int, float
        ] = {}  # sahnenin geçerli piksel kaybı (0–1: soldan bulut)
        self.fail_years: set[int] = set()
        self.search_calls: list[int] = []
        self.read_calls: list[date] = []
        self._lock = threading.Lock()

    @property
    def capabilities(self) -> Capabilities:
        return Capabilities(
            ad="fake-imagery",
            etiket="Sahte sağlayıcı",
            cozunurluk_m=10.0,
            roller=self.roles,
            rol_haritasi={r: r for r in self.roles},
            bulut_maskesi="fake",
            yapilandirildi=True,
            desteklenen_indeksler=compute_capabilities_indices(self.roles),
        )

    def first_scene_date(self, geometry: dict[str, Any]) -> date | None:
        return self.first

    def search_scenes(
        self, geometry: dict[str, Any], start: date, end: date, max_cloud: float | None = None
    ) -> list[SceneRef]:
        with self._lock:
            self.search_calls.append(start.year)
        if start.year in self.fail_years:
            raise ImageryError("Uydu verisi kaynağına ulaşılamadı.")
        days = (end - start).days
        count = self.scenes_per_year
        out = []
        for i in range(count):
            day = date.fromordinal(start.toordinal() + int(days * (i + 0.5) / count))
            if day < self.first:
                continue
            out.append(
                SceneRef(tarih=day, scene_id=f"FAKE-{day}", bulut_orani=5.0 + i, handle=day.year)
            )
        return out

    def read_scene(
        self, scene: SceneRef, geometry: dict[str, Any], roles: set[str] | None = None
    ) -> SceneBands:
        with self._lock:
            self.read_calls.append(scene.tarih)
        year = int(scene.handle)
        rng = np.random.default_rng(year * 1000 + scene.tarih.timetuple().tm_yday)
        ndvi = np.clip(
            self.pattern(year) + rng.normal(0, self.noise, self.grid.shape), 0.05, 0.95
        ).astype(np.float32)
        h, w = self.grid.shape
        full = np.full((h + 2 * PAD, w + 2 * PAD), np.nan, dtype=np.float32)
        full[PAD : PAD + h, PAD : PAD + w] = ndvi
        valid = np.ones(full.shape, dtype=bool)
        cloud = self.cloud_by_year.get(year, 0.0)
        if cloud > 0:
            valid[:, : int(round(cloud * full.shape[1]))] = False
        n = np.where(np.isfinite(full), full, 0.5)
        nir = np.full_like(n, NIR)
        red = nir * (1 - n) / (1 + n)
        transform = Affine(
            10, 0, self.grid.transform.c - PAD * 10, 0, -10, self.grid.transform.f + PAD * 10
        )
        bands = {r: np.full_like(n, 0.1) for r in ALL_ROLES}
        bands.update({"red": red.astype(np.float32), "nir": nir.astype(np.float32)})
        if not valid.any():
            bands = {}
        for key in list(bands):
            bands[key] = np.where(np.isfinite(full), bands[key], np.nan).astype(np.float32)
        return SceneBands(bands=bands, valid=valid, transform=transform, crs=self.grid.crs)
