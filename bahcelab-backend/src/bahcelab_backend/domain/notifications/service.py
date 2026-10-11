import math
import uuid

from bahcelab_backend.domain.notifications.channels import registry
from bahcelab_backend.domain.notifications.models import NotificationModel
from bahcelab_backend.domain.notifications.repository import NotificationRepository
from bahcelab_backend.domain.notifications.schemas import (
    BildirimListesi,
    BildirimYanit,
    TercihYanit,
    TopluOkundu,
)
from bahcelab_backend.domain.notifications.types import TYPES, Candidate
from bahcelab_backend.shared.errors import AppError, AppErrorCode


def to_response(row: NotificationModel) -> BildirimYanit:
    return BildirimYanit(
        id=row.id, bahce_id=row.garden_id, tur=row.tur, tur_adi=TYPES.get(row.tur, {}).get("ad", row.tur), oncelik=row.oncelik,  # type: ignore[arg-type]
        baslik=row.baslik, metin=row.metin, baglanti=row.baglanti, okundu=row.okundu, olusturma=row.created_at,
    )


class NotificationService:
    def __init__(self, repo: NotificationRepository) -> None:
        self.repo = repo

    async def list_page(self, *, tur: str | None, garden_id: uuid.UUID | None, unread_only: bool, page: int, size: int) -> BildirimListesi:
        if tur is not None and tur not in TYPES:
            raise AppError(422, AppErrorCode.VALIDATION_ERROR, "Bilinmeyen bildirim türü.")
        rows, total = await self.repo.page(tur=tur, garden_id=garden_id, unread_only=unread_only, page=page, size=size)
        return BildirimListesi(
            sayfa=page, boyut=size, toplam=total, sayfa_sayisi=max(1, math.ceil(total / size)),
            okunmamis_sayisi=await self.repo.unread_count(), ogeler=[to_response(r) for r in rows],
        )

    async def unread_count(self) -> int:
        return await self.repo.unread_count()

    async def mark_read(self, notification_id: uuid.UUID) -> BildirimYanit:
        row = await self.repo.get(notification_id)
        if row is None:
            raise AppError(404, AppErrorCode.NOT_FOUND, "Bildirim bulunamadı.")
        await self.repo.mark_read(row)
        return to_response(row)

    async def mark_all_read(self, *, tur: str | None, garden_id: uuid.UUID | None) -> TopluOkundu:
        updated = await self.repo.mark_all_read(tur=tur, garden_id=garden_id)
        return TopluOkundu(guncellenen=updated, okunmamis_sayisi=await self.repo.unread_count())

    async def preferences(self) -> list[TercihYanit]:
        saved = await self.repo.preferences()
        return [TercihYanit(tur=k, ad=v["ad"], aciklama=v["aciklama"], acik=saved.get(k, True)) for k, v in TYPES.items()]

    async def set_preference(self, tur: str, enabled: bool) -> list[TercihYanit]:
        if tur not in TYPES:
            raise AppError(404, AppErrorCode.NOT_FOUND, "Bilinmeyen bildirim türü.")
        await self.repo.set_preference(tur, enabled)
        return await self.preferences()

    async def publish(self, candidates: list[Candidate]) -> list[NotificationModel]:
        """Tercihi kapalı türler atlanır; aynı olay (dedupe) için yalnızca ilk çağrı kayıt üretir. Yeni kayıtlar ek kanallara iletilir."""
        prefs = await self.repo.preferences()
        created: list[NotificationModel] = []
        for candidate in candidates:
            if not prefs.get(candidate.tur, True):
                continue
            row = await self.repo.insert_if_new(candidate)
            if row is not None:
                created.append(row)
                await registry.deliver(self.repo.workspace_id, row)
        return created
