"""Kesinleşen ERA5 verisiyle sulama planı yeniden hesaplanır (ADR 0026). Kova isteğe bağlı hesaplandığından «yeniden hesap» yeni veri yazılınca kendiliğinden olur;
bu modül ONUN SONUCUNU izler: geçici (model) günler kesinleştiğinde plan değiştiyse bildirim üretir. ERA5 besleme işi (`water.feed.feed_cell`) çağırır."""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from bahcelab_backend.domain.irrigation.schemas import PlanYaniti
from bahcelab_backend.domain.irrigation.service import IrrigationService
from bahcelab_backend.domain.notifications.repository import NotificationRepository
from bahcelab_backend.domain.notifications.service import NotificationService
from bahcelab_backend.domain.notifications.types import Candidate
from bahcelab_backend.domain.water.era5_sync import garden_cell

logger = logging.getLogger(__name__)
SessionFactory = async_sessionmaker[AsyncSession]


@dataclass(frozen=True)
class Imza:
    """Kararın özeti: durum + önümüzdeki 7 günün sulama günleri."""

    durum: str
    gunler: tuple[date, ...]

    def sonraki(self) -> date | None:
        return self.gunler[0] if self.gunler else None


def imza_of(plan: PlanYaniti) -> Imza:
    son = plan.bugun + timedelta(days=7)
    return Imza(plan.durum, tuple(s.tarih for s in plan.sulamalar if s.tarih <= son))


@dataclass(frozen=True)
class Once:
    imzalar: dict[uuid.UUID, tuple[uuid.UUID, str, Imza]]  # bahçe → (çalışma alanı, ad, imza)
    gecici: frozenset[date]


async def gecici_gunler(session: AsyncSession, cell_id: uuid.UUID, today: date) -> frozenset[date]:
    rows = (await session.execute(text("SELECT tarih FROM era5_daily WHERE cell_id = :c AND hava_kaynak <> 'era5_land' AND tarih <= :t"), {"c": cell_id, "t": today})).all()
    return frozenset(r[0] for r in rows)


async def once_al(factory: SessionFactory, cell_id: uuid.UUID, today: date | None = None) -> Once:
    """Besleme ÖNCESİ: bu hücredeki sulama profilli bahçelerin kararı ve geçici günler."""
    today = today or datetime.now(UTC).date()
    out: dict[uuid.UUID, tuple[uuid.UUID, str, Imza]] = {}
    async with factory() as s:
        gec = await gecici_gunler(s, cell_id, today)
        rows = (await s.execute(text("SELECT g.id, g.workspace_id, g.ad FROM gardens g JOIN irrigation_profiles p ON p.garden_id = g.id"))).all()
        for gid, ws, ad in rows:
            try:
                if (await garden_cell(s, gid))[0] != cell_id:
                    continue
                out[gid] = (ws, ad, imza_of(await IrrigationService(s, ws).plan(gid, hafif=True)))
            except Exception:  # noqa: BLE001 - bir bahçenin hatası diğerlerini durdurmaz
                logger.exception("Sulama kararı özeti alınamadı (bahçe %s)", gid)
        await s.commit()
    return Once(out, gec)


def gun_metni(d: date | None) -> str:
    return "yok" if d is None else f"{d.day}.{d.month:02d}"


async def sonra_bildir(factory: SessionFactory, cell_id: uuid.UUID, once: Once, today: date | None = None) -> int:
    """Besleme SONRASI: geçici günlerden en az biri kesinleştiyse ve bir bahçenin sulama kararı değiştiyse «plan değişti» bildirimi (bahçe başına, kararın yeni hâli için tekil)."""
    today = today or datetime.now(UTC).date()
    uretilen = 0
    async with factory() as s:
        kesinlesen = once.gecici - await gecici_gunler(s, cell_id, today)
        if not kesinlesen:
            return 0
        for gid, (ws, ad, eski) in once.imzalar.items():
            try:
                yeni = imza_of(await IrrigationService(s, ws).plan(gid, hafif=True))
                if yeni == eski or yeni.durum != "hazir":
                    continue
                metin = f"{len(kesinlesen)} günün yağış/ET₀ verisi kesinleşti; sonraki sulama {gun_metni(eski.sonraki())} → {gun_metni(yeni.sonraki())}."
                cand = Candidate(gid, "sulama_revize", "onemli", f"{ad}: sulama planı kesinleşen veriyle değişti", metin, "su/sulama", f"sulamarevize:{gid}:{today}:{'-'.join(d.isoformat() for d in yeni.gunler)}")
                uretilen += len(await NotificationService(NotificationRepository(s, ws)).publish([cand]))
            except Exception:  # noqa: BLE001
                logger.exception("Plan değişikliği bildirimi üretilemedi (bahçe %s)", gid)
        await s.commit()
    return uretilen
