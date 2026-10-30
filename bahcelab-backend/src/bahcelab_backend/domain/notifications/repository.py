import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.domain.notifications.models import (
    GardenStatusSnapshotModel,
    NotificationModel,
    NotificationPreferenceModel,
    RiskSnapshotModel,
)
from bahcelab_backend.domain.notifications.types import SISTEM_TURU, Candidate


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
        cond = [NotificationModel.workspace_id == self.workspace_id, NotificationModel.teslim == "anlik"]  # özet maddeleri listede görünmez (özet kartında)
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

    async def unread_count(self, *, sistem: bool | None = None) -> int:
        """`sistem`: None = hepsi · True = yalnız veri akışı (sistem) · False = yalnız ürün (bahçe) bildirimleri."""
        cond = [NotificationModel.workspace_id == self.workspace_id, NotificationModel.teslim == "anlik", self._unread_cond()]
        if sistem is True:
            cond.append(NotificationModel.tur == SISTEM_TURU)
        elif sistem is False:
            cond.append(NotificationModel.tur != SISTEM_TURU)
        return int((await self.session.execute(select(func.count()).select_from(NotificationModel).where(*cond))).scalar_one())

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
        notification.otomatik_cozuldu = False  # kullanıcı kararı: koşul dönse de kendiliğinden yeniden açılmaz

    async def set_state(self, notification: NotificationModel, durum: str, days: int | None) -> None:
        self._apply(notification, durum, days, datetime.now(UTC))
        await self.session.flush()

    async def set_digest_detail(self, notification: NotificationModel, items: list[dict[str, str]]) -> None:
        notification.ayrinti = items
        await self.session.flush()

    async def mark_all_read(self, *, tur: str | None, garden_id: uuid.UUID | None) -> int:
        cond = self._filters(tur, garden_id, True)
        result = await self.session.execute(
            update(NotificationModel).where(*cond).values(durum="goruldu", okundu=True, okundu_zamani=datetime.now(UTC), ertelendi_bitis=None)
        )
        return int(result.rowcount or 0)  # type: ignore[attr-defined]

    async def insert_if_new(self, candidate: Candidate, teslim: str = "anlik") -> NotificationModel | None:
        """Aynı olay (dedupe_key) için yalnızca ilk çağrı kayıt üretir; tekrar çağrı None döner (idempotent)."""
        stmt = (
            insert(NotificationModel)
            .values(
                id=uuid.uuid4(), workspace_id=self.workspace_id, garden_id=candidate.garden_id, tur=candidate.tur, oncelik=candidate.oncelik,
                baslik=candidate.baslik, metin=candidate.metin, baglanti=candidate.link(), dedupe_key=candidate.dedupe_key, teslim=teslim,
            )
            .on_conflict_do_nothing(constraint="uq_notification_dedupe")
            .returning(NotificationModel.id)
        )
        new_id = (await self.session.execute(stmt)).scalar_one_or_none()
        if new_id is None:
            return None
        return await self.session.get(NotificationModel, new_id)

    async def update_risk(self, notification: NotificationModel, title: str, text: str, *, reopen: bool) -> None:
        notification.baslik, notification.metin = title, text
        if reopen:  # sistem çözmüştü, risk geri döndü: yeniden «oluştu»
            notification.durum, notification.okundu, notification.okundu_zamani = "olustu", False, None
            notification.cozuldu_zamani, notification.otomatik_cozuldu, notification.ertelendi_bitis = None, False, None
        await self.session.flush()

    async def resolve_auto(self, notification: NotificationModel) -> None:
        """Risk ortadan kalktı: aktif bildirim otomatik «çözüldü»."""
        notification.durum, notification.okundu = "cozuldu", True
        notification.okundu_zamani = notification.okundu_zamani or datetime.now(UTC)
        notification.cozuldu_zamani, notification.otomatik_cozuldu, notification.ertelendi_bitis = datetime.now(UTC), True, None
        await self.session.flush()

    async def pending_digest_items(self) -> list[NotificationModel]:
        """Özete girecek maddeler: teslim = özet ve henüz bir özete alınmamış (eskiden yeniye)."""
        rows = await self.session.execute(
            select(NotificationModel).where(NotificationModel.workspace_id == self.workspace_id, NotificationModel.teslim == "ozet", NotificationModel.ozet_id.is_(None)).order_by(NotificationModel.created_at, NotificationModel.id)
        )
        return list(rows.scalars())

    async def attach_digest(self, items: list[NotificationModel], digest_id: uuid.UUID) -> None:
        for row in items:
            row.ozet_id = digest_id
        await self.session.flush()

    async def escalate(self, notification: NotificationModel) -> None:
        """Özette bekleyen orta risk YÜKSEĞE çıktı: kritik olur, listede anında görünür (özet maddesi olmaktan çıkar)."""
        notification.oncelik, notification.teslim, notification.ozet_id = "kritik", "anlik", None
        notification.durum, notification.okundu, notification.okundu_zamani = "olustu", False, None
        await self.session.flush()

    async def close_with_note(self, notification: NotificationModel, note: str) -> None:
        """Doğrulanmayan («bekliyor») olay bildirimi: sistem notla kapatır (atmosfer); kullanıcı elle çözmüşse dokunulmaz."""
        if notification.durum == "cozuldu":
            return
        notification.metin = f"{notification.metin} {note}".strip()
        notification.baslik = notification.baslik.replace(" (doğrulama bekliyor)", "") + " — atmosfer"
        await self.resolve_auto(notification)

    async def by_key(self, dedupe_key: str) -> NotificationModel | None:
        return (
            await self.session.execute(select(NotificationModel).where(NotificationModel.workspace_id == self.workspace_id, NotificationModel.dedupe_key == dedupe_key))
        ).scalar_one_or_none()

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

    async def save(self, garden_id: uuid.UUID, active: list[dict[str, str]]) -> None:
        """`active`: [{ad, seviye}] — orta ve yüksek riskler (liste özeti kademeyi bununla hesaplar)."""
        now = datetime.now(UTC)
        high = sum(1 for r in active if r["seviye"] == "yuksek")
        stmt = (
            insert(RiskSnapshotModel)
            .values(garden_id=garden_id, yuksek_sayisi=high, aktif=active, hesaplama_zamani=now)
            .on_conflict_do_update(index_elements=["garden_id"], set_={"yuksek_sayisi": high, "aktif": active, "hesaplama_zamani": now})
        )
        await self.session.execute(stmt)

    async def active_risks(self, garden_ids: list[uuid.UUID]) -> dict[uuid.UUID, list[dict[str, str]]]:
        if not garden_ids:
            return {}
        rows = (await self.session.execute(select(RiskSnapshotModel).where(RiskSnapshotModel.garden_id.in_(garden_ids)))).scalars()
        return {r.garden_id: list(r.aktif or []) for r in rows}


class StatusSnapshotRepository:
    """Bahçe başına son Durum v2 kademesi (kademe düşüşü bildirimi için)."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, garden_id: uuid.UUID) -> str | None:
        return (await self.session.execute(select(GardenStatusSnapshotModel.kademe).where(GardenStatusSnapshotModel.garden_id == garden_id))).scalar_one_or_none()

    async def bulk(self, garden_ids: list[uuid.UUID]) -> dict[uuid.UUID, str]:
        if not garden_ids:
            return {}
        rows = await self.session.execute(select(GardenStatusSnapshotModel.garden_id, GardenStatusSnapshotModel.kademe).where(GardenStatusSnapshotModel.garden_id.in_(garden_ids)))
        return {r[0]: r[1] for r in rows.all()}

    async def save(self, garden_id: uuid.UUID, kademe: str) -> None:
        stmt = insert(GardenStatusSnapshotModel).values(garden_id=garden_id, kademe=kademe, hesaplama=datetime.now(UTC))
        await self.session.execute(stmt.on_conflict_do_update(index_elements=["garden_id"], set_={"kademe": kademe, "hesaplama": datetime.now(UTC)}))
