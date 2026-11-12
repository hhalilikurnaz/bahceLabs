"""Sulama sistemi kontrol işareti tabloları (ADR 0029)."""

import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from bahcelab_backend.database import Base


class SkNdmiModel(Base):
    __tablename__ = "sk_ndmi"
    garden_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("gardens.id", ondelete="CASCADE"), primary_key=True)
    sektor_ad: Mapped[str] = mapped_column(String(24), primary_key=True)
    tarih: Mapped[date] = mapped_column(Date, primary_key=True)
    geom_hash: Mapped[str] = mapped_column(String(32))
    ndmi: Mapped[float] = mapped_column(Float)
    gecerli_oran: Mapped[float] = mapped_column(Float)
    piksel: Mapped[int] = mapped_column(Integer)


class SkYanitModel(Base):
    __tablename__ = "sk_yanit"
    __table_args__ = (UniqueConstraint("garden_id", "sektor_ad", "sahne_tarihi", name="uq_sk_yanit"),)
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    garden_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("gardens.id", ondelete="CASCADE"))
    sektor_ad: Mapped[str] = mapped_column(String(24))
    sahne_tarihi: Mapped[date] = mapped_column(Date)
    yanit: Mapped[str] = mapped_column(String(24))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SkHalkaModel(Base):
    __tablename__ = "sk_halka"
    garden_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("gardens.id", ondelete="CASCADE"), primary_key=True)
    tarih: Mapped[date] = mapped_column(Date, primary_key=True)
    geom_hash: Mapped[str] = mapped_column(String(32))
    ndmi: Mapped[float | None] = mapped_column(Float)
    ndvi: Mapped[float | None] = mapped_column(Float)
    piksel: Mapped[int] = mapped_column(Integer)
    halka_piksel: Mapped[int] = mapped_column(Integer)
