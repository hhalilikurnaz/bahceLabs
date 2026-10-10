from typing import Annotated

from fastapi import APIRouter, Depends, Query

from bahcelab_backend.api.deps import get_current_user, get_overview_service
from bahcelab_backend.domain.overview.schemas import BahceOzetiYanit
from bahcelab_backend.domain.overview.service import GardenOverviewService

router = APIRouter(prefix="/gardens", tags=["gardens"], dependencies=[Depends(get_current_user)])


@router.get("/overview", response_model=BahceOzetiYanit)
async def gardens_overview(
    service: Annotated[GardenOverviewService, Depends(get_overview_service)],
    indeks: Annotated[str, Query(description="Sparkline ve küçük resim için parametre")] = "ndvi",
) -> BahceOzetiYanit:
    """Bahçe listesi özeti: durum, son görüntü + küçük resim, 30 günlük seri, uyarılar, bugünkü hava (önbellekten)."""
    return await service.overview(indeks)
