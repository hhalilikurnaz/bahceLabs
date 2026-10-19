from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.api.deps import get_current_user, get_db_session, get_workspace_id
from bahcelab_backend.domain.gardens.repository import GardenRepository
from bahcelab_backend.domain.gecmis.schemas import GecmisOzeti
from bahcelab_backend.domain.gecmis.service import build_summary
from bahcelab_backend.shared.clock import today_istanbul
from bahcelab_backend.shared.errors import AppError, AppErrorCode

router = APIRouter(tags=["gecmis"], dependencies=[Depends(get_current_user)])


@router.get("/gardens/{garden_id}/gecmis-ozeti", response_model=GecmisOzeti)
async def get_history_summary(
    garden_id: UUID,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    workspace_id: Annotated[UUID, Depends(get_workspace_id)],
) -> GecmisOzeti:
    """Geçmiş sayfası: yıl yıl özet (canlılık sapması kademe diliyle, olay sayısı, uyumsuz yıl, hasat) ve güvenilir yeşerme başlangıçları."""
    if await GardenRepository(session, workspace_id).get(garden_id) is None:
        raise AppError(404, AppErrorCode.NOT_FOUND, "Bahçe bulunamadı.")
    return await build_summary(session, garden_id, today_istanbul())
