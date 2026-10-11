from datetime import date
from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status

from bahcelab_backend.api.deps import get_current_user, get_ndvi_service
from bahcelab_backend.domain.ndvi.indices import sample_index_definitions
from bahcelab_backend.domain.ndvi.schemas import (
    ArsivYanit,
    IndeksYanit,
    NdviIs,
    VerimlilikYanit,
)
from bahcelab_backend.domain.ndvi.service import NdviService

definitions_router = APIRouter(
    prefix="/indeks", tags=["indeks"], dependencies=[Depends(get_current_user)]
)

router = APIRouter(
    prefix="/gardens/{garden_id}",
    tags=["indeks"],
    dependencies=[Depends(get_current_user)],
)

Service = Annotated[NdviService, Depends(get_ndvi_service)]


@definitions_router.get("/tanimlar")
async def index_definitions() -> list[dict[str, Any]]:
    """İndekslerin adı, açıklaması, değer aralığı ve renk durakları."""
    return sample_index_definitions()


@router.get("/indeks", response_model=IndeksYanit)
async def get_indices(garden_id: UUID, service: Service) -> IndeksYanit:
    """Sahne zaman serisi (tüm indeksler), uyarılar ve işleme durumu. Son kontrolden 12 saat geçtiyse yeni sahne araması başlar."""
    return await service.overview(garden_id)


@router.get("/indeks/arsiv", response_model=ArsivYanit)
async def get_archive(
    garden_id: UUID,
    service: Service,
    parametre: Annotated[str, Query(description="ndvi, msavi, ndre, ndmi, cigreen veya gercek-renk")] = "ndvi",
    sezon: Annotated[int | None, Query(ge=2015, le=2100, description="Takvim yılı; verilmezse en son sezon")] = None,
    sayfa: Annotated[int, Query(ge=1)] = 1,
    boyut: Annotated[int | None, Query(ge=1)] = None,
) -> ArsivYanit:
    """Görüntü arşivi: seçili sezonun sahneleri (değer, bulut %, net / en net işareti, küçük resim adresi), sayfalı."""
    return await service.archive(garden_id, parametre, sezon, sayfa, boyut)


@router.post("/indeks/refresh", response_model=NdviIs, status_code=status.HTTP_202_ACCEPTED)
async def refresh_indices(garden_id: UUID, service: Service) -> NdviIs:
    """«Şimdi güncelle»: yeni ve eksik sahneleri arka planda işler."""
    return await service.refresh(garden_id)


@router.get(
    "/indeks/{indeks}/{tarih}.png",
    response_class=Response,
    responses={200: {"content": {"image/png": {}}}},
)
async def get_index_png(garden_id: UUID, indeks: str, tarih: date, service: Service) -> Response:
    """İndeks görüntüsü (mutlak skala, poligonla kırpılmış) veya `gercek-renk` görüntüsü."""
    data = await service.png(garden_id, indeks, tarih)
    return Response(
        content=data, media_type="image/png", headers={"Cache-Control": "private, max-age=86400"}
    )


@router.get(
    "/indeks/{indeks}/{tarih}/thumb.png",
    response_class=Response,
    responses={200: {"content": {"image/png": {}}}},
)
async def get_index_thumbnail(garden_id: UUID, indeks: str, tarih: date, service: Service) -> Response:
    """Küçük resim (liste ve arşiv ızgarası için, kırpılmış ve küçültülmüş)."""
    data = await service.thumbnail(garden_id, indeks, tarih)
    return Response(
        content=data, media_type="image/png", headers={"Cache-Control": "private, max-age=86400"}
    )


@router.get(
    "/indeks/{indeks}/{tarih}.bin",
    response_class=Response,
    responses={200: {"content": {"application/octet-stream": {}}}},
)
async def get_index_grid(garden_id: UUID, indeks: str, tarih: date, service: Service) -> Response:
    """Ham değerler: float32 little-endian, satır sırası (satır × sütun sahne gözleminde), geçersiz = NaN."""
    data = await service.grid(garden_id, indeks, tarih)
    return Response(
        content=data,
        media_type="application/octet-stream",
        headers={"Cache-Control": "private, max-age=86400"},
    )


@router.get("/indeks/{indeks}/{tarih}/zones")
async def get_index_zones(
    garden_id: UUID, indeks: str, tarih: date, service: Service
) -> dict[str, Any]:
    """Sorunlu bölgeler (GeoJSON FeatureCollection, EPSG:4326)."""
    return await service.zones(garden_id, indeks, tarih)


@router.get("/verimlilik-bolgeleri", response_model=VerimlilikYanit)
async def get_yield_zones(
    garden_id: UUID,
    service: Service,
    indeks: Annotated[Literal["ndvi", "msavi"], Query()] = "ndvi",
) -> VerimlilikYanit:
    """Geçmiş görüntülerin ortalamasından 3 verimlilik bölgesi (düşük, orta, yüksek)."""
    return await service.yield_zones(garden_id, indeks)
