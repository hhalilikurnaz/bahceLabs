"""Gece don riski ve topografya uç noktaları (kullanıcı API'si). Kapsam: bahçe sahibi çalışma alanı."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.api.deps import get_current_user, get_db_session, get_workspace_id
from bahcelab_backend.domain.auth.schemas import AuthUser
from bahcelab_backend.domain.don import schemas as sc
from bahcelab_backend.domain.don import servis
from bahcelab_backend.domain.gardens.repository import GardenRepository
from bahcelab_backend.shared.errors import AppError, AppErrorCode

router = APIRouter(tags=["don"])


async def _bahce_dogrula(session: AsyncSession, workspace_id: UUID, garden_id: UUID) -> None:
    if await GardenRepository(session, workspace_id).get(garden_id) is None:
        raise AppError(404, AppErrorCode.NOT_FOUND, "Bahçe bulunamadı.")


@router.get("/gardens/{garden_id}/don", response_model=sc.DonYaniti)
async def don_riski(garden_id: UUID, session: Annotated[AsyncSession, Depends(get_db_session)], workspace_id: Annotated[UUID, Depends(get_workspace_id)], _: Annotated[AuthUser, Depends(get_current_user)]) -> dict:
    """Önümüzdeki 3 gece için don olasılığı (sözcükle) + bahçe topografya profili + «nasıl hesaplandı». Uyarılar bilerek temkinlidir."""
    await _bahce_dogrula(session, workspace_id, garden_id)
    return await servis.oku(session, garden_id)


@router.get("/gardens/{garden_id}/don/goreli-soguk", response_model=sc.GoreliHucreler)
async def goreli_soguk(garden_id: UUID, session: Annotated[AsyncSession, Depends(get_db_session)], workspace_id: Annotated[UUID, Depends(get_workspace_id)], _: Annotated[AuthUser, Depends(get_current_user)]) -> dict:
    """Bahçe içi göreli soğuk hücreler (30 m; sıralama, °C değil). Yalnız bahçe içi rölyef ≥ 10 m ve eğim ≥ 3° ise üretilir; değilse neden döner."""
    await _bahce_dogrula(session, workspace_id, garden_id)
    return await servis.goreli_hucreler(session, garden_id)


@router.post("/gardens/{garden_id}/don/geri-bildirim", status_code=204)
async def don_geri_bildirim(garden_id: UUID, body: sc.DonGeriBildirim, session: Annotated[AsyncSession, Depends(get_db_session)], workspace_id: Annotated[UUID, Depends(get_workspace_id)], user: Annotated[AuthUser, Depends(get_current_user)]) -> None:
    """«Don oldu mu?» yanıtı (oldu / olmadı / bilmiyorum): 9J kural performansına girer; bahçe bazında yanlış alarm oranı bu veriyle ayarlanır."""
    await _bahce_dogrula(session, workspace_id, garden_id)
    risk = (await session.execute(text("SELECT 1 FROM don_risk WHERE garden_id = :g AND gece = :n"), {"g": garden_id, "n": body.gece})).first()
    if risk is None:
        raise AppError(422, AppErrorCode.VALIDATION_ERROR, "Bu gece için üretilmiş bir don değerlendirmesi yok.")
    await servis.geri_bildirim_yaz(session, garden_id, body.gece, body.yanit, user.id)
