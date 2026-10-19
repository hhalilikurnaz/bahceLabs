"""Eşzamanlılık yardımcıları (ADR 0019): bahçe/hücre başına seri çalışma (advisory lock) ve kilitlenmede üstel geri çekilmeyle yeniden deneme."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from sqlalchemy.pool import NullPool

logger = logging.getLogger(__name__)


def is_deadlock(exc: BaseException) -> bool:
    """PostgreSQL 40P01 (kilitlenme algılandı); SQLAlchemy/asyncpg sarmalayıcısının nedeni zincirinde aranır."""
    seen: set[int] = set()
    cur: BaseException | None = exc
    while cur is not None and id(cur) not in seen:
        seen.add(id(cur))
        if (
            getattr(cur, "sqlstate", None) == "40P01"
            or type(cur).__name__ == "DeadlockDetectedError"
            or "deadlock detected" in str(cur).lower()
        ):
            return True
        cur = cur.__cause__ or getattr(cur, "orig", None) or cur.__context__
    return False


async def retry_on_deadlock[T](
    fn: Callable[[], Awaitable[T]], *, attempts: int = 3, base_delay: float = 0.25
) -> T:
    """`fn`'i kilitlenme hatasında üstel geri çekilmeyle (0,25 · 0,5 · 1 sn) en çok `attempts` kez dener; başka hata hemen yükselir."""
    for attempt in range(1, attempts + 1):
        try:
            return await fn()
        except Exception as exc:  # noqa: BLE001
            if not is_deadlock(exc) or attempt == attempts:
                raise
            delay = base_delay * (2 ** (attempt - 1))
            logger.warning(
                "Kilitlenme algılandı (deneme %d/%d); %.2f sn sonra yeniden denenecek",
                attempt,
                attempts,
                delay,
            )
            await asyncio.sleep(delay)
    raise RuntimeError("ulaşılmaz")  # pragma: no cover


@asynccontextmanager
async def advisory_lock(engine: AsyncEngine, key: str) -> AsyncIterator[None]:
    """Oturum düzeyinde advisory lock: aynı anahtarlı işler SERİ çalışır (ikinci iş ilkinin bitmesini bekler).

    Kilit, havuzsuz (NullPool) ayrı bir bağlantıda tutulur: kilit bağlantısı havuza dönmez (kilit sızmaz) ve başka bir event loop'ta
    açılmış havuz bağlantısına bağımlı olmaz (testlerde loop'lar arası "different loop" hatasının kaynağıydı)."""
    lock_engine = create_async_engine(engine.url, poolclass=NullPool)
    try:
        async with lock_engine.connect() as conn:
            await conn.execute(text("SELECT pg_advisory_lock(hashtextextended(:k, 0))"), {"k": key})
            try:
                yield
            finally:
                await conn.execute(
                    text("SELECT pg_advisory_unlock(hashtextextended(:k, 0))"), {"k": key}
                )
                await conn.rollback()
    finally:
        await lock_engine.dispose()
