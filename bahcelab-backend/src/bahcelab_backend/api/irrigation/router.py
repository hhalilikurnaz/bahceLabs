from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from bahcelab_backend.api.deps import get_current_user, get_irrigation_service
from bahcelab_backend.domain.auth.schemas import AuthUser
from bahcelab_backend.domain.irrigation import schemas as sc
from bahcelab_backend.domain.irrigation.service import IrrigationService

router = APIRouter(tags=["sulama-plani"], dependencies=[Depends(get_current_user)])
Service = Annotated[IrrigationService, Depends(get_irrigation_service)]
User = Annotated[AuthUser, Depends(get_current_user)]


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


@router.get("/gardens/{garden_id}/sulama-sektorleri", response_model=sc.SektorlerYaniti, response_model_by_alias=True)
async def get_sektorler(garden_id: UUID, service: Service) -> sc.SektorlerYaniti:
    """Sulama sektörleri (vanalar). Çizilmemişse bahçe tek sektör."""
    return await service.sektor_listesi(garden_id)


@router.put("/gardens/{garden_id}/sulama-sektorleri", response_model=sc.SektorlerYaniti, response_model_by_alias=True)
async def put_sektorler(garden_id: UUID, body: sc.SektorlerGirdisi, service: Service) -> sc.SektorlerYaniti:
    return await service.sektorleri_kaydet(garden_id, body)


@router.get("/gardens/{garden_id}/sulama-panel", response_model=sc.PanelYaniti)
async def get_panel(garden_id: UUID, service: Service) -> sc.PanelYaniti:
    """Sulama paneli: Bugün sekmesi, KPI, vana durumları, vardiya çizelgesi, güven. Su kartı ve plan ile AYNI kovadan."""
    return await service.panel(garden_id)


@router.get("/gardens/{garden_id}/sulama-simulasyon", response_model=sc.SimulasyonYaniti)
async def get_simulasyon(
    garden_id: UUID, service: Service, yil: Annotated[int | None, Query(ge=2015, le=2100)] = None, mod: Annotated[str, Query(pattern="^(plan|aliskanlik)$")] = "plan",
    sistem: Annotated[str | None, Query(pattern="^(damla|mini_yagmurlama|salma)$")] = None, kisinti: bool = False, kwh_fiyat: Annotated[float | None, Query(ge=0, le=1000)] = None,
    gunler: Annotated[str | None, Query(description="Elle alışkanlık: hafta günleri 0=Pzt")] = None, saat: Annotated[float | None, Query(gt=0, le=24)] = None,
) -> sc.SimulasyonYaniti:
    days = [int(x) for x in gunler.split(",") if x.strip().isdigit() and 0 <= int(x) <= 6] if gunler else None
    return await service.simulasyon(garden_id, yil=yil, mod=mod, sistem=sistem, kisinti=kisinti, kwh_fiyat=kwh_fiyat, gunler=days, saat=saat)


@router.post("/gardens/{garden_id}/sulama-onay", response_model=sc.PanelYaniti)
async def post_onay(garden_id: UUID, body: sc.OnayGirdisi, service: Service, user: User) -> sc.PanelYaniti:
    """[Programı onayla]: uygulama içi onay; sulama günü yaklaşınca bildirim gelir (WhatsApp kanalı adım 18)."""
    return await service.onayla(garden_id, body.tarih, user.id)


@router.post("/gardens/{garden_id}/sulama-isle")
async def post_isle(garden_id: UUID, body: sc.IsleGirdisi, service: Service, user: User) -> dict[str, int]:
    """[Saha Defteri'ne işle]: gerçekleşen sulamayı vana başına bir kayıt olarak yazar."""
    return {"yazilan": await service.isle(garden_id, body.tarih, user.id)}
