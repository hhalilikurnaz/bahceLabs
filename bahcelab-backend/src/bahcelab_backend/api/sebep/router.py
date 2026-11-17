"""ADIM 10B · olası sebep uç noktaları (kullanıcı API'si). Kapsam: bahçe sahibi çalışma alanı."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.api.deps import get_current_user, get_db_session, get_workspace_id
from bahcelab_backend.domain.auth.schemas import AuthUser
from bahcelab_backend.domain.gardens.repository import GardenRepository
from bahcelab_backend.domain.sebep import schemas as sc
from bahcelab_backend.domain.sebep import servis
from bahcelab_backend.shared.errors import AppError, AppErrorCode

router = APIRouter(tags=["sebep"])


async def _bahce_dogrula(session: AsyncSession, workspace_id: UUID, garden_id: UUID) -> None:
    if await GardenRepository(session, workspace_id).get(garden_id) is None:
        raise AppError(404, AppErrorCode.NOT_FOUND, "Bahçe bulunamadı.")


@router.get("/gardens/{garden_id}/olaylar/{olay_id}/sebep", response_model=sc.SebepCikti)
async def olay_sebep(
    garden_id: UUID,
    olay_id: UUID,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    workspace_id: Annotated[UUID, Depends(get_workspace_id)],
    _: Annotated[AuthUser, Depends(get_current_user)],
) -> dict:
    """«Olası sebepler (kesin değil)»: sıralı sebepler, lehte/aleyhte kanıt satırları (bağımsızlık etiketiyle), «sahada şunlara bakın» listesi, görüntü kapısı. Yüzde yok."""
    await _bahce_dogrula(session, workspace_id, garden_id)
    out = await servis.olay_sebep(session, garden_id, olay_id)
    if out is None:
        raise AppError(
            404,
            AppErrorCode.NOT_FOUND,
            "Bu olay için sebep ayrıştırma yok (olay bulunamadı ya da optik canlılık düşüşü içermiyor).",
        )
    return out


@router.post("/gardens/{garden_id}/olaylar/{olay_id}/sebep-yaniti", status_code=204)
async def sebep_yaniti(
    garden_id: UUID,
    olay_id: UUID,
    body: sc.SebepYaniti,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    workspace_id: Annotated[UUID, Depends(get_workspace_id)],
    user: Annotated[AuthUser, Depends(get_current_user)],
) -> None:
    """«Sebep buydu» yanıtı: Saha Defteri'ne gözlem kaydı + etiket tablosu + 9J kural performansı. Eğitimde kullanım için rıza alanı vardır (varsayılan yok)."""
    await _bahce_dogrula(session, workspace_id, garden_id)
    if not await servis.yanit_yaz(session, garden_id, olay_id, body.sebep, user.id):
        raise AppError(404, AppErrorCode.NOT_FOUND, "Olay bulunamadı.")
