"""Zamanlanmış iş gövdeleri. Hepsi İDEMPOTENT'tir: tekrar çalıştırmak aynı sonucu verir (bildirimler `dedupe_key` ile tekildir,
hava önbelleği 1 saatlik TTL'dir, risk özeti üzerine yazılır) ve bir bahçedeki hata diğerlerini durdurmaz."""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from bahcelab_backend.domain.agro.repository import AgroRepository
from bahcelab_backend.domain.agro.service import AgroService
from bahcelab_backend.domain.agro.tiers import active_risks_of
from bahcelab_backend.domain.auth.models import WorkspaceModel
from bahcelab_backend.domain.gardens.models import GardenModel
from bahcelab_backend.domain.gardens.repository import GardenRepository
from bahcelab_backend.domain.ndvi.repository import NdviRepository
from bahcelab_backend.domain.ndvi.rules import build_alerts
from bahcelab_backend.domain.notifications.generator import build_candidates
from bahcelab_backend.domain.notifications.repository import (
    NotificationRepository,
    RiskSnapshotRepository,
)
from bahcelab_backend.domain.notifications.service import NotificationService
from bahcelab_backend.domain.notifications.types import Candidate
from bahcelab_backend.domain.weather.provider import WeatherProvider
from bahcelab_backend.domain.weather.repository import WeatherRepository
from bahcelab_backend.domain.weather.service import WeatherService

logger = logging.getLogger(__name__)
SessionFactory = async_sessionmaker[AsyncSession]


@dataclass
class JobResult:
    isler: int = 0  # işlenen çalışma alanı / bahçe sayısı
    uretilen: int = 0  # yeni bildirim
    hata: int = 0


async def refresh_acquisitions(factory: SessionFactory, provider: WeatherProvider) -> JobResult:  # noqa: ARG001 - zamanlayıcı imzası
    """Günlük artımlı çekim (ADR 0015): geçmiş doldurması başlamış bahçeler için son aylardaki YENİ sahneleri edinir; bütçe doluysa okuma yapılmaz."""
    from bahcelab_backend.domain.acquisitions.backfill import BackfillRunner, refresh_recent
    from bahcelab_backend.domain.imagery.registry import (
        get_imagery_provider,
        get_landsat_provider,
        get_radar_provider,
    )
    from bahcelab_backend.shared.storage import get_storage

    result = JobResult()
    try:
        result.isler = await refresh_recent(factory, BackfillRunner(factory, get_imagery_provider(), get_storage(), radar_provider=get_radar_provider(), landsat_provider=get_landsat_provider()))
    except Exception:  # noqa: BLE001
        logger.exception("Artımlı sahne çekimi başarısız")
        result.hata += 1
    return result


async def refresh_era5(factory: SessionFactory, provider: WeatherProvider) -> JobResult:  # noqa: ARG001 - zamanlayıcı imzası
    """Günlük ERA5 artımlı çekimi (ADR 0018): her hava hücresi bir kez; son ERA5-Land gününden 10 gün geriden + model tahmini. İdempotent."""
    from bahcelab_backend.domain.water.feed import feed_all

    result = JobResult()
    try:
        counts = await feed_all(factory)
        result.isler, result.hata = counts["hucre"], counts["hata"]
    except Exception:  # noqa: BLE001
        logger.exception("ERA5 günlük çekimi başarısız")
        result.hata += 1
    return result


async def refresh_hls(factory: SessionFactory, provider: WeatherProvider) -> JobResult:  # noqa: ARG001
    """Günlük HLS artımlı çekimi: her bahçe için son 45 gün (idempotent; eksik sahneler tamamlanır)."""
    from bahcelab_backend.jobs.feed import feed_hls

    result = JobResult()
    async with factory() as session:
        ids = [r[0] for r in (await session.execute(select(GardenModel.id))).all()]
    for garden_id in ids:
        outcome = await feed_hls(garden_id, days=45)
        result.isler += 1
        result.hata += 1 if outcome == "hata" else 0
    return result


