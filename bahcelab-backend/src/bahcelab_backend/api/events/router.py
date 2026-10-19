from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.api.deps import get_current_user, get_db_session, get_workspace_id
from bahcelab_backend.domain.events.schemas import OlaylarYanit, OlayYanit
from bahcelab_backend.domain.events.service import EventView, event_name, list_events
from bahcelab_backend.domain.fieldbook.service import FieldbookService
from bahcelab_backend.domain.gardens.repository import GardenRepository
from bahcelab_backend.shared.errors import AppError, AppErrorCode
from bahcelab_backend.shared.storage import get_storage

router = APIRouter(tags=["olaylar"], dependencies=[Depends(get_current_user)])


def to_response(e: EventView, verdicts: dict[tuple[str, str], str] | None = None) -> OlayYanit:
    return OlayYanit(
        id=e.id, tur=e.tur, tur_adi=event_name(e), turler=e.turler, baslangic=e.baslangic, bitis=e.bitis, alan_da=e.alan_da, guven=e.guven,  # type: ignore[arg-type]
        siddet=e.siddet, katman=e.katman, tahmin=e.tahmin, kaynak_sayisi=e.kaynak_sayisi, durum=e.durum, neden=e.neden, dogrulama=(verdicts or {}).get(("olay", e.anahtar)),  # type: ignore[arg-type]
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
    verdicts = await FieldbookService(session, get_storage()).verification_results(garden_id)
    return OlaylarYanit(
        olaylar=[to_response(e, verdicts) for e in await list_events(session, garden_id, since=baslangic, until=bitis)],
        supheler=[to_response(e, verdicts) for e in await list_events(session, garden_id, since=baslangic, until=bitis, suphe=True)],
        not_="Eşikler ön değerdir; don, yağış ve rüzgâr 9–31 km ERA5 ızgarasından gelir. Atmosfer şüpheleri olay sayılmaz.",
    )
