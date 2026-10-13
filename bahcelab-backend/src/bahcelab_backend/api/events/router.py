from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.api.deps import get_current_user, get_db_session, get_workspace_id
from bahcelab_backend.domain.events.schemas import OlaylarYanit, OlayYanit
from bahcelab_backend.domain.events.service import EventView, list_events
from bahcelab_backend.domain.gardens.repository import GardenRepository
from bahcelab_backend.domain.notifications.templates import EVENT_TITLES
from bahcelab_backend.shared.errors import AppError, AppErrorCode

router = APIRouter(tags=["olaylar"], dependencies=[Depends(get_current_user)])
NAMES = {**{k: v.capitalize() for k, v in EVENT_TITLES.items()}, "s2_suphe": "Atmosfer şüphesi"}


def to_response(e: EventView) -> OlayYanit:
    return OlayYanit(
        id=e.id, tur=e.tur, tur_adi=NAMES.get(e.tur, e.tur), turler=e.turler, baslangic=e.baslangic, bitis=e.bitis, alan_da=e.alan_da, guven=e.guven,  # type: ignore[arg-type]
        siddet=e.siddet, katman=e.katman, tahmin=e.tahmin, kaynak_sayisi=e.kaynak_sayisi,
    )


@router.get("/gardens/{garden_id}/olaylar", response_model=OlaylarYanit)
async def get_events(
    garden_id: UUID,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    workspace_id: Annotated[UUID, Depends(get_workspace_id)],
    baslangic: Annotated[date | None, Query()] = None,
    bitis: Annotated[date | None, Query()] = None,
) -> OlaylarYanit:
    """Olay motoru kayıtları (don, aşırı yağış, rüzgâr, S2 düşüşü, radar) — yeniden eskiye. Kaynak kayıtları kopyalanmaz; kimlikle referanslanır."""
    if await GardenRepository(session, workspace_id).get(garden_id) is None:
        raise AppError(404, AppErrorCode.NOT_FOUND, "Bahçe bulunamadı.")
    return OlaylarYanit(
        olaylar=[to_response(e) for e in await list_events(session, garden_id, since=baslangic, until=bitis)],
        supheler=[to_response(e) for e in await list_events(session, garden_id, since=baslangic, until=bitis, suphe=True)],
        not_="Eşikler ön değerdir; don, yağış ve rüzgâr 9–31 km ERA5 ızgarasından gelir. Atmosfer şüpheleri olay sayılmaz.",
    )