async def resume_feeds(factory: SessionFactory, provider: WeatherProvider) -> JobResult:  # noqa: ARG001
    """Bekçi (15 dk): kalp atışı kesilen besleme işlerini «kesildi» yapar (log + bildirim) ve kaldığı yerden devam ettirir; başarısızları geri çekilmeyle yeniden dener."""
    from bahcelab_backend.domain.feedruns.service import resume_feeds as resume

    result = JobResult()
    try:
        counts = await resume(factory)
        result.isler, result.hata = counts["devam"], counts["kesilen"]
    except Exception:  # noqa: BLE001
        logger.exception("Besleme bekçisi başarısız")
        result.hata += 1
    return result


async def refresh_validation(factory: SessionFactory, provider: WeatherProvider) -> JobResult:  # noqa: ARG001
    """Günlük SMAP/IMERG doğrulama tamamlaması (eksik günler; belirteç yoksa atlanır)."""
    from bahcelab_backend.domain.water.feed import validation_all

    result = JobResult()
    try:
        counts = await validation_all(factory)
        result.isler = counts["bahce"]
    except Exception:  # noqa: BLE001
        logger.exception("Doğrulama günlük çekimi başarısız")
        result.hata += 1
    return result


async def event_and_tier_candidates(session: AsyncSession, agro: AgroService, garden_id: uuid.UUID, name: str) -> list[Candidate]:
    """Taze olaylar ve Durum v2 kademe DÜŞÜŞÜ → bildirim adayları (karar katmanı kritik/önemli ayrımını yapar). Kademe anlık görüntüsü güncellenir."""
    from bahcelab_backend.domain.agro.catalog import load_catalog
    from bahcelab_backend.domain.events.service import list_events
    from bahcelab_backend.domain.notifications.event_candidates import (
        event_candidate,
        tier_candidate,
    )
    from bahcelab_backend.domain.notifications.repository import StatusSnapshotRepository

    rule = load_catalog().bildirim
    today = agro.current_date()
    out: list[Candidate] = []
    from datetime import timedelta

    for e in await list_events(session, garden_id, since=today - timedelta(days=rule.taze_olay_gun)):
        candidate = event_candidate(garden_id, name, e, today, rule, e.anahtar)
        if candidate is not None:
            out.append(candidate)
    from bahcelab_backend.domain.notifications import decision
    from bahcelab_backend.domain.notifications.repository import NotificationRepository

    notifier = NotificationRepository(session, agro.gardens.workspace_id)
    for doubt in await list_events(session, garden_id, suphe=True, since=today - timedelta(days=60)):
        if doubt.neden in ("toparlandi", "teyit_edilemedi"):  # sonraki net görüntü doğrulamadı: önceden gönderilen «doğrulama bekliyor» bildirimi atmosfer notuyla kapanır
            sent = await notifier.by_key(decision.event_dedupe_key(garden_id, f"s2_dusus:{doubt.baslangic.isoformat()}"))
            if sent is not None:
                await notifier.close_with_note(sent, "Sonraki net uydu görüntüsü düşüşü doğrulamadı: bulut/hava (atmosfer) kaynaklı olabilir; olay sayılmadı.")
    status = await agro.status_v2_result(garden_id, today)
    snapshots = StatusSnapshotRepository(session)
    previous = await snapshots.get(garden_id)
    tier = tier_candidate(garden_id, name, previous, status.kademe, status.nasil, today)
    if tier is not None:
        out.append(tier)
    if status.kademe != "veri_yok":
        await snapshots.save(garden_id, status.kademe)
    return out


async def refresh_events(factory: SessionFactory, provider: WeatherProvider) -> JobResult:  # noqa: ARG001 - zamanlayıcı imzası
    """Günlük olay yeniden hesabı (ADR 0018): her bahçe için tüm kaynaklardan olaylar kurulur; idempotent, olay kimlikleri sabit kalır."""
    from bahcelab_backend.domain.events.service import compute_events_for
    from bahcelab_backend.shared.storage import get_storage

    result = JobResult()
    async with factory() as session:
        ids = [r[0] for r in (await session.execute(select(GardenModel.id))).all()]
    for garden_id in ids:
        try:
            async with factory() as session:
                await compute_events_for(session, get_storage(), garden_id)
                await session.commit()
            result.isler += 1
        except Exception:  # noqa: BLE001 — bir bahçenin hatası diğerlerini durdurmaz
            logger.exception("Olay hesabı başarısız (bahçe %s)", garden_id)
            result.hata += 1
    return result


