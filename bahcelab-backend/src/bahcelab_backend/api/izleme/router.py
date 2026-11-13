"""İç izleme uç noktaları (/ic/izleme/*): yalnız INTERNAL_EMAILS (aksi 403). Kullanıcı panellerinden AYRI."""

import uuid
from datetime import UTC, date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.api.deps import get_db_session, get_workspace_id
from bahcelab_backend.api.eta.router import ic_kullanici
from bahcelab_backend.domain.izleme import ic_schemas as sc
from bahcelab_backend.domain.izleme.ic_service import IzlemeIcService

router = APIRouter(prefix="/ic/izleme", tags=["ic-izleme"], dependencies=[Depends(ic_kullanici)])


async def get_service(session: Annotated[AsyncSession, Depends(get_db_session)], workspace_id: Annotated[uuid.UUID, Depends(get_workspace_id)]) -> IzlemeIcService:
    return IzlemeIcService(session, workspace_id)


Service = Annotated[IzlemeIcService, Depends(get_service)]


def _bugun() -> date:
    return datetime.now(UTC).date()


@router.get("/akislar", response_model=sc.AkislarYanit)
async def akislar(service: Service) -> sc.AkislarYanit:
    """Akış durum tablosu (canlı) + son 60 günün gecikme zaman çizelgesi (günlük anlık görüntüler)."""
    return await service.akislar(_bugun())


@router.get("/uyum", response_model=sc.UyumYanit)
async def uyum(service: Service) -> sc.UyumYanit:
    """Kaynak uyumu: kontrol başına haftalık sapma serileri ve drift durumu (son 26 hafta)."""
    return await service.uyum(_bugun())


@router.get("/kurallar", response_model=sc.KurallarYanit)
async def kurallar(service: Service) -> sc.KurallarYanit:
    """Kural performansı: üretilen / yanıtlanan / isabet (aylık + dönem özeti)."""
    return await service.kurallar(_bugun())


@router.get("/bahceler", response_model=sc.BahcelerYanit)
async def bahceler(service: Service) -> sc.BahcelerYanit:
    """Çalışma alanı bahçeleri: güven dağılımı ve en düşük güvenli bahçeler (nedenleriyle). Etiket kullanıcı ekranlarıyla AYNI servisten."""
    return await service.bahceler(_bugun())
