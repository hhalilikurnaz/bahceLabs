"""İç uyarılar (9J): INTERNAL_EMAILS'teki kullanıcıların çalışma alanlarına işletme bildirimi (anında; günlük özeti beklemez). Aynı olay için tek kayıt (dedupe)."""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.config import get_settings
from bahcelab_backend.domain.notifications.repository import NotificationRepository
from bahcelab_backend.domain.notifications.service import NotificationService
from bahcelab_backend.domain.notifications.types import SISTEM_TURU, Candidate

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class IcUyari:
    dedupe: str
    baslik: str
    metin: str


def eposta_izinli(eposta: str, izinli: list[str]) -> bool:
    e = eposta.lower()
    return any(e == i or (i.startswith("*@") and e.endswith(i[1:])) for i in izinli)


async def ic_calisma_alanlari(session: AsyncSession) -> list[uuid.UUID]:
    izinli = [e.strip().lower() for e in get_settings().internal_emails.split(",") if e.strip()]
    if not izinli:
        return []
    rows = (await session.execute(text("SELECT u.email, m.workspace_id FROM users u JOIN workspace_members m ON m.user_id = u.id"))).all()
    return sorted({r[1] for r in rows if eposta_izinli(r[0], izinli)})


async def yayinla(session: AsyncSession, uyarilar: list[IcUyari]) -> int:
    """Her iç çalışma alanına işletme (sistem) bildirimi; döner: yeni kayıt sayısı."""
    n = 0
    for ws in await ic_calisma_alanlari(session):
        svc = NotificationService(NotificationRepository(session, ws))
        cands = [Candidate(None, SISTEM_TURU, "onemli", f"İç izleme: {u.baslik}", u.metin, "ic/kalite", f"izleme:{u.dedupe}") for u in uyarilar]
        n += len(await svc.publish_operational(cands))
    return n
