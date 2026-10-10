import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import Date, DateTime, Float, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from bahcelab_backend.database import Base


class WeatherCellModel(Base):
    """Hava ızgara hücresi (0,05°): yakın bahçeler aynı hücreyi paylaşır, sağlayıcıya tek istek gider."""

    __tablename__ = "weather_cells"
    __table_args__ = (UniqueConstraint("enlem", "boylam", name="uq_weather_cell"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    enlem: Mapped[float] = mapped_column(Float, nullable=False)  # hücre merkezi
    boylam: Mapped[float] = mapped_column(Float, nullable=False)
    # Son tahmin yanıtı (sağlayıcıdan bağımsız biçim) ve alındığı an: 1 saatlik önbellek
    tahmin: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    tahmin_zamani: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    tahmin_kaynak: Mapped[str | None] = mapped_column(String(20), nullable=True)  # saglayici
    gecmis_senkron: Mapped[date | None] = mapped_column(Date, nullable=True)  # günde bir tamamlanır


class WeatherDailyModel(Base):
    """Hücre başına günlük gözlem/analiz (geçmiş ve yakın gün)."""

    __tablename__ = "weather_daily"

    cell_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("weather_cells.id", ondelete="CASCADE"), primary_key=True
    )
    tarih: Mapped[date] = mapped_column(Date, primary_key=True)
    min_sicaklik: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_sicaklik: Mapped[float | None] = mapped_column(Float, nullable=True)
    yagis_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    et0_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    # arsiv: ERA5 · tahmin: tahmin API'sinin geçmiş günü 
    kaynak: Mapped[str] = mapped_column(String(10), nullable=False, default="arsiv")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
