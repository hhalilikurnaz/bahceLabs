from functools import lru_cache
from typing import Annotated

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.config import get_settings
from bahcelab_backend.database import get_db_session
from bahcelab_backend.domain.bekleme.schemas import BeklemeBasvurusu, BeklemeYaniti
from bahcelab_backend.domain.bekleme.service import basvuru_yaz
from bahcelab_backend.shared.errors import AppError, AppErrorCode
from bahcelab_backend.shared.rate_limit import SlidingWindowLimiter

router = APIRouter(prefix="/bekleme-listesi", tags=["bekleme-listesi"])


@lru_cache
def get_bekleme_limiter() -> SlidingWindowLimiter:
    s = get_settings()
    return SlidingWindowLimiter(limit=s.bekleme_limit_adet, window_s=s.bekleme_limit_sn)


def _istemci(request: Request) -> str:
    """Sınır anahtarı: istemci adresi. Ters vekil arkasında (BEKLEME_VEKIL_GUVEN=true) X-Forwarded-For'un SON değeri (vekilin eklediği)."""
    if get_settings().bekleme_vekil_guven:
        sonlar = request.headers.get("x-forwarded-for", "").split(",")
        if sonlar and sonlar[-1].strip():
            return sonlar[-1].strip()
    return request.client.host if request.client else "bilinmiyor"


@router.post("", response_model=BeklemeYaniti, status_code=status.HTTP_201_CREATED)
async def katil(
    basvuru: BeklemeBasvurusu,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> BeklemeYaniti:
    s = get_settings()
    if s.kvkk_taslak and not s.api_debug:
        # Aydınlatma metni hukuki onay beklerken canlıda kişisel veri toplanmaz (KVKK_TASLAK=false ile açılır)
        raise AppError(403, AppErrorCode.FORBIDDEN, "Erken erişim başvuruları şu an alınmıyor.")
    limiter = get_bekleme_limiter()
    anahtar = _istemci(request)
    if not limiter.allow(anahtar):
        raise AppError(
            429,
            AppErrorCode.RATE_LIMITED,
            "Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar deneyin.",
            {"retry_after_s": limiter.retry_after(anahtar)},
        )
    await basvuru_yaz(session, basvuru)  # yeni mi yinelenen mi: yanıt aynı (e-posta yoklaması yok)
    return BeklemeYaniti()
