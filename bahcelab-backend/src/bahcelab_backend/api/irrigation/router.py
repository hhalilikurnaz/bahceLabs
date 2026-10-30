from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from bahcelab_backend.api.deps import get_current_user, get_irrigation_service
from bahcelab_backend.domain.irrigation import schemas as sc
from bahcelab_backend.domain.irrigation.service import IrrigationService

router = APIRouter(tags=["sulama-plani"], dependencies=[Depends(get_current_user)])
Service = Annotated[IrrigationService, Depends(get_irrigation_service)]


@router.get("/gardens/{garden_id}/sulama-profili", response_model=sc.ProfilYaniti)
async def get_profile(garden_id: UUID, service: Service) -> sc.ProfilYaniti:
    """Bahçe sulama profili (sistem, damlatıcı, aralık, pompa, enerji) + tarife durumu + ağaç sayısı denetimi."""
    return await service.profile(garden_id)


@router.put("/gardens/{garden_id}/sulama-profili", response_model=sc.ProfilYaniti)
async def put_profile(garden_id: UUID, body: sc.ProfilGiris, service: Service) -> sc.ProfilYaniti:
    return await service.save_profile(garden_id, body)


@router.get("/gardens/{garden_id}/sulama-plani", response_model=sc.PlanYaniti, response_model_by_alias=True)
async def get_plan(garden_id: UUID, service: Service) -> sc.PlanYaniti:
    """FAO-56 günlük su dengesi: bu haftanın planı, kova, maliyet, sezon aralığı. Katsayılar ön değerdir."""
    return await service.plan(garden_id)


@router.get("/gardens/{garden_id}/sulama-sezon", response_model=sc.SezonYaniti)
async def get_season(garden_id: UUID, service: Service, yil: Annotated[int | None, Query(ge=2015, le=2100)] = None) -> sc.SezonYaniti:
    """Seçilen yılın sezonu, o yılın GERÇEK havasıyla (animasyon ve kuru/ıslak yıl için)."""
    return await service.season(garden_id, yil)


@router.get("/gardens/{garden_id}/sulama-senaryolar", response_model=sc.SenaryoYaniti, response_model_by_alias=True)
async def get_scenarios(
    garden_id: UUID, service: Service, yil: Annotated[int | None, Query(ge=2015, le=2100)] = None,
    gunler: Annotated[str | None, Query(description="Alışkanlık hafta günleri, 0=Pzt (ör. 0,3)")] = None, saat: Annotated[float | None, Query(gt=0, le=24)] = None,
    hedef: Annotated[str | None, Query(pattern="^(damla|mini_yagmurlama|salma)$")] = None, yatirim_tl: Annotated[float | None, Query(ge=0)] = None,
) -> sc.SenaryoYaniti:
    days = [int(x) for x in gunler.split(",") if x.strip().isdigit() and 0 <= int(x) <= 6] if gunler else []
    return await service.scenarios(garden_id, yil=yil, gunler=days, saat=saat, hedef=hedef, yatirim_tl=yatirim_tl)
