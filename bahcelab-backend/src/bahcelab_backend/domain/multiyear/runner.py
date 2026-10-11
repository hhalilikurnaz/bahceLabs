"""Yıl görevlerini çalıştıran nesne ve kuyruklar (ADR 0009/0011).

`YearRunner.run_year`: bir yıl görevini işler; bahçenin tüm yılları bitince bölgeleri hesaplar ve (bir kez) bildirim üretir.
Kuyruk taşıyıcıları: `InlineYearQueue` (süreç içi, ortak eşzamanlılık sınırı), `ImmediateYearQueue` (testler: hemen, sırayla),
`ArqYearQueue` (Redis; sabit `_job_id` ile aynı görev iki kez sıraya girmez).
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from bahcelab_backend.config import Settings, get_settings
from bahcelab_backend.domain.gardens.models import GardenModel
from bahcelab_backend.domain.imagery.provider import ImageryProvider
from bahcelab_backend.domain.multiyear.processor import process_year
from bahcelab_backend.domain.multiyear.repository import MultiyearRepository
from bahcelab_backend.domain.multiyear.service import MultiyearService, YearQueue, parse_window
from bahcelab_backend.domain.notifications.repository import NotificationRepository
from bahcelab_backend.domain.notifications.service import NotificationService
from bahcelab_backend.domain.notifications.types import Candidate
from bahcelab_backend.shared.storage import StorageBackend

logger = logging.getLogger(__name__)
SessionFactory = async_sessionmaker[AsyncSession]


class _NullQueue:
    async def enqueue_year(self, garden_id: uuid.UUID, year: int) -> None:  # pragma: no cover - yalnızca hesaplama için
        raise RuntimeError("Bu bağlamda yeni görev eklenemez")


class YearRunner:
    def __init__(self, factory: SessionFactory, provider: ImageryProvider, storage: StorageBackend, settings: Settings | None = None) -> None:
        self.factory, self.provider, self.storage = factory, provider, storage
        self.settings = settings or get_settings()

    async def run_year(self, garden_id: uuid.UUID, year: int) -> str:
        async with self.factory() as session:
            run = await MultiyearRepository(session).get_run(garden_id)
        if run is None:
            return "atlandi"
        outcome = await process_year(
            self.factory, self.provider, self.storage, garden_id, year, window=parse_window(run.pencere), settings=self.settings, on_done=self.finalize
        )
        return outcome

    async def finalize(self, garden_id: uuid.UUID) -> None:
        """Tüm yıllar sonuçlandıysa: bölgeleri hesapla (yapılandırılmış her bölge sayısı için) ve bir kez bildir."""
        try:
            async with self.factory() as session:
                repo = MultiyearRepository(session)
                years = await repo.list_years(garden_id)
                if not years or any(y.durum in ("bekliyor", "isleniyor") for y in years):
                    return
                row = (await session.execute(select(GardenModel.workspace_id, GardenModel.ad).where(GardenModel.id == garden_id))).first()
                if row is None:
                    return
                workspace_id, name = row
                service = MultiyearService(session, workspace_id, self.provider, self.storage, _NullQueue(), self.settings)
                if not any(y.durum == "tamam" for y in years):
                    return
                for k in self.settings.multiyear_zone_counts:
                    await service.compute(garden_id, k)
                run = await repo.get_run(garden_id)
                stamp = run.updated_at.isoformat(timespec="seconds") if run else ""
                used = sum(1 for y in years if y.durum == "tamam")
                await NotificationService(NotificationRepository(session, workspace_id)).publish(
                    [
                        Candidate(
                            garden_id, "cok_yillik", "bilgi", f"{name}: çok yıllık analiz hazır",
                            f"{used} yılın uydu görüntüsüyle ağaç gücü bölgeleri çıkarıldı. Analiz sekmesinden bakın.", "analiz",
                            f"cok-yillik:{garden_id}:{stamp}",
                        )
                    ]
                )
                await session.commit()
        except Exception:  # noqa: BLE001
            logger.exception("Çok yıllık analiz sonuçlandırılamadı: %s", garden_id)


class ImmediateYearQueue:
    """Testler: görevi hemen ve sırayla çalıştırır."""

    def __init__(self, runner: YearRunner) -> None:
        self.runner = runner

    async def enqueue_year(self, garden_id: uuid.UUID, year: int) -> None:
        await self.runner.run_year(garden_id, year)


_TASKS: set[asyncio.Task[Any]] = set()
_SEMAPHORES: dict[int, asyncio.Semaphore] = {}


class InlineYearQueue:
    """Süreç içi (Redis'siz): görev arka planda çalışır; tüm bahçeler için ortak `multiyear_parallel_years` sınırı."""

    def __init__(self, runner: YearRunner) -> None:
        self.runner = runner

    def _slot(self) -> asyncio.Semaphore:
        loop_id = id(asyncio.get_running_loop())
        return _SEMAPHORES.setdefault(loop_id, asyncio.Semaphore(max(1, self.runner.settings.multiyear_parallel_years)))

    async def enqueue_year(self, garden_id: uuid.UUID, year: int) -> None:
        slot = self._slot()

        async def work() -> None:
            async with slot:
                try:
                    await self.runner.run_year(garden_id, year)
                except Exception:  # noqa: BLE001
                    logger.exception("Yıl görevi başarısız: %s %s", garden_id, year)

        task = asyncio.get_running_loop().create_task(work())
        _TASKS.add(task)
        task.add_done_callback(_TASKS.discard)


class ArqYearQueue:
    def __init__(self, pool: Any) -> None:
        self.pool = pool

    async def enqueue_year(self, garden_id: uuid.UUID, year: int) -> None:
        await self.pool.enqueue_job("process_garden_year", str(garden_id), year, _job_id=f"year-{garden_id}-{year}")


async def fail_stale_years(factory: SessionFactory) -> int:
    """Açılışta yarıda kalan yıl görevlerini hataya çeker (kullanıcı «Yeniden dene» ile devam eder)."""
    async with factory() as session:
        count = await MultiyearRepository(session).fail_stale("Sunucu yeniden başladığı için işlem yarıda kaldı. «Yeniden dene» ile devam edebilirsiniz.")
        await session.commit()
        return count


def year_queue_for(runner: YearRunner, pool: Any | None = None) -> YearQueue:
    return ArqYearQueue(pool) if runner.settings.job_backend == "arq" and pool is not None else InlineYearQueue(runner)
