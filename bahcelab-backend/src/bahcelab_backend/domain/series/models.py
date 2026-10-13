"""HLS gözlem özeti (ADR 0018)."""

from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Index, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from bahcelab_backend.database import Base


class HlsObservationModel(Base):
    __tablename__ = "hls_observations"
    __table_args__ = (Index("ix_hls_obs_garden_date", "garden_id", "tarih"),)

    garden_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("gardens.id", ondelete="CASCADE"), primary_key=True)
    scene_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    source_id: Mapped[str] = mapped_column(String(20), ForeignKey("data_sources.id"), nullable=False)
    tarih: Mapped[date] = mapped_column(Date, nullable=False)
    ndvi: Mapped[float | None] = mapped_column(Float, nullable=True)
    gecerli_oran: Mapped[float] = mapped_column(Float, nullable=False)
    gecerli_piksel: Mapped[int] = mapped_column(Integer, nullable=False)
    toplam_piksel: Mapped[int] = mapped_column(Integer, nullable=False)
    bulut_orani: Mapped[float | None] = mapped_column(Float, nullable=True)
    hesaplama: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
