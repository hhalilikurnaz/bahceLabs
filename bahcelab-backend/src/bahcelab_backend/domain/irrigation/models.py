"""Bahçe sulama profili (kurulum sihirbazı). Ağaç SAYISI burada değil: bahçenin mevcut beyanından (gardens.agac_sayisi) gelir; konum uydurulmaz."""

import uuid
from datetime import date, datetime
from typing import Any

from geoalchemy2 import Geometry
from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from bahcelab_backend.database import Base


class IrrigationProfileModel(Base):
    __tablename__ = "irrigation_profiles"
    __table_args__ = (
        CheckConstraint("sistem IN ('damla','mini_yagmurlama','salma')", name="ck_irr_sistem"),
        CheckConstraint("enerji IN ('sebeke','gunes','dizel')", name="ck_irr_enerji"),
    )

    garden_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("gardens.id", ondelete="CASCADE"), primary_key=True)
    sistem: Mapped[str] = mapped_column(String(16), nullable=False)
    damlatici_sayisi: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)  # ağaç başına (damla)
    damlatici_debi_lh: Mapped[float | None] = mapped_column(Float, nullable=True)  # L/sa
    sira_aralik_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    agac_aralik_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    pompa_kw: Mapped[float | None] = mapped_column(Float, nullable=True)  # None = bilmiyorum
    pompa_debi_m3h: Mapped[float | None] = mapped_column(Float, nullable=True)
    enerji: Mapped[str] = mapped_column(String(8), nullable=False, default="sebeke")
    kwh_fiyat_tl: Mapped[float | None] = mapped_column(Float, nullable=True)  # kullanıcının girdiği şebeke birim fiyatı
    enerji_m3_maliyet_tl: Mapped[float | None] = mapped_column(Float, nullable=True)  # dizel/güneş: kullanıcı girer
    su_ucreti_m3_tl: Mapped[float | None] = mapped_column(Float, nullable=True)  # sulama birliği, isteğe bağlı
    vardiya_baslangic: Mapped[str] = mapped_column(String(5), nullable=False, default="05:00")  # SS:DD
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class IrrigationSectorModel(Base):
    """Sulama sektörü (vana): kullanıcı haritada parseli böler. Hiç sektör yoksa bahçe TEK sektör olarak çalışır; sektör sayısı, alan ve debi uydurulmaz."""

    __tablename__ = "irrigation_sectors"
    __table_args__ = (UniqueConstraint("garden_id", "ad", name="uq_sektor_ad"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    garden_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("gardens.id", ondelete="CASCADE"), nullable=False, index=True)
    ad: Mapped[str] = mapped_column(String(24), nullable=False)  # «V1»
    sira: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    geom = mapped_column(Geometry(geometry_type="POLYGON", srid=4326, spatial_index=False), nullable=False)
    alan_m2: Mapped[float] = mapped_column(Float, nullable=False)  # elipsoit üzerinde, sunucuda hesaplanır
    agac_sayisi: Mapped[int | None] = mapped_column(Integer, nullable=True)  # None: bahçe beyanı alan payına göre dağıtılır («orantılı»)
    sira_aralik_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    agac_aralik_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    vana_debi_m3h: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class IrrigationApprovalModel(Base):
    """«Programı onayla»: kullanıcının onayladığı sulama programı (uygulama içi; sulama günü yaklaşınca bildirim). WhatsApp kanalı adım 18'de."""

    __tablename__ = "irrigation_approvals"

    garden_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("gardens.id", ondelete="CASCADE"), primary_key=True)
    tarih: Mapped[date] = mapped_column(Date, primary_key=True)  # sulama günü
    program: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)  # onay anındaki vardiya listesi
    onaylayan: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
