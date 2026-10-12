"""Geçmiş doldurma orkestrasyonu (ADR 0015): ay görevlerini açar/sıraya koyar, ilerlemeyi hesaplar, bitince normal bantları kurar.

Bahçe eklenince 2015'ten bugüne ay ay çalışır; idempotent ve kaldığı yerden devam eder (tamam aylar yeniden alınmaz).
Günlük artımlı çekim aynı ay görevini son birkaç ay için `force` ile çalıştırır (yalnız yeni sahneler edinilir).
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import UTC, date, datetime
from typing import Any, Protocol

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from bahcelab_backend.config import Settings, get_settings
from bahcelab_backend.domain.acquisitions.models import (
    MONTH_DONE,
    MONTH_ERROR,
    MONTH_PENDING,
    MONTH_RUNNING,
    NormalBandModel,
)
from bahcelab_backend.domain.acquisitions.normal_bands import BandThresholds, compute_normal_bands
from bahcelab_backend.domain.acquisitions.processor import SOURCE_ID, process_month
from bahcelab_backend.domain.acquisitions.repository import AcquisitionRepository
from bahcelab_backend.domain.acquisitions.selection import month_first, months_between
from bahcelab_backend.domain.agro import catalog as cat
from bahcelab_backend.domain.imagery.formulas import FORMULA_VERSION, INDICATORS
from bahcelab_backend.domain.imagery.provider import ImageryProvider
from bahcelab_backend.domain.multiyear.repository import MultiyearRepository
from bahcelab_backend.shared.storage import StorageBackend

logger = logging.getLogger(__name__)
SessionFactory = async_sessionmaker[AsyncSession]


class MonthQueue(Protocol):
    async def enqueue_month(self, garden_id: uuid.UUID, month: date) -> None: ...


class BackfillRunner:
    """Ay görevini çalıştırır ve gerekirse sonuçlandırır (normal bantlar)."""

    def __init__(self, factory: SessionFactory, provider: ImageryProvider, storage: StorageBackend, settings: Settings | None = None) -> None:
        self.factory, self.provider, self.storage = factory, provider, storage
        self.settings = settings or get_settings()

    async def run_month(self, garden_id: uuid.UUID, month: date, *, force: bool = False) -> str:
        outcome = await process_month(self.factory, self.provider, self.storage, garden_id, month, settings=self.settings, force=force)
        await self.finalize(garden_id)
        return outcome

    async def finalize(self, garden_id: uuid.UUID) -> None:
        """Bekleyen/işleniyor ay kalmadıysa normal bantları (yeniden) hesaplar; idempotent."""
        try:
            async with self.factory() as session:
                progress = await AcquisitionRepository(session).progress(garden_id, SOURCE_ID)
                counts = progress["counts"]
                if progress["total"] == 0 or counts.get(MONTH_PENDING, 0) or counts.get(MONTH_RUNNING, 0):
                    return
                await compute_bands_for(session, garden_id)
                await session.commit()
        except Exception:  # noqa: BLE001
            logger.exception("Normal bantlar hesaplanamadı: %s", garden_id)


async def compute_bands_for(session: AsyncSession, garden_id: uuid.UUID) -> int:
    """Gösterge başına 12 aylık normal bandı yeniden yazar. Yetersiz veri / uyumsuz-hariç yıllar (çok yıllık sonuç) banda girmez."""
    rule = cat.load_catalog().normal_bant
    repo = AcquisitionRepository(session)
    last_year = datetime.now(UTC).year - 1
    allowed = await _allowed_years(session, garden_id)
    thresholds = BandThresholds(rule.asgari_yil_ceyrek, rule.asgari_yil_onluk)
    written = 0
    for indicator in INDICATORS:
        values = await repo.monthly_values(garden_id, SOURCE_ID, indicator)
        bands = compute_normal_bands(values, allowed_years=allowed, first_year=rule.ilk_yil, last_year=last_year, thresholds=thresholds)
        rows = [
            NormalBandModel(
                garden_id=garden_id, source_id=SOURCE_ID, indeks=indicator, ay=b.ay, yil_sayisi=b.yil_sayisi, yillar=b.yillar, p10=b.p10, p25=b.p25, p50=b.p50, p75=b.p75, p90=b.p90,
                ceyrek_yeterli=b.ceyrek_yeterli, onluk_yeterli=b.onluk_yeterli, formul_surumu=FORMULA_VERSION, ayrinti=b.ayrinti,
            )
            for b in bands
        ]
        await repo.replace_bands(garden_id, SOURCE_ID, indicator, rows)
        written += len(rows)
    return written


async def _allowed_years(session: AsyncSession, garden_id: uuid.UUID) -> set[int] | None:
    """Çok yıllık analizde kullanılan yıllar (yetersiz veri ve uyumsuz/hariç yıllar dışarıda). Analiz yoksa kısıt yok."""
    model = await MultiyearRepository(session).active_result(garden_id, 3)
    return {int(y) for y in model.yillar} if model is not None and model.yillar else None


class BackfillService:
    def __init__(self, session: AsyncSession, provider: ImageryProvider, storage: StorageBackend, queue: MonthQueue, settings: Settings | None = None) -> None:
        self.session = session
        self.repo = AcquisitionRepository(session)
        self.provider, self.storage, self.queue = provider, storage, queue
        self.settings = settings or get_settings()

    def month_range(self, today: date | None = None) -> list[date]:
        return months_between(date.fromisoformat(self.settings.acq_start), today or datetime.now(UTC).date())

    async def start(self, garden_id: uuid.UUID, today: date | None = None) -> dict[str, Any]:
        """Eksik ayları açar ve sıraya koyar (tamam aylar atlanır). Sınır özeti değişmişse eski edinimler silinip baştan başlanır."""
        ghash = await self.repo.geometry_hash(garden_id) or ""
        stale = await self.repo.has_stale_months(garden_id, SOURCE_ID, ghash)
        if stale:
            self.storage.delete_prefix(f"acq/{garden_id}")
        await self.repo.ensure_months(garden_id, SOURCE_ID, self.month_range(today), ghash)
        pending = await self.repo.pending_months(garden_id, SOURCE_ID)
        await self.session.commit()
        for month in pending:  # en yeni aylar önce: ekranda güncel veri hızla görünür
            await self.queue.enqueue_month(garden_id, month)
        return await self.status(garden_id)

    async def status(self, garden_id: uuid.UUID) -> dict[str, Any]:
        progress = await self.repo.progress(garden_id, SOURCE_ID)
        counts, total = progress["counts"], progress["total"]
        done, errors = counts.get(MONTH_DONE, 0), counts.get(MONTH_ERROR, 0)
        running = counts.get(MONTH_PENDING, 0) + counts.get(MONTH_RUNNING, 0)
        state = "yok" if total == 0 else "isleniyor" if running else "hata" if errors else "tamam"
        size, scenes = await self.repo.storage_bytes(garden_id)
        return {
            "durum": state, "toplam_ay": total, "tamamlanan_ay": done, "hata_ay": errors, "yuzde": int(round(100 * done / total)) if total else 0,
            "net_sahne": progress["net"], "depolama_bayt": size, "depolanan_sahne": scenes,
        }


class InlineMonthQueue:
    """Süreç içi (Redis'siz): görev arka planda; tüm bahçeler için ortak `acq_parallel_months` sınırı."""

    _semaphores: dict[int, asyncio.Semaphore] = {}
    _tasks: set[asyncio.Task[Any]] = set()

    def __init__(self, runner: BackfillRunner) -> None:
        self.runner = runner

    async def enqueue_month(self, garden_id: uuid.UUID, month: date) -> None:
        loop = asyncio.get_running_loop()
        slot = self._semaphores.setdefault(id(loop), asyncio.Semaphore(max(1, self.runner.settings.acq_parallel_months)))

        async def work() -> None:
            async with slot:
                try:
                    await self.runner.run_month(garden_id, month)
                except Exception:  # noqa: BLE001
                    logger.exception("Ay görevi başarısız: %s %s", garden_id, month)

        task = loop.create_task(work())
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)


