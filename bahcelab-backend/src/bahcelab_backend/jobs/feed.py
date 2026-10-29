"""Bahçe eklenince su verisi beslemesini başlatır (ADR 0018): ERA5 geçmişi (2015→) önce, sonra SMAP/IMERG doğrulama doldurması.

`JOB_BACKEND=arq` ise iş Redis'e konur (işçi `feed_garden_water` çalıştırır); değilse süreç içi bağımsız görev olarak başlar.
Çağıran, bahçe satırını COMMIT ettikten sonra çağırmalıdır.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from collections.abc import Awaitable, Callable
from typing import Any

from sqlalchemy import text

from bahcelab_backend.config import get_settings
from bahcelab_backend.database import async_session_factory, engine
from bahcelab_backend.domain.water import feed
from bahcelab_backend.shared.concurrency import advisory_lock, retry_on_deadlock

logger = logging.getLogger(__name__)
_TASKS: set[asyncio.Task[None]] = set()
_BY_GARDEN: dict[uuid.UUID, asyncio.Task[Any]] = {}
_RUNNING: set[uuid.UUID] = set()  # gövdesi çalışmaya BAŞLAMIŞ besleme işleri: veritabanı işlemi sırasında iptal edilmez (aşağıya bakın)
_ARQ_POOL: Any | None = None


async def garden_exists(garden_id: uuid.UUID) -> bool:
    async with async_session_factory() as session:
        return (
            await session.execute(text("SELECT 1 FROM gardens WHERE id = :g"), {"g": garden_id})
        ).first() is not None


async def _stage(garden_id: uuid.UUID, name: str, fn: Callable[[], Awaitable[Any]]) -> Any:
    """Bir besleme aşaması: bahçe yoksa SESSİZCE biter; kilitlenmede 3 deneme; diğer hatalar günlüğe yazılır (günlük iş yeniden dener)."""
    if not await garden_exists(garden_id):
        return "bahce_yok"
    try:
        return await retry_on_deadlock(fn)
    except asyncio.CancelledError:
        raise
    except Exception:  # noqa: BLE001
        if not await garden_exists(
            garden_id
        ):  # bahçe silindi: yarım kalan yazım yabancı anahtar hatası verebilir, bu hata değildir
            return "bahce_yok"
        logger.exception(
            "%s beslemesi başarısız (bahçe %s); günlük iş yeniden dener", name, garden_id
        )
        return "hata"


async def run_garden_feed(garden_id: uuid.UUID) -> dict[str, Any]:
    """ERA5 → toprak profili → HLS → doğrulama. Bahçe başına SERİ (advisory lock); bahçe silinirse iş sessizce biter."""
    out: dict[str, Any] = {}
    _RUNNING.add(garden_id)
    try:
        return await _run_garden_feed(garden_id, out)
    finally:
        _RUNNING.discard(garden_id)


async def _run_garden_feed(garden_id: uuid.UUID, out: dict[str, Any]) -> dict[str, Any]:
    async with advisory_lock(engine, f"feed:{garden_id}"):
        out["era5"] = await _stage(
            garden_id, "ERA5", lambda: feed.feed_garden(async_session_factory, garden_id)
        )
        if out["era5"] == "bahce_yok":
            return out
        out["hls"] = await _feed_hls_unlocked(garden_id)
    if out.get("hls") == "bahce_yok":
        return out
    out["dogrulama"] = await _stage(
        garden_id, "Doğrulama", lambda: feed.feed_validation(async_session_factory, garden_id)
    )  # uzun sürer: kilit dışında (başka besleme işlerini bekletmesin)
    logger.info("Su verisi beslemesi bitti (bahçe %s): %s", garden_id, out)
    return out


async def _feed_hls_unlocked(garden_id: uuid.UUID, days: int | None = None) -> Any:
    from datetime import UTC, date, datetime, timedelta

    from bahcelab_backend.domain.imagery.registry import get_hls_provider
    from bahcelab_backend.domain.series.service import sync_hls

    settings = get_settings()
    if not settings.hls_enabled:
        return "kapali"
    today = datetime.now(UTC).date()
    start = date.fromisoformat(settings.hls_start) if days is None else today - timedelta(days=days)

    async def run() -> dict[str, int]:
        async with async_session_factory() as session:
            return await sync_hls(session, garden_id, start, today, get_hls_provider())

    return await _stage(garden_id, "HLS", run)


async def feed_hls(garden_id: uuid.UUID, days: int | None = None) -> dict[str, Any] | str:
    """HLS NDVI gözlemleri (2020→ ya da son `days` gün): bahçe başına seri; idempotent."""
    async with advisory_lock(engine, f"feed:{garden_id}"):
        return await _feed_hls_unlocked(garden_id, days)


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
    _BY_GARDEN[garden_id] = task
    task.add_done_callback(_TASKS.discard)
    task.add_done_callback(
        lambda t: _BY_GARDEN.pop(garden_id, None) if _BY_GARDEN.get(garden_id) is t else None
    )


def cancel_garden_feed(garden_id: uuid.UUID) -> bool:
    """Bahçe silinirken henüz başlamamış besleme işini iptal eder (arq kuyruğundaki iş başlarken bahçe yok ise sessizce biter)."""
    task = _BY_GARDEN.pop(garden_id, None)
    if task is not None and not task.done() and garden_id not in _RUNNING:
        task.cancel()  # henüz BAŞLAMAMIŞ iş: güvenle iptal edilir
        return True
    # Başlamış iş veritabanı işlemi ortasında iptal EDİLMEZ (yarıda kesilen asyncpg işlemi havuz bağlantısını sızdırabilir): bir sonraki aşamada
    # `garden_exists` bahçenin silindiğini görür ve iş sessizce biter.
    return False
