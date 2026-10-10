from datetime import date, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from bahcelab_backend.api.deps import get_current_user, get_weather_service
from bahcelab_backend.domain.weather.schemas import GecmisYanit, HavaOzeti, HavaYanit
from bahcelab_backend.domain.weather.service import WeatherService

router = APIRouter(tags=["weather"], dependencies=[Depends(get_current_user)])

Service = Annotated[WeatherService, Depends(get_weather_service)]


@router.get("/weather/ozet", response_model=list[HavaOzeti])
async def weather_overview(service: Service) -> list[HavaOzeti]:
    """Tüm bahçelerin kısa hava özeti: şu anki durum, don/sıcak uyarıları, ilk uygun ilaçlama aralığı."""
    return await service.overview()


@router.get("/gardens/{garden_id}/weather", response_model=HavaYanit)
async def get_weather(garden_id: UUID, service: Service) -> HavaYanit:
    """Şu an + 7 günlük saatlik tahmin, ilaçlama penceresi, don/sıcak uyarıları, su dengesi ve yağış toplamları."""
    return await service.get(garden_id)


@router.get("/gardens/{garden_id}/weather/history", response_model=GecmisYanit)
async def get_weather_history(
    garden_id: UUID,
    service: Service,
    from_: Annotated[date | None, Query(alias="from")] = None,
    to: date | None = None,
) -> GecmisYanit:
    """Günlük geçmiş (min/max sıcaklık, yağış, ET₀). Varsayılan: son 13 ay."""
    end = to or date.today() - timedelta(days=1)
    start = from_ or end - timedelta(days=395)
    return await service.history(garden_id, start, end)
