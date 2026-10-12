import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
    false,
    func,
    true,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from bahcelab_backend.database import Base


class NotificationModel(Base):
    """Uygulama içi bildirim. (workspace_id, dedupe_key) tekildir: aynı olay için tek bildirim (iş tekrarında çoğalmaz)."""

    __tablename__ = "notifications"
    __table_args__ = (UniqueConstraint("workspace_id", "dedupe_key", name="uq_notification_dedupe"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    garden_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("gardens.id", ondelete="CASCADE"), nullable=True, index=True)
    tur: Mapped[str] = mapped_column(String(30), nullable=False)
    oncelik: Mapped[str] = mapped_column(String(10), nullable=False)  # kritik | uyari | bilgi
    baslik: Mapped[str] = mapped_column(String(200), nullable=False)
    metin: Mapped[str] = mapped_column(Text, nullable=False)
    baglanti: Mapped[str] = mapped_column(String(200), nullable=False)
    okundu: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=false(), default=False)
    okundu_zamani: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Yaşam döngüsü: olustu → goruldu → cozuldu | ertelendi (süre dolunca yeniden «olustu» görünür). `okundu` = durum ≠ olustu.
    durum: Mapped[str] = mapped_column(String(12), nullable=False, server_default="olustu", default="olustu")
    ertelendi_bitis: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cozuldu_zamani: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    otomatik_cozuldu: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=false(), default=False)  # koşul ortadan kalktığı için sistem çözdü (koşul dönerse yeniden açılır)
    dedupe_key: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class NotificationPreferenceModel(Base):
    """Bildirim türü tercihi (çalışma alanı başına; çok kullanıcılı yapıda Adım 19'da kullanıcıya taşınır)."""

    __tablename__ = "notification_preferences"

    workspace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), primary_key=True)
    tur: Mapped[str] = mapped_column(String(30), primary_key=True)
    acik: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=true(), default=True)


class RiskSnapshotModel(Base):
    """Zamanlanmış işin son risk hesabı: liste özeti (ağsız/hızlı) skora zararlı riskini bununla katar."""

    __tablename__ = "garden_risk_snapshots"

    garden_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("gardens.id", ondelete="CASCADE"), primary_key=True)
    yuksek_sayisi: Mapped[int] = mapped_column(nullable=False, default=0)
    aktif: Mapped[list[dict[str, str]]] = mapped_column(JSONB, nullable=False, server_default="[]", default=list)  # [{ad, seviye}] orta ve yüksek riskler
    hesaplama_zamani: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
