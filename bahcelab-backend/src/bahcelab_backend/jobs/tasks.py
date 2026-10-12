"""Zamanlanmış iş gövdeleri. Hepsi İDEMPOTENT'tir: tekrar çalıştırmak aynı sonucu verir (bildirimler `dedupe_key` ile tekildir,
hava önbelleği 1 saatlik TTL'dir, risk özeti üzerine yazılır) ve bir bahçedeki hata diğerlerini durdurmaz."""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from bahcelab_backend.domain.agro.repository import AgroRepository
from bahcelab_backend.domain.agro.score import active_risks_of
from bahcelab_backend.domain.agro.service import AgroService
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
                _, scenes, weather, risks, irrigation = await agro.assess(garden_id)
                candidates = build_candidates(
                    garden_id, name,
                    weather_alerts=weather.uyarilar if weather else [],
                    satellite_alerts=build_alerts(scenes),
                    irrigation=irrigation,
                    today=agro.current_date(),
                )
                notifier = NotificationService(NotificationRepository(session, workspace_id))
                created = await notifier.publish(candidates)
                new_risk = await notifier.reconcile_risks(garden_id, name, [r for r, _, _ in risks])
                await RiskSnapshotRepository(session).save(garden_id, [{"ad": r.ad, "seviye": r.seviye} for r in active_risks_of(risks)])
                await session.commit()
            result.isler += 1
            result.uretilen += len(created) + new_risk
        except Exception:  # noqa: BLE001
            logger.exception("Bildirim üretimi başarısız (bahçe %s)", garden_id)
            result.hata += 1
    return result
