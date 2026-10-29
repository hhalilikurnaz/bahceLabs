import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, File, Query, Response, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.api.deps import get_current_user, get_db_session
from bahcelab_backend.domain.auth.schemas import AuthUser
from bahcelab_backend.domain.fieldbook.schemas import (
    DogrulamaGirdisi,
    DogrulamaKarti,
    DogrulamaListesi,
    DogrulukOzeti,
    FotoOnerisi,
    FotoYanit,
    KayitGirdisi,
    KayitGuncelle,
    KayitListesi,
    KayitTuru,
    KayitYanit,
    SahaTuru,
    ZiyaretGirdisi,
)
from bahcelab_backend.domain.fieldbook.service import FieldbookService
from bahcelab_backend.domain.gardens.repository import GardenRepository
from bahcelab_backend.shared.errors import AppError, AppErrorCode
from bahcelab_backend.shared.storage import get_storage

router = APIRouter(tags=["saha-defteri"])
MAX_UPLOAD = 8_000_000  # okunacak en çok bayt (asıl sınır servis içinde: ayarlardaki field_photo_max_bytes)


async def get_service(garden_id: uuid.UUID, session: Annotated[AsyncSession, Depends(get_db_session)], user: Annotated[AuthUser, Depends(get_current_user)]) -> FieldbookService:
    """Bahçe çalışma alanına aitse servis; değilse 404 (başkasının bahçesi varlığını sızdırmaz)."""
    if await GardenRepository(session, user.workspace_id).get(garden_id) is None:
        raise AppError(404, AppErrorCode.NOT_FOUND, "Bahçe bulunamadı.")
    return FieldbookService(session, get_storage(), user.id)


Svc = Annotated[FieldbookService, Depends(get_service)]


async def read_upload(file: UploadFile) -> bytes:
    data = await file.read(MAX_UPLOAD + 1)
    if len(data) > MAX_UPLOAD:
        raise AppError(422, AppErrorCode.VALIDATION_ERROR, "Fotoğraf çok büyük.")
    return data


# ----------------------------------------------------------------------------- kayıtlar
@router.get("/gardens/{garden_id}/saha-kayitlari", response_model=KayitListesi)
async def list_records(garden_id: uuid.UUID, svc: Svc, tur: KayitTuru | None = None, baslangic: Annotated[date | None, Query()] = None, bitis: Annotated[date | None, Query()] = None) -> KayitListesi:
    return KayitListesi(kayitlar=await svc.list_records(garden_id, tur=tur, since=baslangic, until=bitis))


@router.post("/gardens/{garden_id}/saha-kayitlari", response_model=KayitYanit, status_code=status.HTTP_201_CREATED)
async def create_record(garden_id: uuid.UUID, body: KayitGirdisi, svc: Svc) -> KayitYanit:
    return await svc.create_record(garden_id, body)


@router.patch("/gardens/{garden_id}/saha-kayitlari/{record_id}", response_model=KayitYanit)
async def update_record(garden_id: uuid.UUID, record_id: uuid.UUID, body: KayitGuncelle, svc: Svc) -> KayitYanit:
    return await svc.update_record(garden_id, record_id, body)


