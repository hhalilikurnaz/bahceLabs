"""Olay kayıtları (ADR 0018). `event_sources` kaynak kayıtlarına kimlikle referans verir; değerlerini kopyalamaz."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from bahcelab_backend.database import Base


class EventModel(Base):
    __tablename__ = "events"
    __table_args__ = (UniqueConstraint("garden_id", "anahtar", name="uq_event_key"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    garden_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("gardens.id", ondelete="CASCADE"), nullable=False, index=True)
    anahtar: Mapped[str] = mapped_column(String(80), nullable=False)
    tur: Mapped[str] = mapped_column(String(20), nullable=False)
    turler: Mapped[list[str]] = mapped_column(JSONB, nullable=False)
    baslangic: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    bitis: Mapped[date] = mapped_column(Date, nullable=False)
    alan_da: Mapped[float | None] = mapped_column(Float, nullable=True)
    guven: Mapped[str] = mapped_column(String(10), nullable=False)
    siddet: Mapped[str | None] = mapped_column(String(10), nullable=True)
    katman: Mapped[str | None] = mapped_column(String(20), nullable=True)
    tahmin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    durum: Mapped[str] = mapped_column(String(10), nullable=False, default="olay", server_default="olay")  # olay | suphe (atmosfer şüphesi: olay değildir)
    ayrinti: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    formul_surumu: Mapped[str] = mapped_column(String(40), nullable=False)
    hesaplama: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class EventSourceModel(Base):
    __tablename__ = "event_sources"
    __table_args__ = (UniqueConstraint("event_id", "kaynak_tablosu", "kaynak_kimligi", "rol", name="uq_event_source"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    kaynak_tablosu: Mapped[str] = mapped_column(String(30), nullable=False)
    kaynak_kimligi: Mapped[str] = mapped_column(String(80), nullable=False)
    rol: Mapped[str] = mapped_column(String(20), nullable=False)
    tarih: Mapped[date] = mapped_column(Date, nullable=False)
