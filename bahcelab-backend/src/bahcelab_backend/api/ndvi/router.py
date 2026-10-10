from datetime import date
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Response, status

from bahcelab_backend.api.deps import get_current_user, get_ndvi_service
from bahcelab_backend.domain.ndvi.schemas import NdviIs, NdviYanit
from bahcelab_backend.domain.ndvi.service import NdviService

router = APIRouter(
    prefix="/gardens/{garden_id}/ndvi",
    tags=["ndvi"],
    dependencies=[Depends(get_current_user)],
)

Service = Annotated[NdviService, Depends(get_ndvi_service)]


@router.get("", response_model=NdviYanit)
async def get_ndvi(garden_id: UUID, service: Service) -> NdviYanit:
    """Zaman serisi, uyarılar ve işleme durumu. Son kontrolden 12 saat geçtiyse yeni sahne araması başlar."""
    return await service.overview(garden_id)


@router.post("/refresh", response_model=NdviIs, status_code=status.HTTP_202_ACCEPTED)
async def refresh_ndvi(garden_id: UUID, service: Service) -> NdviIs:
    """«Şimdi güncelle»: yeni sahneleri arka planda işler (örnek veri varsa gerçek veriyle değiştirir)."""
    return await service.refresh(garden_id)


@router.get(
    "/{tarih}.png", response_class=Response, responses={200: {"content": {"image/png": {}}}}
)
async def get_ndvi_png(garden_id: UUID, tarih: date, service: Service) -> Response:
    data = await service.png(garden_id, tarih)
    # Yetkili ve kullanıcıya özel; görüntü yeniden üretilince istemci ?v=surum ile yeniler
    return Response(
        content=data, media_type="image/png", headers={"Cache-Control": "private, max-age=86400"}
    )


@router.get("/{tarih}/zones")
async def get_ndvi_zones(garden_id: UUID, tarih: date, service: Service) -> dict[str, Any]:
    """Sorunlu bölgeler (GeoJSON FeatureCollection, EPSG:4326)."""
    return await service.zones(garden_id, tarih)
