"""İç kalite uç noktaları (/ic/eta/*): yalnız INTERNAL_EMAILS'teki kullanıcılar (aksi 403). Kullanıcı paneli uç noktalarından AYRI; kapı mantığı orada kullanılmaz."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.api.deps import get_current_user, get_db_session, get_workspace_id
from bahcelab_backend.config import get_settings
from bahcelab_backend.domain.auth.schemas import AuthUser
from bahcelab_backend.domain.eta import schemas as sc
from bahcelab_backend.domain.eta.ic_service import EtaIcService
from bahcelab_backend.shared.errors import AppError, AppErrorCode


async def ic_kullanici(user: Annotated[AuthUser, Depends(get_current_user)]) -> AuthUser:
    izinli = [e.strip().lower() for e in get_settings().internal_emails.split(",") if e.strip()]
    eposta = user.email.lower()
    # «*@alan.adi» deseni o alan adındaki herkesi içerir (yalnız test/e2e için; üretimde tam adresler yazılır)
    if not any(eposta == e or (e.startswith("*@") and eposta.endswith(e[1:])) for e in izinli):
        raise AppError(403, AppErrorCode.FORBIDDEN, "Bu ekran yalnız iç ekip içindir.")
    return user


router = APIRouter(prefix="/ic/eta", tags=["ic-eta"], dependencies=[Depends(ic_kullanici)])


async def get_ic_service(session: Annotated[AsyncSession, Depends(get_db_session)], workspace_id: Annotated[uuid.UUID, Depends(get_workspace_id)]) -> EtaIcService:
    return EtaIcService(session, workspace_id)


Service = Annotated[EtaIcService, Depends(get_ic_service)]


@router.get("/bahceler", response_model=list[sc.EtaDurumOzeti])
async def bahceler(service: Service) -> list[sc.EtaDurumOzeti]:
    """ETa hattı koşmuş bahçeler: kapı durumu ve tutarlılık özeti."""
    return await service.bahceler()


@router.get("/bahceler/{garden_id}", response_model=sc.EtaKaliteDetay)
async def detay(garden_id: uuid.UUID, service: Service) -> sc.EtaKaliteDetay:
    """Geçiş listesi, ETf/ETa, piksel payı, kalibrasyon, WaPOR L1 bağlamı, ECOSTRESS doğrulaması, tutarlılık."""
    return await service.detay(garden_id)
