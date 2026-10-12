from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from bahcelab_backend.api.deps import get_current_user, get_data_foundation_service
from bahcelab_backend.domain.acquisitions.schemas import GecmisDoldurmaDurumu, NormalBantlar
from bahcelab_backend.domain.acquisitions.service import DataFoundationService

router = APIRouter(tags=["veri-temeli"], dependencies=[Depends(get_current_user)])
Service = Annotated[DataFoundationService, Depends(get_data_foundation_service)]


@router.post("/gardens/{garden_id}/gecmis-doldurma", response_model=GecmisDoldurmaDurumu, status_code=status.HTTP_202_ACCEPTED)
async def start_backfill(garden_id: UUID, service: Service) -> GecmisDoldurmaDurumu:
    """2015'ten bugüne geçmiş doldurmayı başlatır / kaldığı yerden sürdürür (idempotent)."""
    return await service.start(garden_id)


@router.get("/gardens/{garden_id}/gecmis-doldurma", response_model=GecmisDoldurmaDurumu)
async def get_backfill(garden_id: UUID, service: Service, ayrinti: Annotated[bool, Query(description="Ay ay döküm")] = False) -> GecmisDoldurmaDurumu:
    """İlerleme: tamamlanan ay / toplam, net sahne sayısı, depolama boyutu."""
    return await service.status(garden_id, detail=ayrinti)


@router.get("/gardens/{garden_id}/normal-bantlar", response_model=NormalBantlar)
async def get_normal_bands(garden_id: UUID, service: Service) -> NormalBantlar:
    """Gösterge × ay normal bantları (p10/p25/ortanca/p75/p90). Yetersiz geçmişte yüzdelikler boştur."""
    return await service.normal_bands(garden_id)
