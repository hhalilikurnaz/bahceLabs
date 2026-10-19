"""Saha Defteri (ADR 0019): çiftçinin sahadaki kayıtları ve uydu bulgularının doğrulanması.

· `field_records`: konumlu (nokta/alan) saha kaydı — gözlem, ilaçlama, gübreleme, sulama, hasat, tuzak.
· `field_photos`: kayda ya da doğrulamaya bağlı fotoğraf (yeniden kodlanmış, EXIF'siz).
· `event_verifications`: «Uydu haklı mıydı?» yanıtı. Olay motoru olayları yeniden kurar (kimlik değişebilir); doğrulama bu yüzden olay ANAHTARIYLA
  ((bahçe, hedef_tur, hedef_anahtar)) bağlanır ve olayın o andaki özetini taşır — olay silinse de çiftçinin yargısı ve doğruluk özeti kaybolmaz.
· `tour_visits`: saha turunda «ziyaret edildi» işareti (nokta anahtarıyla).
"""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime
from typing import Any

from geoalchemy2 import Geometry
from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from bahcelab_backend.database import Base


def _now() -> datetime:
    return datetime.now(UTC)


class FieldRecordModel(Base):
    __tablename__ = "field_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    garden_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("gardens.id", ondelete="CASCADE"), nullable=False, index=True)
    tur: Mapped[str] = mapped_column(String(12), nullable=False)  # gozlem | ilaclama | gubreleme | sulama | hasat | tuzak
    tarih: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    konum_tur: Mapped[str | None] = mapped_column(String(6), nullable=True)  # nokta | alan | null (konumsuz)
    konum = mapped_column(Geometry(geometry_type="GEOMETRY", srid=4326, spatial_index=False), nullable=True)
    aciklama: Mapped[str | None] = mapped_column(Text, nullable=True)
    ayrinti: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)  # türe özgü isteğe bağlı alanlar (ürün adı, miktar, sayım …)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), default=_now, onupdate=_now, nullable=False)


class EventVerificationModel(Base):
    __tablename__ = "event_verifications"
    __table_args__ = (UniqueConstraint("garden_id", "hedef_tur", "hedef_anahtar", name="uq_verification_target"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    garden_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("gardens.id", ondelete="CASCADE"), nullable=False, index=True)
    hedef_tur: Mapped[str] = mapped_column(String(6), nullable=False)  # olay | uyari
    hedef_anahtar: Mapped[str] = mapped_column(String(200), nullable=False)  # olay: events.anahtar · uyarı: bildirim dedupe_key
    baslik: Mapped[str] = mapped_column(String(200), nullable=False)  # doğrulama anındaki özet (olay silinse de okunur)
    tur_grubu: Mapped[str] = mapped_column(String(12), nullable=False)  # don | yagis | ruzgar | optik | radar | uyari
    turler: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    baslangic: Mapped[date] = mapped_column(Date, nullable=False)
    bitis: Mapped[date] = mapped_column(Date, nullable=False)
    guven: Mapped[str | None] = mapped_column(String(10), nullable=True)
    durum_anlik: Mapped[str] = mapped_column(String(10), nullable=False)  # olay | bekliyor | suphe | uyari (doğrulama anında)
    sonuc: Mapped[str] = mapped_column(String(16), nullable=False)  # gerceklesti | gerceklesmedi | bilinmiyor
    aciklama: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), default=_now, onupdate=_now, nullable=False)


class FieldPhotoModel(Base):
    __tablename__ = "field_photos"
    __table_args__ = (CheckConstraint("(record_id IS NOT NULL) <> (verification_id IS NOT NULL)", name="ck_photo_one_owner"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    garden_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("gardens.id", ondelete="CASCADE"), nullable=False, index=True)
    record_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("field_records.id", ondelete="CASCADE"), nullable=True, index=True)
    verification_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("event_verifications.id", ondelete="CASCADE"), nullable=True, index=True)
    dosya_yolu: Mapped[str] = mapped_column(String(200), nullable=False)
    icerik_turu: Mapped[str] = mapped_column(String(20), nullable=False)
    boyut_bayt: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), default=_now, nullable=False)


class TourVisitModel(Base):
    __tablename__ = "tour_visits"
    __table_args__ = (UniqueConstraint("garden_id", "nokta_anahtar", name="uq_tour_visit"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    garden_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("gardens.id", ondelete="CASCADE"), nullable=False, index=True)
    nokta_anahtar: Mapped[str] = mapped_column(String(160), nullable=False)
    ziyaret_zamani: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), default=_now, nullable=False)
    record_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("field_records.id", ondelete="SET NULL"), nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
