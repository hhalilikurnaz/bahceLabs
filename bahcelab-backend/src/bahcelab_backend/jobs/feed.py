"""Bahçe eklenince su verisi beslemesini başlatır (ADR 0018): ERA5 geçmişi (2015→) önce, sonra SMAP/IMERG doğrulama doldurması.

`JOB_BACKEND=arq` ise iş Redis'e konur (işçi `feed_garden_water` çalıştırır); değilse süreç içi bağımsız görev olarak başlar.
Çağıran, bahçe satırını COMMIT ettikten sonra çağırmalıdır.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Any

from bahcelab_backend.config import get_settings
from bahcelab_backend.database import async_session_factory
from bahcelab_backend.domain.water import feed

logger = logging.getLogger(__name__)
_TASKS: set[asyncio.Task[None]] = set()
_ARQ_POOL: Any | None = None


async def run_garden_feed(garden_id: uuid.UUID) -> dict[str, Any]:
    """ERA5 → toprak profili → doğrulama. Hata günlüğe yazılır ve bir sonraki günlük işte yeniden denenir."""
    out: dict[str, Any] = {}
    try:
        out["era5"] = await feed.feed_garden(async_session_factory, garden_id)
    except Exception:  # noqa: BLE001
        logger.exception("ERA5 beslemesi başarısız (bahçe %s); günlük iş yeniden dener", garden_id)
        out["era5"] = "hata"
    out["dogrulama"] = await feed.feed_validation(async_session_factory, garden_id)
    logger.info("Su verisi beslemesi bitti (bahçe %s): %s", garden_id, out)
    return out


async def _enqueue_arq(garden_id: uuid.UUID) -> None:
    global _ARQ_POOL
    if _ARQ_POOL is None:
        from arq import create_pool
        from arq.connections import RedisSettings

        _ARQ_POOL = await create_pool(RedisSettings.from_dsn(get_settings().redis_url))
    await _ARQ_POOL.enqueue_job("feed_garden_water", str(garden_id), _job_id=f"feed-water-{garden_id}")  # aynı bahçe iki kez sıraya girmez


def start_garden_feed(garden_id: uuid.UUID) -> None:
    settings = get_settings()
    if not settings.era5_auto_feed:
        return
    coro = _enqueue_arq(garden_id) if settings.job_backend == "arq" else run_garden_feed(garden_id)
    task: asyncio.Task[Any] = asyncio.get_running_loop().create_task(coro)
    _TASKS.add(task)
    task.add_done_callback(_TASKS.discard)
