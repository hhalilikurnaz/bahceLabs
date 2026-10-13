from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from bahcelab_backend.api.deps import get_current_user, get_water_service
from bahcelab_backend.domain.water.schemas import SuYaniti
from bahcelab_backend.domain.water.service import WaterService

router = APIRouter(tags=["su"], dependencies=[Depends(get_current_user)])
Service = Annotated[WaterService, Depends(get_water_service)]


@router.get("/gardens/{garden_id}/su", response_model=SuYaniti)
async def get_water(garden_id: UUID, service: Service) -> SuYaniti:
    """Su sekmesi: karar cümlesi, toprak nem profili (ERA5-Land), su dengesi (yağış, ETc, kova), yüzey–hava sıcaklığı (Landsat). Katsayılar ön değerdir."""
    return await service.su(garden_id)
