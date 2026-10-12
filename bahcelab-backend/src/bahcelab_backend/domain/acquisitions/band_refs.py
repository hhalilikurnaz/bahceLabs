"""Durum kararı için normal bant referansları: bahçe × gösterge × takvim ayı → ortanca ve MAD (yıl değerlerinden)."""

from __future__ import annotations

import statistics
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.domain.acquisitions.models import NormalBandModel
from bahcelab_backend.domain.acquisitions.processor import SOURCE_ID
from bahcelab_backend.domain.agro.score import BandRef

DECISION_INDICATORS = ("ndvi", "ndmi")


async def band_refs_for(session: AsyncSession, garden_ids: list[uuid.UUID], month: int) -> dict[uuid.UUID, dict[str, BandRef]]:
    """{bahçe: {gösterge: BandRef}}: yalnız `ceyrek_yeterli` bantlar (p25–p75 için asgari yıl) karar için kullanılır."""
    if not garden_ids:
        return {}
    rows = (
        await session.execute(
            select(NormalBandModel).where(NormalBandModel.garden_id.in_(garden_ids), NormalBandModel.source_id == SOURCE_ID, NormalBandModel.ay == month, NormalBandModel.indeks.in_(DECISION_INDICATORS))
        )
    ).scalars().all()
    out: dict[uuid.UUID, dict[str, BandRef]] = {}
    for r in rows:
        values = [float(v) for v in (r.ayrinti or {}).values()]
        if not values or not r.ceyrek_yeterli or r.p50 is None:
            continue
        median = float(r.p50)
        mad = statistics.median(abs(v - median) for v in values)
        out.setdefault(r.garden_id, {})[r.indeks] = BandRef(ay=r.ay, yil_sayisi=r.yil_sayisi, yillar=[int(y) for y in r.yillar], median=median, mad=mad)
    return out
