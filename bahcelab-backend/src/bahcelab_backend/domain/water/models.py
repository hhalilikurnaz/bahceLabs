"""Su ve sıcaklık dilimi tabloları (ADR 0017): ERA5-Land günlük/saatlik, doğrulama gözlemleri, toprak profili."""

import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import Date, DateTime, Float, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from bahcelab_backend.database import Base

ERA5, MODEL = "era5_land", "model"  # veri kaynağı bayrağı: yeniden analiz (düz çizgi) | model tahmini (kesikli çizgi)


class Era5DailyModel(Base):
    """Hava hücresi × gün: 4 katman toprak nemi (m³/m³), ET0, yağış, sıcaklık. Saatlik diziler `saatlik`te; günlük toplulaştırma sütunlarda."""

    __tablename__ = "era5_daily"

    cell_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("weather_cells.id", ondelete="CASCADE"), primary_key=True)
    tarih: Mapped[date] = mapped_column(Date, primary_key=True)
    sm0: Mapped[float | None] = mapped_column(Float, nullable=True)  # 0–7 cm
    sm1: Mapped[float | None] = mapped_column(Float, nullable=True)  # 7–28 cm
    sm2: Mapped[float | None] = mapped_column(Float, nullable=True)  # 28–100 cm
    sm3: Mapped[float | None] = mapped_column(Float, nullable=True)  # 100–255 cm
    et0_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    yagis_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    t_ort: Mapped[float | None] = mapped_column(Float, nullable=True)
    t_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    t_max: Mapped[float | None] = mapped_column(Float, nullable=True)
    saatlik: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    toprak_kaynak: Mapped[str] = mapped_column(String(12), nullable=False, default=ERA5)  # toprak nemi: era5_land | model
    hava_kaynak: Mapped[str] = mapped_column(String(12), nullable=False, default=ERA5)  # ET0/yağış/sıcaklık: era5_land | model
    guncelleme: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ValidationObservationModel(Base):
    """Doğrulama gözlemi (SMAP yüzey nemi, IMERG/CHIRPS yağış): bahçe noktası; arayüzde GÖSTERİLMEZ, yalnız doğrulama ve yağış notu için."""

    __tablename__ = "dogrulama_gozlem"

    garden_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("gardens.id", ondelete="CASCADE"), primary_key=True)
    source_id: Mapped[str] = mapped_column(String(40), ForeignKey("data_sources.id"), primary_key=True)
    tarih: Mapped[date] = mapped_column(Date, primary_key=True)
    indeks: Mapped[str] = mapped_column(String(16), primary_key=True)  # sm_yuzey | yagis_mm
    deger: Mapped[float | None] = mapped_column(Float, nullable=True)
    ayrinti: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)  # komşuluk ortalaması, kalite bayrağı, kaynak sürümü
    guncelleme: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class SoilProfileModel(Base):
    """Bahçe noktasında 0–100 cm doku ve organik karbon (SoilGrids 250 m) ile pedotransfer'den tarla kapasitesi ve solma noktası. Ön değer: Adım 14 toprak tahlili yerine geçer."""

    __tablename__ = "soil_profiles"

    garden_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("gardens.id", ondelete="CASCADE"), primary_key=True)
    kum_yuzde: Mapped[float | None] = mapped_column(Float, nullable=True)
    kil_yuzde: Mapped[float | None] = mapped_column(Float, nullable=True)
    silt_yuzde: Mapped[float | None] = mapped_column(Float, nullable=True)
    organik_karbon_g_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    tarla_kapasitesi: Mapped[float | None] = mapped_column(Float, nullable=True)  # m³/m³
    solma_noktasi: Mapped[float | None] = mapped_column(Float, nullable=True)  # m³/m³
    kaynak: Mapped[str] = mapped_column(String(80), nullable=False)
    ayrinti: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    hesaplama: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