class ImmediateMonthQueue:
    """Testler: görevi hemen ve sırayla çalıştırır."""

    def __init__(self, runner: BackfillRunner) -> None:
        self.runner = runner

    async def enqueue_month(self, garden_id: uuid.UUID, month: date) -> None:
        await self.runner.run_month(garden_id, month)


class ArqMonthQueue:
    def __init__(self, pool: Any) -> None:
        self.pool = pool

    async def enqueue_month(self, garden_id: uuid.UUID, month: date) -> None:
        await self.pool.enqueue_job("process_garden_month", str(garden_id), month.isoformat(), _job_id=f"month-{garden_id}-{month.isoformat()}")


def month_queue_for(runner: BackfillRunner, pool: Any | None = None) -> MonthQueue:
    return ArqMonthQueue(pool) if runner.settings.job_backend == "arq" and pool is not None else InlineMonthQueue(runner)


async def fail_stale_months(factory: SessionFactory) -> int:
    """Açılışta yarıda kalan ay görevlerini hataya çeker; geçmiş doldurma yeniden başlatılınca kaldığı yerden devam eder."""
    async with factory() as session:
        count = await AcquisitionRepository(session).fail_stale("Sunucu yeniden başladığı için işlem yarıda kaldı; devam edecek.")
        await session.commit()
        return count


async def resume_incomplete(factory: SessionFactory, runner: BackfillRunner) -> int:
    """Açılışta: yarım kalan geçmiş doldurmaları kaldığı yerden sürdürür (yalnız süreç içi kuyrukta). Dönüş: sıraya konan ay sayısı."""
    from sqlalchemy import select

    from bahcelab_backend.domain.acquisitions.models import BackfillMonthModel

    async with factory() as session:
        rows = (
            await session.execute(select(BackfillMonthModel.garden_id, BackfillMonthModel.ay).where(BackfillMonthModel.durum.in_((MONTH_PENDING, MONTH_ERROR))).order_by(BackfillMonthModel.ay.desc()))
        ).all()
    queue = InlineMonthQueue(runner)
    for garden_id, month in rows:
        await queue.enqueue_month(garden_id, month)
    return len(rows)


async def refresh_recent(factory: SessionFactory, runner: BackfillRunner, garden_ids: list[uuid.UUID] | None = None) -> int:
    """Günlük artımlı çekim: son `acq_incremental_days` günün aylarını `force` ile tarar; yalnız yeni sahneler edinilir. Dönüş: taranan ay sayısı."""
    from sqlalchemy import select

    from bahcelab_backend.domain.gardens.models import GardenModel

    today = datetime.now(UTC).date()
    from datetime import timedelta

    months = months_between(today - timedelta(days=runner.settings.acq_incremental_days), today)
    async with factory() as session:
        ids = garden_ids or [r[0] for r in (await session.execute(select(GardenModel.id))).all()]
        for gid in ids:  # eksik ay satırları (yeni ay başladıysa)
            repo = AcquisitionRepository(session)
            ghash = await repo.geometry_hash(gid) or ""
            if not await repo.has_months(gid, SOURCE_ID):
                continue  # geçmiş doldurma henüz başlamadı: önce o çalışır
            await repo.ensure_months(gid, SOURCE_ID, months, ghash)
        await session.commit()
    scanned = 0
    for gid in ids:
        for month in months:
            await runner.run_month(gid, month_first(month), force=True)
            scanned += 1
    return scanned
