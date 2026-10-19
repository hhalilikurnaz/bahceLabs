from datetime import timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.api.deps import get_current_user, get_db_session, get_workspace_id
from bahcelab_backend.domain.gardens.repository import GardenRepository
from bahcelab_backend.domain.series import service
from bahcelab_backend.domain.series.schemas import CanlilikEgrisi, EgriNoktasi, Gozlem, RadarIsareti
from bahcelab_backend.shared.clock import today_istanbul
from bahcelab_backend.shared.errors import AppError, AppErrorCode

router = APIRouter(tags=["canlilik-egrisi"], dependencies=[Depends(get_current_user)])


@router.get("/gardens/{garden_id}/canlilik-egrisi", response_model=CanlilikEgrisi)
async def get_curve(
    garden_id: UUID,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    workspace_id: Annotated[UUID, Depends(get_workspace_id)],
    gun: Annotated[int, Query(ge=30, le=4400)] = 730,
) -> CanlilikEgrisi:
    """Kesintisiz günlük canlılık (NDVI) eğrisi: gözlemler (Sentinel-2 + HLS), yumuşatılmış eğri, belirsizlik bandı ve boşluklarda radar değişim işareti."""
    if await GardenRepository(session, workspace_id).get(garden_id) is None:
        raise AppError(404, AppErrorCode.NOT_FOUND, "Bahçe bulunamadı.")
    end = today_istanbul()
    result = await service.curve_for(session, garden_id, end - timedelta(days=gun), end)
    rule = result["kural"]
    return CanlilikEgrisi(
        baslangic=end - timedelta(days=gun), bitis=end, noktalar=[EgriNoktasi(**p.__dict__) for p in result["noktalar"]],
        gozlemler=[Gozlem(tarih=o.tarih, deger=o.deger, kaynak=o.kaynak, agirlik=o.agirlik) for o in result["gozlemler"]],
        radar_isaretleri=[RadarIsareti(tarih=m.tarih, degisim=m.degisim) for m in result["radar_isaretleri"]], yeterli=bool(result["noktalar"]),
        kaynaklar="Sentinel-2 (10 m) + HLS (30 m, 2020'den)", yontem=f"Ağırlıklı Whittaker yumuşatma (λ = {rule.lambda_:g}); bant ≈ %90 sezgisel aralık · ön değer · mühendis onayı bekliyor",
        kademe_notu="Kademe bu eğriye değil yalnız gerçek gözleme dayanır; kesikli kısım tahmindir.",
    )
