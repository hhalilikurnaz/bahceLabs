from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status

from bahcelab_backend.api.deps import get_current_user, get_garden_service
from bahcelab_backend.domain.gardens.schemas import (
    GardenCreate,
    GardenResponse,
    GardenUpdate,
    MeasureRequest,
    MeasureResponse,
)
from bahcelab_backend.domain.gardens.service import GardenService

router = APIRouter(prefix="/gardens", tags=["gardens"], dependencies=[Depends(get_current_user)])

Service = Annotated[GardenService, Depends(get_garden_service)]


@router.get("", response_model=list[GardenResponse])
async def list_gardens(service: Service) -> list[GardenResponse]:
    return await service.list_gardens()


@router.post("", response_model=GardenResponse, status_code=status.HTTP_201_CREATED)
async def create_garden(request: GardenCreate, service: Service) -> GardenResponse:
    return await service.create(request)


@router.post("/measure", response_model=MeasureResponse)
async def measure_garden(request: MeasureRequest, service: Service) -> MeasureResponse:
    """Kaydetmeden önce sınırı doğrular ve alanı (dekar) hesaplar."""
    return await service.measure(request.geometry)


@router.get("/{garden_id}", response_model=GardenResponse)
async def get_garden(garden_id: UUID, service: Service) -> GardenResponse:
    return await service.get(garden_id)


@router.patch("/{garden_id}", response_model=GardenResponse)
async def update_garden(garden_id: UUID, request: GardenUpdate, service: Service) -> GardenResponse:
    return await service.update(garden_id, request)


@router.delete("/{garden_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_garden(garden_id: UUID, service: Service) -> None:
    await service.delete(garden_id)
