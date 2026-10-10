"""NDVI arka plan işleyicisi: son 13 ayın sahnelerini bahçe sınırı penceresiyle işler.

Basit, süreç içi bir iş kuyruğudur: iş durumu veritabanında tutulur, aynı anda en fazla
`ndvi_max_parallel_scenes` sahne işlenir (tüm işler arasında ortak sınır).
"""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from collections.abc import Callable
from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy import text, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from bahcelab_backend.config import get_settings
from bahcelab_backend.database import async_session_factory
from bahcelab_backend.domain.ndvi import stac
from bahcelab_backend.domain.ndvi.models import NdviJobModel, NdviObservationModel
from bahcelab_backend.domain.ndvi.processing import Analysis, analyze_scene
from bahcelab_backend.domain.ndvi.repository import NdviRepository
from bahcelab_backend.domain.ndvi.rules import months_back
from bahcelab_backend.shared.storage import StorageBackend, get_storage

logger = logging.getLogger(__name__)

_SLOTS: dict[int, asyncio.Semaphore] = {}


def _slots(limit: int) -> asyncio.Semaphore:
    """Event loop başına tek semafor: tüm bahçelerin işleri aynı sınırı paylaşır."""
    return _SLOTS.setdefault(id(asyncio.get_running_loop()), asyncio.Semaphore(limit))


def png_key(garden_id: uuid.UUID, tarih: date) -> str:
    return f"ndvi/{garden_id}/{tarih.isoformat()}.png"


def observation_from_analysis(
    garden_id: uuid.UUID,
    tarih: date,
    scene_id: str,
    cloud_cover: float | None,
    analysis: Analysis,
    *,
    key: str | None,
    source: str = "sentinel-2",
) -> NdviObservationModel:
    return NdviObservationModel(
        garden_id=garden_id,
        tarih=tarih,
        scene_id=scene_id,
        durum="bulutlu" if analysis.bulutlu else "tamam",
        bulut_orani=cloud_cover,
        gecerli_piksel_orani=analysis.gecerli_piksel_orani,
        ortalama=analysis.ortalama,
        medyan=analysis.medyan,
        p10=analysis.p10,
        p90=analysis.p90,
        minimum=analysis.minimum,
        maksimum=analysis.maksimum,
        png_yolu=key,
        sorunlu_bolge_geojson=analysis.sorunlu_bolgeler,
        goruntu_koordinatlari=analysis.koordinatlar,
        kaynak=source,
    )


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
    """Bir NDVI işini baştan sona çalıştırır. Hiçbir koşulda istisna dışarı sızmaz (uygulama çökmesin)."""
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
        logger.exception("NDVI işi beklenmedik şekilde başarısız oldu: %s", job_id)
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

    async with factory() as session:
        repo = NdviRepository(session)
        job = await repo.get_job(job_id)
        if job is None or job.durum != "bekliyor":
            return
        garden_id, tur = job.garden_id, job.tur
        geometry = await _geometry(session, garden_id)
        geometry_hash = await repo.geometry_hash(garden_id)
        existing = await repo.existing_dates(garden_id)
        if geometry is None:  # bahçe arada silinmiş
            return
        job.durum = "isleniyor"
        job.baslangic = datetime.now(UTC)
        await session.commit()

    start = months_back(today, settings.ndvi_months)
    if tur == "guncelleme" and existing:
        start = max(start, max(existing) - timedelta(days=5))

    try:
        scenes = await asyncio.to_thread(search, geometry, start, today)
    except stac.NdviSourceError as exc:
        await _set_job(factory, job_id, durum="hata", hata_mesaji=str(exc), bitis=datetime.now(UTC))
        return

    pending = [scene for scene in scenes if scene.tarih not in existing]
    await _set_job(factory, job_id, toplam=len(pending))

    slots = _slots(settings.ndvi_max_parallel_scenes)
    state = {"failed": 0, "aborted": False}

    async def handle(scene: stac.Scene) -> None:
        async with slots:
            if state["aborted"]:
                return
            try:
                data = await asyncio.to_thread(read, scene, geometry)
                analysis = await asyncio.to_thread(analyze_scene, data, geometry)
            except Exception as exc:  # noqa: BLE001 - tek sahne hatası işi durdurmaz
                state["failed"] += 1
                logger.warning("Sahne işlenemedi %s: %s", scene.scene_id, exc)
                return

            key = None if analysis.bulutlu else png_key(garden_id, scene.tarih)
            async with factory() as session:
                repo = NdviRepository(session)
                # Kontrol ve yazma aynı işlemde: sınır değiştiyse (veya bahçe silindiyse) hiçbir şey yazılmaz
                if await repo.lock_geometry_hash(garden_id) != geometry_hash:
                    state["aborted"] = True
                    return
                if key and analysis.png:
                    storage.save(key, analysis.png)
                added = await repo.add_observation(
                    observation_from_analysis(
                        garden_id, scene.tarih, scene.scene_id, scene.bulut_orani, analysis, key=key
                    )
                )
                await session.commit()
            if not added and key:
                storage.delete(key)  # aynı tarih başka bir iş tarafından yazılmış
            async with factory() as session:
                await session.execute(
                    update(NdviJobModel)
                    .where(NdviJobModel.id == job_id, NdviJobModel.durum == "isleniyor")
                    .values(islenen=NdviJobModel.islenen + 1)
                )
                await session.commit()

    await asyncio.gather(*(handle(scene) for scene in pending))

    if state["aborted"]:
        # Sınır değişti veya bahçe silindi: sonuçlar atıldı. Sınır değişimi yeni işi zaten sıraya aldı.
        async with factory() as session:
            await session.execute(
                update(NdviJobModel)
                .where(NdviJobModel.id == job_id, NdviJobModel.durum == "isleniyor")
                .values(
                    durum="hata",
                    hata_mesaji="Bahçe sınırı değiştiği için sonuçlar atıldı.",
                    bitis=datetime.now(UTC),
                )
            )
            await session.commit()
        return

    failed = state["failed"]
    if pending and failed == len(pending):
        status, message = (
            "hata",
            (
                "Uydu görüntüleri okunamadı. Planetary Computer'a ulaşılamıyor olabilir; "
                "biraz sonra «Şimdi güncelle» ile tekrar deneyin."
            ),
        )
    elif failed:
        status, message = (
            "tamam",
            f"{failed} sahne işlenemedi; sonraki güncellemede yeniden denenecek.",
        )
    else:
        status, message = "tamam", None
    async with factory() as session:
        await session.execute(
            update(NdviJobModel)
            .where(NdviJobModel.id == job_id, NdviJobModel.durum == "isleniyor")
            .values(durum=status, hata_mesaji=message, bitis=datetime.now(UTC))
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
