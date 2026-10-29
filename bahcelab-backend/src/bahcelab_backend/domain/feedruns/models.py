"""Arka plan veri çekimi işlerinin DURUMU (ERA5, HLS, IMERG, SMAP): bahçe × kaynak başına tek satır.

Amaç: işçi/Docker yeniden başladığında işin kaldığı yerden devam edebilmesi ve düşen işin SESSİZ kalmaması (log + bildirim). Verinin kendisi
ilgili tablolarda durur (idempotent upsert / eksik gün); bu tablo yalnızca «son çalışma nasıl bitti» kaydıdır.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from bahcelab_backend.database import Base

KAYNAKLAR = ("era5", "hls", "imerg", "smap")
KAYNAK_ADI = {"era5": "ERA5 hava", "hls": "HLS canlılık", "imerg": "IMERG yağış", "smap": "SMAP toprak nemi", "imerg_gecmis": "IMERG geçmişi (2015→)"}


def _now() -> datetime:
    return datetime.now(UTC)


class FeedRunModel(Base):
    __tablename__ = "feed_runs"
    __table_args__ = (UniqueConstraint("garden_id", "kaynak", name="uq_feed_run"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    garden_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("gardens.id", ondelete="CASCADE"), nullable=False, index=True)
    kaynak: Mapped[str] = mapped_column(String(12), nullable=False)  # era5 | hls | imerg | smap | imerg_gecmis
    durum: Mapped[str] = mapped_column(String(10), nullable=False)  # calisiyor | tamam | hata | kesildi | atlandi
    deneme: Mapped[int] = mapped_column(Integer, nullable=False, default=0)  # art arda başarısız/kesilen çalışma sayısı (başarıda sıfırlanır)
    baslangic: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), default=_now, nullable=False)
    kalp_atisi: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), default=_now, nullable=False)
    bitis: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ilerleme: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)  # son sonuç / parça sayacı
    hata: Mapped[str | None] = mapped_column(Text, nullable=True)
