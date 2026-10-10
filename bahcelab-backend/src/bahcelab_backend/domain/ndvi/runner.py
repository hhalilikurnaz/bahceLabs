"""NDVI/indeks arka plan işleyicisi: son 13 ayın sahnelerini bahçe sınırı penceresiyle işler.

Basit, süreç içi bir iş kuyruğudur: iş durumu veritabanında tutulur, aynı anda en fazla
`ndvi_max_parallel_scenes` sahne işlenir (tüm işler arasında ortak sınır). Her sahne için gereken
bantlar tek turda okunur ve tüm indeksler birlikte hesaplanır.
"""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
import weakref
from collections.abc import Callable
from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy import text, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from bahcelab_backend.config import get_settings
from bahcelab_backend.database import async_session_factory
from bahcelab_backend.domain.ndvi import stac
from bahcelab_backend.domain.ndvi.indices import bands_needed
from bahcelab_backend.domain.ndvi.models import NdviJobModel
from bahcelab_backend.domain.ndvi.persist import missing_outputs, persist_analysis
from bahcelab_backend.domain.ndvi.processing import analyze_scene
from bahcelab_backend.domain.ndvi.repository import NdviRepository
from bahcelab_backend.domain.ndvi.rules import months_back
from bahcelab_backend.shared.storage import StorageBackend, get_storage

logger = logging.getLogger(__name__)

JOB_VISIBILITY_ATTEMPTS = 40
JOB_VISIBILITY_DELAY = 0.25  # en fazla ~10 sn (commit'in görünmesi için güvenlik payı)

# Olay döngüsü → {sınır: semafor}. Döngü nesnesinin kendisi (zayıf referansla) anahtardır: `id(loop)`
# döngü çöp toplandıktan sonra başka bir döngüye yeniden verilebilir ve eski (ölü) semaforu geri getirirdi.
_SLOTS: weakref.WeakKeyDictionary[asyncio.AbstractEventLoop, dict[int, asyncio.Semaphore]] = (
    weakref.WeakKeyDictionary()
)
_TASKS: set[asyncio.Task[None]] = set()


def _slots(limit: int) -> asyncio.Semaphore:
    """Olay döngüsü ve sınır başına tek semafor: tüm bahçelerin işleri aynı sınırı paylaşır.

    Sınır, semafor ilk oluşturulduğunda sabitlenmez; farklı bir sınır istenirse kendi semaforu kullanılır
    (üretimde sınır sabit olduğundan tek semafor vardır).
    """
    by_limit = _SLOTS.setdefault(asyncio.get_running_loop(), {})
    return by_limit.setdefault(limit, asyncio.Semaphore(limit))


def start_job(job_id: uuid.UUID) -> None:
    """İşi, çalışan olay döngüsünde bağımsız bir görev olarak başlatır.

    FastAPI `BackgroundTasks` kullanılmaz: o, isteğin transaction'ını (commit) iş bitene kadar
    açık tutuyordu; dakikalarca süren işleme sırasında bahçe kaydı bile görünmüyordu.
    Çağıran, iş satırını *commit ettikten sonra* bunu çağırmalıdır.
    """
    task = asyncio.get_running_loop().create_task(run_job(job_id))
    _TASKS.add(task)  # görev çöp toplayıcıya kaptırılmasın
    task.add_done_callback(_TASKS.discard)


async def _set_job(
    factory: async_sessionmaker[AsyncSession], job_id: uuid.UUID, **values: Any
) -> None:
    async with factory() as session:
        await session.execute(
            update(NdviJobModel).where(NdviJobModel.id == job_id).values(**values)
        )
        await session.commit()


async def _geometry(session: AsyncSession, garden_id: uuid.UUID) -> dict[str, Any] | None:
    result = await session.execute(
        text("SELECT ST_AsGeoJSON(geom) FROM gardens WHERE id = :id"), {"id": garden_id}
    )
    raw = result.scalar_one_or_none()
    return json.loads(raw) if raw else None


async def run_job(
    job_id: uuid.UUID,
    *,
    session_factory: async_sessionmaker[AsyncSession] | None = None,
    storage: StorageBackend | None = None,
    search: Callable[..., list[stac.Scene]] | None = None,
    read: Callable[..., Any] | None = None,
    today: date | None = None,
) -> None:
    """Bir işleme işini baştan sona çalıştırır. Hiçbir koşulda istisna dışarı sızmaz (uygulama çökmesin)."""
    try:
        await _run(
            job_id,
            session_factory or async_session_factory,
            storage or get_storage(),
            search or stac.search_scenes,
            read or stac.read_scene,
            today or datetime.now(UTC).date(),
        )
    except Exception:  # noqa: BLE001
        logger.exception("İşleme işi beklenmedik şekilde başarısız oldu: %s", job_id)
        try:
            await _set_job(
                session_factory or async_session_factory,
                job_id,
                durum="hata",
                hata_mesaji="Uydu görüntüleri işlenirken beklenmeyen bir hata oluştu. Tekrar deneyin.",
                bitis=datetime.now(UTC),
            )
        except Exception:  # noqa: BLE001
            logger.exception("İş durumu güncellenemedi: %s", job_id)


