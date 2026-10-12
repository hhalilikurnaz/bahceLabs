from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status

from bahcelab_backend.api.deps import get_current_user, get_multiyear_service
from bahcelab_backend.domain.multiyear.schemas import (
    BaslatIstegi,
    CokYillikDurum,
    CokYillikSonuc,
    YilDegerleri,
    YillarGuncelle,
)
from bahcelab_backend.domain.multiyear.service import MultiyearService

router = APIRouter(tags=["cok-yillik-bolgeler"], dependencies=[Depends(get_current_user)])
Service = Annotated[MultiyearService, Depends(get_multiyear_service)]
BASE = "/gardens/{garden_id}/bolgeler/cok-yillik"


@router.post(BASE, response_model=CokYillikDurum, status_code=status.HTTP_202_ACCEPTED)
async def start_multiyear(garden_id: UUID, service: Service, body: BaslatIstegi | None = None) -> CokYillikDurum:  # noqa: ARG001
    """Çok yıllık analizi başlatır / kaldığı yerden sürdürür (idempotent): arşiv başlangıcından bugüne bahçe × yıl görevleri."""
    return await service.start(garden_id)


@router.get(f"{BASE}/durum", response_model=CokYillikDurum)
async def get_progress(garden_id: UUID, service: Service) -> CokYillikDurum:
    """İlerleme tablosu: yıl, durum, net sahne sayısı, hata."""
    return await service.status(garden_id)


@router.get(f"{BASE}/sonuc", response_model=CokYillikSonuc)
async def get_result(
    garden_id: UUID, service: Service, bolge_sayisi: Annotated[int, Query(description="Bölge sayısı: 3 ya da 5")] = 3
) -> CokYillikSonuc:
    """Ağaç gücü bölgeleri, istikrar haritası, yıl listesi ve korelasyonlar (sürümlü; PostGIS çokgenleri)."""
    return await service.result(garden_id, bolge_sayisi)


@router.patch(f"{BASE}/yillar", response_model=CokYillikSonuc)
async def patch_years(garden_id: UUID, body: YillarGuncelle, service: Service) -> CokYillikSonuc:
    """Yılı dahil/hariç eder (null = otomatik); bölgeler yeniden hesaplanır ve yeni sürüm olarak saklanır."""
    return await service.update_years(garden_id, body)


@router.get(f"{BASE}/yillar/{{yil}}/gorsel")
async def get_year_image(garden_id: UUID, yil: int, service: Service) -> Response:
    """O yılın kompoziti: yıl içi bağıl ağaç gücü (aynı palet), bahçe sınırına kırpılmış PNG."""
    png = await service.year_png(garden_id, yil)
    return Response(content=png, media_type="image/png", headers={"Cache-Control": "private, max-age=300"})


@router.get(f"{BASE}/yillar/{{yil}}/degerler", response_model=YilDegerleri)
async def get_year_values(garden_id: UUID, yil: int, service: Service) -> YilDegerleri:
    """O yılın kompozit ızgara değerleri (bahçe dışı null): küçük çoklu haritalar ve yıl dağılımları için."""
    return await service.year_values(garden_id, yil)
