"""İstasyon gözlemi tabloları. `station_daily` YALNIZ gerçek gözlem satırlarını tutar (model/dolgu satırı yazılmaz)."""

from __future__ import annotations

from datetime import UTC, date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from bahcelab_backend.database import Base


class StationModel(Base):
    __tablename__ = "stations"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    saglayici: Mapped[str] = mapped_column(String(16), nullable=False)
    ad: Mapped[str] = mapped_column(String(120), nullable=False)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    yukseklik: Mapped[float | None] = mapped_column(Float, nullable=True)
    gozlem_baslangic: Mapped[date | None] = mapped_column(Date, nullable=True)
    gozlem_bitis: Mapped[date | None] = mapped_column(Date, nullable=True)
    guncellendi: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), default=lambda: datetime.now(UTC), nullable=False)


class StationDailyModel(Base):
    __tablename__ = "station_daily"

    istasyon_id: Mapped[str] = mapped_column(String(32), ForeignKey("stations.id", ondelete="CASCADE"), primary_key=True)
    tarih: Mapped[date] = mapped_column(Date, primary_key=True)
    tmin: Mapped[float | None] = mapped_column(Float, nullable=True)
    prcp: Mapped[float | None] = mapped_column(Float, nullable=True)
