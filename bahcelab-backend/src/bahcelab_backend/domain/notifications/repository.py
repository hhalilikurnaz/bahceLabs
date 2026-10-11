import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select, update
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

    def _filters(self, tur: str | None, garden_id: uuid.UUID | None, unread_only: bool) -> list:
        cond = [NotificationModel.workspace_id == self.workspace_id]
        if tur:
            cond.append(NotificationModel.tur == tur)
        if garden_id:
            cond.append(NotificationModel.garden_id == garden_id)
        if unread_only:
            cond.append(NotificationModel.okundu.is_(False))
        return cond

    async def page(
        self, *, tur: str | None, garden_id: uuid.UUID | None, unread_only: bool, page: int, size: int
    ) -> tuple[list[NotificationModel], int]:
        cond = self._filters(tur, garden_id, unread_only)
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
                    select(func.count()).select_from(NotificationModel).where(NotificationModel.workspace_id == self.workspace_id, NotificationModel.okundu.is_(False))
                )
            ).scalar_one()
        )

    async def get(self, notification_id: uuid.UUID) -> NotificationModel | None:
        row = await self.session.get(NotificationModel, notification_id)
        return row if row is not None and row.workspace_id == self.workspace_id else None

    async def mark_read(self, notification: NotificationModel) -> None:
        if not notification.okundu:
            notification.okundu = True
            notification.okundu_zamani = datetime.now(UTC)
            await self.session.flush()

    async def mark_all_read(self, *, tur: str | None, garden_id: uuid.UUID | None) -> int:
        cond = self._filters(tur, garden_id, True)
        result = await self.session.execute(update(NotificationModel).where(*cond).values(okundu=True, okundu_zamani=datetime.now(UTC)))
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
