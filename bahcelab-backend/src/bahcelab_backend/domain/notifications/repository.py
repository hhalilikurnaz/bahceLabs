import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.domain.notifications.models import (
    NotificationModel,
    NotificationPreferenceModel,
    RiskSnapshotModel,
)
from bahcelab_backend.domain.notifications.types import Candidate


class NotificationRepository:
    def __init__(self, session: AsyncSession, workspace_id: uuid.UUID) -> None:
        self.session = session
        self.workspace_id = workspace_id

    @staticmethod
    def _unread_cond():  # type: ignore[no-untyped-def]
        """Okunmamış: yeni (olustu) ya da erteleme süresi dolmuş (yeniden görünür)."""
        now = datetime.now(UTC)
        return or_(NotificationModel.durum == "olustu", and_(NotificationModel.durum == "ertelendi", NotificationModel.ertelendi_bitis <= now))

    def _filters(self, tur: str | None, garden_id: uuid.UUID | None, unread_only: bool, durum: str = "aktif") -> list:
        cond = [NotificationModel.workspace_id == self.workspace_id]
        if tur:
            cond.append(NotificationModel.tur == tur)
        if garden_id:
            cond.append(NotificationModel.garden_id == garden_id)
        now = datetime.now(UTC)
        if durum == "aktif":  # oluştu + görüldü + süresi dolan ertelemeler
            cond.append(or_(NotificationModel.durum.in_(("olustu", "goruldu")), and_(NotificationModel.durum == "ertelendi", NotificationModel.ertelendi_bitis <= now)))
        elif durum == "ertelendi":
            cond.append(and_(NotificationModel.durum == "ertelendi", NotificationModel.ertelendi_bitis > now))
        elif durum == "cozuldu":
            cond.append(NotificationModel.durum == "cozuldu")
        if unread_only:
            cond.append(self._unread_cond())
        return cond

    async def page(
        self, *, tur: str | None, garden_id: uuid.UUID | None, unread_only: bool, page: int, size: int, durum: str = "aktif"
    ) -> tuple[list[NotificationModel], int]:
        cond = self._filters(tur, garden_id, unread_only, durum)
        total = (await self.session.execute(select(func.count()).select_from(NotificationModel).where(*cond))).scalar_one()
        rows = (
            await self.session.execute(
                select(NotificationModel).where(*cond).order_by(NotificationModel.created_at.desc(), NotificationModel.id).offset((page - 1) * size).limit(size)
            )
        ).scalars()
        return list(rows), int(total)

    async def unread_count(self) -> int:
        return int(
            (
                await self.session.execute(
                    select(func.count()).select_from(NotificationModel).where(NotificationModel.workspace_id == self.workspace_id, self._unread_cond())
                )
            ).scalar_one()
        )

    async def get(self, notification_id: uuid.UUID) -> NotificationModel | None:
        row = await self.session.get(NotificationModel, notification_id)
        return row if row is not None and row.workspace_id == self.workspace_id else None

    async def mark_read(self, notification: NotificationModel) -> None:
        """oluştu (ya da süresi dolmuş erteleme) → görüldü; çözülen/ertelenen bildirimin durumu bozulmaz."""
        now = datetime.now(UTC)
        expired = notification.durum == "ertelendi" and notification.ertelendi_bitis is not None and notification.ertelendi_bitis <= now
        if notification.durum == "olustu" or expired:
            self._apply(notification, "goruldu", None, now)
            await self.session.flush()

    @staticmethod
    def _apply(notification: NotificationModel, durum: str, days: int | None, now: datetime) -> None:
        notification.durum = durum
        notification.okundu = True
        notification.okundu_zamani = notification.okundu_zamani or now
        notification.ertelendi_bitis = now + timedelta(days=days) if durum == "ertelendi" and days else None
        notification.cozuldu_zamani = now if durum == "cozuldu" else None

    async def set_state(self, notification: NotificationModel, durum: str, days: int | None) -> None:
        self._apply(notification, durum, days, datetime.now(UTC))
        await self.session.flush()

    async def mark_all_read(self, *, tur: str | None, garden_id: uuid.UUID | None) -> int:
        cond = self._filters(tur, garden_id, True)
        result = await self.session.execute(
            update(NotificationModel).where(*cond).values(durum="goruldu", okundu=True, okundu_zamani=datetime.now(UTC), ertelendi_bitis=None)
        )
        return int(result.rowcount or 0)  # type: ignore[attr-defined]

    async def insert_if_new(self, candidate: Candidate) -> NotificationModel | None:
        """Aynı olay (dedupe_key) için yalnızca ilk çağrı kayıt üretir; tekrar çağrı None döner (idempotent)."""
        stmt = (
            insert(NotificationModel)
            .values(
                id=uuid.uuid4(), workspace_id=self.workspace_id, garden_id=candidate.garden_id, tur=candidate.tur, oncelik=candidate.oncelik,
                baslik=candidate.baslik, metin=candidate.metin, baglanti=candidate.link(), dedupe_key=candidate.dedupe_key,
            )
            .on_conflict_do_nothing(constraint="uq_notification_dedupe")
            .returning(NotificationModel.id)
        )
        new_id = (await self.session.execute(stmt)).scalar_one_or_none()
        if new_id is None:
            return None
        return await self.session.get(NotificationModel, new_id)

    # --- tercihler
    async def preferences(self) -> dict[str, bool]:
        rows = (await self.session.execute(select(NotificationPreferenceModel).where(NotificationPreferenceModel.workspace_id == self.workspace_id))).scalars()
        return {r.tur: r.acik for r in rows}

    async def set_preference(self, tur: str, enabled: bool) -> None:
        stmt = (
            insert(NotificationPreferenceModel)
            .values(workspace_id=self.workspace_id, tur=tur, acik=enabled)
            .on_conflict_do_update(index_elements=["workspace_id", "tur"], set_={"acik": enabled})
        )
        await self.session.execute(stmt)


class RiskSnapshotRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def save(self, garden_id: uuid.UUID, high_count: int) -> None:
        now = datetime.now(UTC)
        stmt = (
            insert(RiskSnapshotModel)
            .values(garden_id=garden_id, yuksek_sayisi=high_count, hesaplama_zamani=now)
            .on_conflict_do_update(index_elements=["garden_id"], set_={"yuksek_sayisi": high_count, "hesaplama_zamani": now})
        )
        await self.session.execute(stmt)

    async def high_counts(self, garden_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
        if not garden_ids:
            return {}
        rows = (await self.session.execute(select(RiskSnapshotModel).where(RiskSnapshotModel.garden_id.in_(garden_ids)))).scalars()
        return {r.garden_id: r.yuksek_sayisi for r in rows}
