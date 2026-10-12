"""Veri temeli servisi: yetki denetimi + geçmiş doldurma durumu + normal bantlar."""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.domain.acquisitions.backfill import BackfillService
from bahcelab_backend.domain.acquisitions.processor import SOURCE_ID
from bahcelab_backend.domain.acquisitions.repository import AcquisitionRepository
from bahcelab_backend.domain.acquisitions.schemas import (
    GecmisAy,
    GecmisDoldurmaDurumu,
    NormalBantAy,
    NormalBantlar,
)
from bahcelab_backend.domain.agro import catalog as cat
from bahcelab_backend.domain.gardens.repository import GardenRepository
from bahcelab_backend.shared.errors import AppError, AppErrorCode


class DataFoundationService:
    def __init__(self, session: AsyncSession, workspace_id: uuid.UUID, backfill: BackfillService) -> None:
        self.session = session
        self.gardens = GardenRepository(session, workspace_id)
        self.repo = AcquisitionRepository(session)
        self.backfill = backfill

    async def _check(self, garden_id: uuid.UUID) -> None:
        if await self.gardens.get(garden_id) is None:
            raise AppError(404, AppErrorCode.NOT_FOUND, "Bahçe bulunamadı.")

    async def start(self, garden_id: uuid.UUID) -> GecmisDoldurmaDurumu:
        await self._check(garden_id)
        return GecmisDoldurmaDurumu(**await self.backfill.start(garden_id))

    async def status(self, garden_id: uuid.UUID, *, detail: bool = False) -> GecmisDoldurmaDurumu:
        await self._check(garden_id)
        data = await self.backfill.status(garden_id)
        months = None
        if detail:
            months = [GecmisAy(ay=m.ay, durum=m.durum, net_sahne=m.net_sahne, aday_sayisi=m.aday_sayisi, hata_mesaji=m.hata_mesaji, sure_saniye=m.sure_saniye) for m in await self.repo.month_rows(garden_id, SOURCE_ID)]  # type: ignore[arg-type]
        return GecmisDoldurmaDurumu(**data, aylar=months)

    async def normal_bands(self, garden_id: uuid.UUID) -> NormalBantlar:
        await self._check(garden_id)
        rule = cat.load_catalog().normal_bant
        rows = await self.repo.bands(garden_id, SOURCE_ID)
        out: dict[str, list[NormalBantAy]] = {}
        for r in rows:
            state = "yeterli" if r.onluk_yeterli else "kismi" if r.ceyrek_yeterli else "yetersiz_gecmis"
            out.setdefault(r.indeks, []).append(
                NormalBantAy(ay=r.ay, yil_sayisi=r.yil_sayisi, yillar=list(r.yillar), p10=r.p10, p25=r.p25, p50=r.p50, p75=r.p75, p90=r.p90, ceyrek_yeterli=r.ceyrek_yeterli, onluk_yeterli=r.onluk_yeterli, durum=state)  # type: ignore[arg-type]
            )
        progress = await self.backfill.status(garden_id)
        return NormalBantlar(
            kaynak=SOURCE_ID, formul_surumu=rows[0].formul_surumu if rows else None, asgari_yil_ceyrek=rule.asgari_yil_ceyrek, asgari_yil_onluk=rule.asgari_yil_onluk,
            esik_durumu=rule.durum, gostergeler=out, hazir=progress["durum"] == "tamam" and bool(rows),
        )
