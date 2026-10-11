from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from bahcelab_backend.api.deps import get_current_user, get_notification_service
from bahcelab_backend.domain.notifications.schemas import (
    BildirimListesi,
    BildirimYanit,
    TercihGuncelle,
    TercihYanit,
    TopluOkundu,
)
from bahcelab_backend.domain.notifications.service import NotificationService

router = APIRouter(prefix="/notifications", tags=["notifications"], dependencies=[Depends(get_current_user)])
Service = Annotated[NotificationService, Depends(get_notification_service)]


@router.get("", response_model=BildirimListesi)
async def list_notifications(
    service: Service,
    tur: str | None = None,
    bahce: UUID | None = None,
    okunmamis: bool = False,
    sayfa: Annotated[int, Query(ge=1)] = 1,
    boyut: Annotated[int, Query(ge=1, le=100)] = 20,
) -> BildirimListesi:
    """Bildirim listesi (yeniden eskiye, sayfalı); tür, bahçe ve okunmamış filtresi."""
    return await service.list_page(tur=tur, garden_id=bahce, unread_only=okunmamis, page=sayfa, size=boyut)


@router.post("/okundu", response_model=TopluOkundu)
async def mark_all_read(service: Service, tur: str | None = None, bahce: UUID | None = None) -> TopluOkundu:
    """Tümünü (isteğe bağlı tür/bahçe süzgeciyle) okundu işaretler."""
    return await service.mark_all_read(tur=tur, garden_id=bahce)


@router.get("/tercihler", response_model=list[TercihYanit])
async def get_preferences(service: Service) -> list[TercihYanit]:
    return await service.preferences()


@router.put("/tercihler/{tur}", response_model=list[TercihYanit])
async def set_preference(tur: str, body: TercihGuncelle, service: Service) -> list[TercihYanit]:
    return await service.set_preference(tur, body.acik)


@router.post("/{notification_id}/okundu", response_model=BildirimYanit)
async def mark_read(notification_id: UUID, service: Service) -> BildirimYanit:
    return await service.mark_read(notification_id)
