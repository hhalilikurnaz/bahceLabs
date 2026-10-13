from datetime import date
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status

from bahcelab_backend.api.deps import get_current_user, get_data_foundation_service
from bahcelab_backend.domain.acquisitions.schemas import (
    Edinimler,
    GecmisDoldurmaDurumu,
    NormalBantlar,
    RadarDegisimler,
    RadarEdinimler,
    RadarNokta,
)
from bahcelab_backend.domain.acquisitions.service import DataFoundationService

router = APIRouter(tags=["veri-temeli"], dependencies=[Depends(get_current_user)])
Service = Annotated[DataFoundationService, Depends(get_data_foundation_service)]
Kaynak = Annotated[Literal["sentinel2", "radar"], Query(description="Veri kaynağı")]


@router.post("/gardens/{garden_id}/gecmis-doldurma", response_model=GecmisDoldurmaDurumu, status_code=status.HTTP_202_ACCEPTED)
async def start_backfill(garden_id: UUID, service: Service, kaynak: Kaynak = "sentinel2") -> GecmisDoldurmaDurumu:
    """2015'ten bugüne geçmiş doldurmayı başlatır / kaldığı yerden sürdürür (idempotent)."""
    return await service.start(garden_id, kaynak)


@router.get("/gardens/{garden_id}/gecmis-doldurma", response_model=GecmisDoldurmaDurumu)
async def get_backfill(garden_id: UUID, service: Service, ayrinti: Annotated[bool, Query(description="Ay ay döküm")] = False, kaynak: Kaynak = "sentinel2") -> GecmisDoldurmaDurumu:
    """İlerleme: tamamlanan ay / toplam, net sahne sayısı, depolama boyutu."""
    return await service.status(garden_id, detail=ayrinti, kaynak=kaynak)


@router.get("/gardens/{garden_id}/radar/degisimler", response_model=RadarDegisimler)
async def get_radar_changes(
    garden_id: UUID, service: Service, durum: Annotated[Literal["aday", "gurultu"] | None, Query()] = None, baslangic: Annotated[date | None, Query()] = None
) -> RadarDegisimler:
    """Radar değişim kayıtları (birincil yörünge): olay adayları ve gürültü; «ıslaklık olabilir» notu yağıştan gelir. Bildirim üretmez."""
    return await service.radar_changes(garden_id, durum=durum, since=baslangic)


@router.get("/gardens/{garden_id}/radar/edinimler", response_model=RadarEdinimler)
async def get_radar_acquisitions(garden_id: UUID, service: Service, baslangic: Annotated[date | None, Query()] = None) -> RadarEdinimler:
    """Radar geçişleri (tüm yörüngeler): tarih, yörünge, yön, VH/RVI ortalaması, maske payı."""
    return await service.radar_acquisitions(garden_id, since=baslangic)


@router.get("/gardens/{garden_id}/radar/edinimler/{tarih}/{indeks}/izgara")
async def get_radar_grid(garden_id: UUID, tarih: date, indeks: str, service: Service) -> Response:
    """Birincil yörüngenin gösterge ızgarası (Lee filtreli; float32 LE, NaN = geçersiz)."""
    return Response(content=await service.radar_grid_bytes(garden_id, tarih, indeks), media_type="application/octet-stream", headers={"Cache-Control": "private, max-age=3600"})


@router.get("/gardens/{garden_id}/radar/degisim/{tarih}/izgara")
async def get_radar_change_grid(garden_id: UUID, tarih: date, service: Service) -> Response:
    """Radar değişim ızgarası (dB): sahne − aynı yörüngedeki son 3 sahnenin ortancası."""
    return Response(content=await service.radar_change_grid_bytes(garden_id, tarih), media_type="application/octet-stream", headers={"Cache-Control": "private, max-age=3600"})


@router.get("/gardens/{garden_id}/radar/nokta", response_model=RadarNokta)
async def get_radar_point(garden_id: UUID, service: Service, satir: Annotated[int, Query(ge=0)], sutun: Annotated[int, Query(ge=0)], tarih: date) -> RadarNokta:
    """Seçili pikselin son 6 radar sahnesindeki VH dB değeri (mini seri)."""
    return await service.radar_point(garden_id, satir, sutun, tarih)


@router.get("/gardens/{garden_id}/normal-bantlar", response_model=NormalBantlar)
async def get_normal_bands(garden_id: UUID, service: Service) -> NormalBantlar:
    """Gösterge × ay normal bantları (p10/p25/ortanca/p75/p90). Yetersiz geçmişte yüzdelikler boştur."""
    return await service.normal_bands(garden_id)


@router.get("/gardens/{garden_id}/edinimler", response_model=Edinimler)
async def get_acquisitions(garden_id: UUID, service: Service) -> Edinimler:
    """Net edinimler: tarih, bulut %, gösterge istatistikleri; bahçenin ortak 10 m ızgara bilgisi."""
    return await service.acquisitions(garden_id)


@router.get("/gardens/{garden_id}/edinimler/{tarih}/{indeks}/izgara")
async def get_acquisition_grid(garden_id: UUID, tarih: date, indeks: str, service: Service) -> Response:
    """Bir edinimin gösterge ızgarası (float32 LE, satır sırasıyla; geçersiz = NaN). Harita katmanları bunu çizer."""
    return Response(content=await service.grid_bytes(garden_id, tarih, indeks), media_type="application/octet-stream", headers={"Cache-Control": "private, max-age=3600"})