async def _run(
    job_id: uuid.UUID,
    factory: async_sessionmaker[AsyncSession],
    storage: StorageBackend,
    search: Callable[..., list[stac.Scene]],
    read: Callable[..., Any],
    today: date,
) -> None:
    settings = get_settings()

    # FastAPI arka plan görevleri isteğin commit'inden önce başlayabilir: iş satırı görünene kadar bekle
    job: NdviJobModel | None = None
    for _ in range(JOB_VISIBILITY_ATTEMPTS):
        async with factory() as session:
            job = await NdviRepository(session).get_job(job_id)
        if job is not None:
            break
        await asyncio.sleep(JOB_VISIBILITY_DELAY)
    if job is None or job.durum != "bekliyor":
        return

    async with factory() as session:
        repo = NdviRepository(session)
        garden_id, tur = job.garden_id, job.tur
        geometry = await _geometry(session, garden_id)
        geometry_hash = await repo.geometry_hash(garden_id)
        existing = await repo.scene_map(garden_id)
        if geometry is None:  # bahçe arada silinmiş
            return
        await session.execute(
            update(NdviJobModel)
            .where(NdviJobModel.id == job_id, NdviJobModel.durum == "bekliyor")
            .values(durum="isleniyor", baslangic=datetime.now(UTC))
        )
        await session.commit()

    start = months_back(today, settings.ndvi_months)
    if tur == "guncelleme" and existing:
        # Yeni sahneler + eksik çıktısı olan eski sahneler (en eskisinden itibaren)
        incomplete = [d for d, item in existing.items() if missing_outputs(item)]
        newest = max(existing) - timedelta(days=5)
        start = max(start, min([newest, *incomplete]))

    try:
        scenes = await asyncio.to_thread(search, geometry, start, today)
    except stac.NdviSourceError as exc:
        await _set_job(factory, job_id, durum="hata", hata_mesaji=str(exc), bitis=datetime.now(UTC))
        return

    # Yeni tarihler için tüm çıktılar; mevcutlar için yalnızca eksikler (gereken bantlar okunur)
    work = [(scene, missing_outputs(existing.get(scene.tarih))) for scene in scenes]
    work = [(scene, wanted) for scene, wanted in work if wanted]
    await _set_job(factory, job_id, toplam=len(work))

    slots = _slots(settings.ndvi_max_parallel_scenes)
    state = {"failed": 0, "aborted": False}

    async def handle(scene: stac.Scene, wanted: set[str]) -> None:
        async with slots:
            if state["aborted"]:
                return
            try:
                data = await asyncio.to_thread(read, scene, geometry, bands_needed(wanted))
                analysis = await asyncio.to_thread(analyze_scene, data, geometry, wanted)
            except Exception as exc:  # noqa: BLE001 - tek sahne hatası işi durdurmaz
                state["failed"] += 1
                logger.warning("Sahne işlenemedi %s: %s", scene.scene_id, exc)
                return

            async with factory() as session:
                repo = NdviRepository(session)
                # Kontrol ve yazma aynı işlemde: sınır değiştiyse (veya bahçe silindiyse) hiçbir şey yazılmaz
                if await repo.lock_geometry_hash(garden_id) != geometry_hash:
                    state["aborted"] = True
                    return
                current = await repo.get_scene(garden_id, scene.tarih)
                if current is not None and analysis.bulutlu:
                    return  # eski kayıt zaten tamam; tutarsız bulut kararıyla bozulmasın
                new_scene, _updated, rows = persist_analysis(
                    garden_id=garden_id,
                    tarih=scene.tarih,
                    scene_id=scene.scene_id,
                    cloud_cover=scene.bulut_orani,
                    analysis=analysis,
                    storage=storage,
                    existing=current,
                )
                if new_scene is not None and not await repo.add_scene(new_scene):
                    return  # aynı tarih başka bir iş tarafından yazılmış
                for row in rows:
                    await repo.upsert_index(row)
                await session.commit()
            async with factory() as session:
                await session.execute(
                    update(NdviJobModel)
                    .where(NdviJobModel.id == job_id, NdviJobModel.durum == "isleniyor")
                    .values(islenen=NdviJobModel.islenen + 1)
                )
                await session.commit()

    await asyncio.gather(*(handle(scene, wanted) for scene, wanted in work))

    if state["aborted"]:
        # Sınır değişti veya bahçe silindi: sonuçlar atıldı. Sınır değişimi yeni işi zaten sıraya aldı.
        await _set_job_if_processing(
            factory,
            job_id,
            durum="hata",
            hata_mesaji="Bahçe sınırı değiştiği için sonuçlar atıldı.",
            bitis=datetime.now(UTC),
        )
        return

    failed = state["failed"]
    if work and failed == len(work):
        status, message = (
            "hata",
            "Uydu görüntüleri okunamadı. Planetary Computer'a ulaşılamıyor olabilir; "
            "biraz sonra «Şimdi güncelle» ile tekrar deneyin.",
        )
    elif failed:
        status, message = (
            "tamam",
            f"{failed} sahne işlenemedi; sonraki güncellemede yeniden denenecek.",
        )
    else:
        status, message = "tamam", None
    await _set_job_if_processing(
        factory, job_id, durum=status, hata_mesaji=message, bitis=datetime.now(UTC)
    )


async def _set_job_if_processing(
    factory: async_sessionmaker[AsyncSession], job_id: uuid.UUID, **values: Any
) -> None:
    async with factory() as session:
        await session.execute(
            update(NdviJobModel)
            .where(NdviJobModel.id == job_id, NdviJobModel.durum == "isleniyor")
            .values(**values)
        )
        await session.commit()


async def fail_stale_jobs(factory: async_sessionmaker[AsyncSession] | None = None) -> int:
    """Açılışta: önceki süreçte yarıda kalan işleri hata olarak işaretler (kullanıcı yeniden başlatabilir)."""
    async with (factory or async_session_factory)() as session:
        count = await NdviRepository(session).fail_stale_jobs(
            "Sunucu yeniden başladığı için işlem yarıda kaldı. «Şimdi güncelle» ile devam edebilirsiniz."
        )
        await session.commit()
        return count
