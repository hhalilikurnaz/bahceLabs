"""Bildirim kapısı (bahçe/çalışma alanı bazlı): `don.bildirim_kapisi` = kapali | ic_pilot | acik. ic_pilot: yalnız INTERNAL_EMAILS kullanıcılarının çalışma alanları (bu kış iç pilot; açma kararı bahar sonunda pilot verisiyle)."""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.domain.agro.catalog import DonKurali, load_catalog
from bahcelab_backend.domain.izleme.uyari import ic_calisma_alanlari


async def calisma_alani_acik_mi(session: AsyncSession, workspace_id: uuid.UUID, kural: DonKurali | None = None) -> bool:
    k = kural or load_catalog().don
    if k.bildirim_kapisi == "acik":
        return True
    if k.bildirim_kapisi == "kapali":
        return False
    return workspace_id in await ic_calisma_alanlari(session)
