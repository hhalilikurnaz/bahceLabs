from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from bahcelab_backend.api.deps import get_agro_service, get_current_user
from bahcelab_backend.domain.agro.schemas import (
    BugunYanit,
    DurumV2Yanit,
    FenolojiDuzeltme,
    FenolojiYanit,
    KatalogYanit,
    RiskleriYanit,
    SerilerYanit,
    SulamaYanit,
)
from bahcelab_backend.domain.agro.service import AgroService

router = APIRouter(tags=["agro"], dependencies=[Depends(get_current_user)])
Service = Annotated[AgroService, Depends(get_agro_service)]


@router.get("/agro/katalog", response_model=KatalogYanit)
async def get_catalog(service: Service) -> KatalogYanit:
    """Ürün/çeşit kataloğu ve kural durumları (doğrulanmadı / mühendis onaylı)."""
    return service.catalog_response()


@router.get("/gardens/{garden_id}/agro/seriler", response_model=SerilerYanit)
async def get_series(
    garden_id: UUID, service: Service, sezon: Annotated[int | None, Query(ge=2000, le=2100, description="Sezon başlangıç yılı (1 Ekim)")] = None
) -> SerilerYanit:
    """Bu sezon ve geçen sezon: birikmiş yağış ve GDD (aynı gün karşılaştırması)."""
    return await service.series(garden_id, sezon)


@router.get("/gardens/{garden_id}/agro/fenoloji", response_model=FenolojiYanit)
async def get_phenology(
    garden_id: UUID, service: Service, sezon: Annotated[int | None, Query(ge=2000, le=2100)] = None
) -> FenolojiYanit:
    return await service.phenology(garden_id, sezon)


@router.put("/gardens/{garden_id}/agro/fenoloji/{evre}", response_model=FenolojiYanit)
async def set_phenology(garden_id: UUID, evre: str, body: FenolojiDuzeltme, service: Service) -> FenolojiYanit:
    """Bahçe düzeyinde evre tarihini düzeltir (katalog değerinin yerine geçer)."""
    return await service.set_phenology_override(garden_id, evre, body)


@router.delete("/gardens/{garden_id}/agro/fenoloji/{evre}", response_model=FenolojiYanit)
async def reset_phenology(garden_id: UUID, evre: str, service: Service) -> FenolojiYanit:
    return await service.reset_phenology_override(garden_id, evre)


@router.get("/gardens/{garden_id}/durum", response_model=DurumV2Yanit)
async def get_status(garden_id: UUID, service: Service) -> DurumV2Yanit:
    """Durum (v2, ADR 0018): kademe, 5 bileşen çipi, risk satırı ve «Nasıl hesaplandı?». Sayısal skor yanıtta YOKTUR."""
    return await service.status(garden_id)


@router.get("/gardens/{garden_id}/bugun", response_model=BugunYanit)
async def get_today(garden_id: UUID, service: Service) -> BugunYanit:
    """«Bugün»: öncelik sırasıyla en fazla 3 madde."""
    return await service.today(garden_id)


@router.get("/gardens/{garden_id}/sulama", response_model=SulamaYanit)
async def get_irrigation(garden_id: UUID, service: Service) -> SulamaYanit:
    """Sulama önerisi: ETc = ET₀ × Kc − etkili yağış; son 7 gün açığı ve önümüzdeki 7 gün ihtiyacı (mm ve ton/dekar). Yaklaşık öneri."""
    return await service.irrigation(garden_id)


@router.get("/gardens/{garden_id}/riskler", response_model=RiskleriYanit)
async def get_risks(garden_id: UUID, service: Service) -> RiskleriYanit:
    """Zararlı/hastalık risk tahminleri (meyve sineği, kırmızı örümcek, kuruma hastalığı); kural durumu ve gerekçeyle."""
    return await service.risks(garden_id)