@router.delete("/gardens/{garden_id}/saha-kayitlari/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_record(garden_id: uuid.UUID, record_id: uuid.UUID, svc: Svc) -> None:
    await svc.delete_record(garden_id, record_id)


@router.post("/gardens/{garden_id}/saha-kayitlari/{record_id}/foto", response_model=FotoYanit, status_code=status.HTTP_201_CREATED)
async def add_record_photo(garden_id: uuid.UUID, record_id: uuid.UUID, svc: Svc, file: Annotated[UploadFile, File()]) -> FotoYanit:
    if not await svc.owns_record(garden_id, record_id):
        raise AppError(404, AppErrorCode.NOT_FOUND, "Kayıt bulunamadı.")
    return await svc.add_photo(garden_id, await read_upload(file), record_id=record_id)


@router.post("/gardens/{garden_id}/saha-fotograf-oneri", response_model=FotoOnerisi)
async def photo_suggestion(garden_id: uuid.UUID, svc: Svc, file: Annotated[UploadFile, File()]) -> FotoOnerisi:
    """Fotoğrafın EXIF tarih/konumundan kayıt için ÖNERİ (dosya saklanmaz; kullanıcı onaylar). Saklanan dosyada EXIF yine silinir."""
    return await svc.photo_suggestion(garden_id, await read_upload(file))


@router.get("/gardens/{garden_id}/saha-fotograflari/{photo_id}")
async def get_photo(garden_id: uuid.UUID, photo_id: uuid.UUID, svc: Svc) -> Response:
    return Response(await svc.photo_bytes(garden_id, photo_id), media_type="image/jpeg", headers={"Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff"})


@router.delete("/gardens/{garden_id}/saha-fotograflari/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_photo(garden_id: uuid.UUID, photo_id: uuid.UUID, svc: Svc) -> None:
    await svc.delete_photo(garden_id, photo_id)


# ----------------------------------------------------------------------------- «Uydu haklı mıydı?»
@router.get("/gardens/{garden_id}/dogrulama", response_model=DogrulamaListesi)
async def list_cards(garden_id: uuid.UUID, svc: Svc) -> DogrulamaListesi:
    """Her olay, uyarı ve «doğrulama bekliyor» kaydı için kart (yanıtsızlar önce)."""
    return await svc.card_list(garden_id)


@router.put("/gardens/{garden_id}/dogrulama", response_model=DogrulamaKarti)
async def verify(garden_id: uuid.UUID, body: DogrulamaGirdisi, svc: Svc) -> DogrulamaKarti:
    """gerçekleşti / gerçekleşmedi / bilinmiyor + not. Sonuç olay anahtarıyla saklanır (olay yeniden kurulsa da kalır)."""
    return await svc.verify(garden_id, body)


@router.post("/gardens/{garden_id}/dogrulama/{verification_id}/foto", response_model=FotoYanit, status_code=status.HTTP_201_CREATED)
async def add_verification_photo(garden_id: uuid.UUID, verification_id: uuid.UUID, svc: Svc, file: Annotated[UploadFile, File()]) -> FotoYanit:
    if not await svc.verification_id(garden_id, verification_id):
        raise AppError(404, AppErrorCode.NOT_FOUND, "Doğrulama bulunamadı.")
    return await svc.add_photo(garden_id, await read_upload(file), verification_id=verification_id)


@router.delete("/gardens/{garden_id}/dogrulama/{verification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_verification(garden_id: uuid.UUID, verification_id: uuid.UUID, svc: Svc) -> None:
    await svc.delete_verification(garden_id, verification_id)


@router.get("/gardens/{garden_id}/dogruluk-ozeti", response_model=DogrulukOzeti)
async def accuracy(garden_id: uuid.UUID, svc: Svc) -> DogrulukOzeti:
    """Tür başına doğrulanan / yanlış alarm sayıları; yeterli doğrulama yoksa «henüz yeterli doğrulama yok»."""
    return await svc.accuracy_summary(garden_id)


# ----------------------------------------------------------------------------- saha turu
@router.get("/gardens/{garden_id}/saha-turu", response_model=SahaTuru)
async def tour(garden_id: uuid.UUID, svc: Svc, lng: Annotated[float | None, Query(ge=-180, le=180)] = None, lat: Annotated[float | None, Query(ge=-90, le=90)] = None) -> SahaTuru:
    """Açık uyarılardan (zayıf kesim, stres yaması, doğrulama bekleyen olay) otomatik nokta listesi; en yakın komşu sırası."""
    return await svc.tour(garden_id, (lng, lat) if lng is not None and lat is not None else None)


@router.put("/gardens/{garden_id}/saha-turu/ziyaret", status_code=status.HTTP_204_NO_CONTENT)
async def visit(garden_id: uuid.UUID, body: ZiyaretGirdisi, svc: Svc) -> None:
    await svc.set_visit(garden_id, body.nokta_anahtar, visited=body.ziyaret_edildi, record_id=body.kayit_id)
