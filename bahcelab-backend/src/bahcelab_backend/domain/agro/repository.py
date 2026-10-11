import uuid

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.domain.agro.models import PhenologyOverrideModel


class AgroRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def overrides(self, garden_id: uuid.UUID) -> dict[str, PhenologyOverrideModel]:
        rows = (
            await self.session.execute(
                select(PhenologyOverrideModel).where(PhenologyOverrideModel.garden_id == garden_id)
            )
        ).scalars()
        return {row.evre_kodu: row for row in rows}

    async def set_override(self, garden_id: uuid.UUID, stage: str, start: str, end: str) -> None:
        existing = await self.session.get(PhenologyOverrideModel, (garden_id, stage))
        if existing is None:
            self.session.add(PhenologyOverrideModel(garden_id=garden_id, evre_kodu=stage, baslangic=start, bitis=end))
        else:
            existing.baslangic, existing.bitis = start, end
        await self.session.flush()

    async def delete_override(self, garden_id: uuid.UUID, stage: str) -> None:
        await self.session.execute(
            delete(PhenologyOverrideModel).where(
                PhenologyOverrideModel.garden_id == garden_id, PhenologyOverrideModel.evre_kodu == stage
            )
        )