async def send_digest(factory: SessionFactory, provider: WeatherProvider, *, now_local: datetime | None = None) -> JobResult:  # noqa: ARG001
    """Günlük TEK özet (ADR 0018): her çalışma alanı için; vakti gelmediyse, sessiz saatteyse ya da bugün üretildiyse hiçbir şey yapmaz (idempotent)."""
    from zoneinfo import ZoneInfo

    from bahcelab_backend.domain.weather.provider import TIMEZONE

    now = now_local or datetime.now(ZoneInfo(TIMEZONE))
    result = JobResult()
    async with factory() as session:
        workspaces = list((await session.execute(select(WorkspaceModel.id))).scalars())
    for workspace_id in workspaces:
        try:
            async with factory() as session:
                row = await NotificationService(NotificationRepository(session, workspace_id)).build_digest(now)
                await session.commit()
            result.isler += 1
            result.uretilen += 1 if row is not None else 0
        except Exception:  # noqa: BLE001
            logger.exception("Özet üretimi başarısız (çalışma alanı %s)", workspace_id)
            result.hata += 1
    return result


async def refresh_weather(factory: SessionFactory, provider: WeatherProvider, *, workspace_id: uuid.UUID | None = None) -> JobResult:
    """Tüm çalışma alanlarının hava hücrelerini tazeler (1 saatlik önbellek: sık çağrı sağlayıcıya yük bindirmez)."""
    result = JobResult()
    async with factory() as session:
        query = select(WorkspaceModel.id)
        if workspace_id is not None:  # hedefli çalıştırma (test / elle tetikleme)
            query = query.where(WorkspaceModel.id == workspace_id)
        workspaces = list((await session.execute(query)).scalars())
    for workspace_id in workspaces:
        try:
            async with factory() as session:
                await WeatherService(WeatherRepository(session, workspace_id), provider).overview()
                await session.commit()
            result.isler += 1
        except Exception:  # noqa: BLE001 — bir çalışma alanının hatası diğerlerini durdurmamalı
            logger.exception("Hava tazeleme başarısız (çalışma alanı %s)", workspace_id)
            result.hata += 1
    return result


async def generate_notifications(factory: SessionFactory, provider: WeatherProvider, *, workspace_id: uuid.UUID | None = None) -> JobResult:
    """Her bahçe için riskleri/uyarıları hesaplar, risk özetini kaydeder ve yeni olaylar için bildirim üretir."""
    result = JobResult()
    async with factory() as session:
        query = select(GardenModel.id, GardenModel.workspace_id, GardenModel.ad)
        if workspace_id is not None:
            query = query.where(GardenModel.workspace_id == workspace_id)
        gardens = [(r.id, r.workspace_id, r.ad) for r in (await session.execute(query)).all()]
    for garden_id, workspace_id, name in gardens:
        try:
            async with factory() as session:
                agro = AgroService(
                    GardenRepository(session, workspace_id), NdviRepository(session),
                    WeatherService(WeatherRepository(session, workspace_id), provider), AgroRepository(session),
                )
                scenes, weather, risks, irrigation = await agro.collect(garden_id)
                extra = await event_and_tier_candidates(session, agro, garden_id, name)
                candidates = build_candidates(
                    garden_id, name,
                    weather_alerts=weather.uyarilar if weather else [],
                    satellite_alerts=build_alerts(scenes),
                    irrigation=irrigation,
                    today=agro.current_date(),
                )
                notifier = NotificationService(NotificationRepository(session, workspace_id))
                created = await notifier.publish([*candidates, *extra])
                new_risk = await notifier.reconcile_risks(garden_id, name, [r for r, _, _ in risks])
                await RiskSnapshotRepository(session).save(garden_id, [{"ad": r.ad, "seviye": r.seviye} for r in active_risks_of(risks)])
                await session.commit()
            result.isler += 1
            result.uretilen += len(created) + new_risk
        except Exception:  # noqa: BLE001
            logger.exception("Bildirim üretimi başarısız (bahçe %s)", garden_id)
            result.hata += 1
    return result
