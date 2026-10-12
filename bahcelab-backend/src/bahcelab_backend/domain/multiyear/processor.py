"""Bahçe × yıl görevi (arka plan): analiz penceresindeki net sahnelerden yıllık kompozit üretir (ADR 0011).

İDEMPOTENT: görev yalnızca bekleyen/hatalı yılı «işleniyor» yapabilen tek işçiye verilir; tamam yıl yeniden işlenmez. Kaldığı yerden devam
etmek = tamam olmayan yılların yeniden kuyruğa girmesidir. Sağlayıcı ve depolama enjekte edilir (testte ağ yok).
"""

from __future__ import annotations

import asyncio
import io
import logging
import time
import uuid
from datetime import UTC, date, datetime
from typing import Any

import numpy as np
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from bahcelab_backend.config import Settings, get_settings
from bahcelab_backend.domain.imagery.provider import ImageryError, ImageryProvider, SceneRef
from bahcelab_backend.domain.multiyear.composite import (
    median_composite,
    net_index_map,
    spread_by_period,
    window_dates,
)
from bahcelab_backend.domain.multiyear.grid import canonical_grid, garden_mask
from bahcelab_backend.domain.multiyear.repository import MultiyearRepository
from bahcelab_backend.domain.multiyear.sufficiency import PERIOD_DAYS
from bahcelab_backend.domain.ndvi.indices import bands_needed
from bahcelab_backend.shared.storage import StorageBackend

logger = logging.getLogger(__name__)
SessionFactory = async_sessionmaker[AsyncSession]


def composite_key(garden_id: uuid.UUID, year: int) -> str:
    return f"multiyear/{garden_id}/{year}.npy"


def encode_array(values: np.ndarray) -> bytes:
    buffer = io.BytesIO()
    np.save(buffer, values.astype(np.float32), allow_pickle=False)
    return buffer.getvalue()


def decode_array(data: bytes) -> np.ndarray:
    return np.asarray(np.load(io.BytesIO(data), allow_pickle=False), dtype=np.float32)


class RateLimiter:
    """Sahne okumaları arasında en az `interval` saniye (sağlayıcı hız sınırı)."""

    def __init__(self, interval: float) -> None:
        self.interval = interval
        self._lock = asyncio.Lock()
        self._last = 0.0

    async def wait(self) -> None:
        if self.interval <= 0:
            return
        async with self._lock:
            delay = self._last + self.interval - time.monotonic()
            if delay > 0:
                await asyncio.sleep(delay)
            self._last = time.monotonic()


async def process_year(
    factory: SessionFactory,
    provider: ImageryProvider,
    storage: StorageBackend,
    garden_id: uuid.UUID,
    year: int,
    *,
    window: tuple[int, int, str],
    settings: Settings | None = None,
    on_done: Any = None,
) -> str:
    """Bir yıl görevini çalıştırır; dönüş: 'tamam' | 'hata' | 'atlandi' (başka işçi aldı / zaten tamam)."""
    cfg = settings or get_settings()
    started = time.monotonic()
    async with factory() as session:
        repo = MultiyearRepository(session)
        if not await repo.claim_year(garden_id, year):
            await session.rollback()
            return "atlandi"
        geometry = await repo.geometry_geojson(garden_id)
        geometry_hash = await repo.geometry_hash(garden_id)
        await session.commit()
    if geometry is None:  # bahçe arada silinmiş
        return "atlandi"

    month_start, month_end, index_id = window
    status, message, count, candidates_n, key = "tamam", None, 0, 0, None
    scene_dates: list[str] = []
    try:
        grid = canonical_grid(geometry)
        mask = garden_mask(grid, geometry)
        first, last = window_dates(year, month_start, month_end)
        candidates = await asyncio.to_thread(provider.search_scenes, geometry, first, last, cfg.multiyear_search_max_cloud)
        candidates = spread_by_period(candidates, first, PERIOD_DAYS)[: cfg.multiyear_max_candidates]
        candidates_n = len(candidates)
        roles = bands_needed({index_id})
        limiter = RateLimiter(cfg.multiyear_scene_interval_seconds)
        maps: list[tuple[date, np.ndarray]] = []
        failures = 0

        async def read(ref: SceneRef) -> tuple[date, np.ndarray] | None:
            nonlocal failures
            await limiter.wait()
            try:
                data = await asyncio.to_thread(provider.read_scene, ref, geometry, roles)
                net = net_index_map(data, index_id, grid, mask)
                return None if net is None else (ref.tarih, net)
            except Exception as exc:  # noqa: BLE001 - tek sahne hatası yılı durdurmaz
                failures += 1
                logger.warning("Çok yıllık: sahne okunamadı %s: %s", ref.scene_id, exc)
                return None

        batch = max(1, cfg.multiyear_scene_parallel)
        for i in range(0, len(candidates), batch):
            if len(maps) >= cfg.multiyear_max_scenes_per_year:
                break
            results = await asyncio.gather(*(read(ref) for ref in candidates[i : i + batch]))
            maps.extend(m for m in results if m is not None)
        maps = maps[: cfg.multiyear_max_scenes_per_year]
        if candidates and failures == len(candidates):
            raise ImageryError("Uydu görüntüleri okunamadı. Birazdan tekrar deneyin.")
        composite = median_composite([m for _, m in maps])
        count = composite.scene_count if composite else 0
        scene_dates = sorted(d.isoformat() for d, _ in maps)
        if composite is not None:
            key = composite_key(garden_id, year)
            storage.save(key, encode_array(composite.values))
    except ImageryError as exc:
        status, message = "hata", str(exc)
    except Exception:  # noqa: BLE001
        logger.exception("Çok yıllık yıl görevi beklenmedik şekilde başarısız: %s %s", garden_id, year)
        status, message = "hata", "Bu yıl işlenirken beklenmeyen bir hata oluştu. Tekrar deneyin."

    async with factory() as session:
        repo = MultiyearRepository(session)
        row = await repo.get_year(garden_id, year)
        # Sınır işleme sırasında değiştiyse sonuç atılır (yeniden başlatma yeni özetle çalışır)
        if row is not None and await repo.geometry_hash(garden_id) != geometry_hash:
            status, message, key, count = "hata", "Bahçe sınırı değiştiği için sonuç atıldı.", None, 0
            storage.delete(composite_key(garden_id, year))
        if row is not None:
            row.durum, row.hata_mesaji, row.sahne_sayisi, row.aday_sayisi = status, message, count, candidates_n
            row.kompozit_yolu = key
            row.sahne_tarihleri = scene_dates
            row.bitis = datetime.now(UTC)
            row.sure_saniye = round(time.monotonic() - started, 2)
        await session.commit()
    if on_done is not None:
        await on_done(garden_id)
    return status


async def pending_years(factory: SessionFactory, garden_id: uuid.UUID) -> list[int]:
    async with factory() as session:
        return [y.yil for y in await MultiyearRepository(session).list_years(garden_id) if y.durum in ("bekliyor", "hata")]
