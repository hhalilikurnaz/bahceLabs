"""Veri temeli (ADR 0015): kaynak kaydı, sahne edinimleri, ay bazlı geçmiş doldurma ilerlemesi, piksel istatistikleri ve normal bantlar."""

import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    Float,
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

ACQ_NET, ACQ_CLOUDY, ACQ_ERROR = "net", "bulutlu", "hata"
MONTH_PENDING, MONTH_RUNNING, MONTH_DONE, MONTH_ERROR = "bekliyor", "isleniyor", "tamam", "hata"


class DataSourceModel(Base):
    """Uydu/veri kaynağı kaydı: çözünürlük, tekrar sıklığı ve durum (etkin | planlı)."""

    __tablename__ = "data_sources"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    ad: Mapped[str] = mapped_column(String(80), nullable=False)
    cozunurluk_m: Mapped[float] = mapped_column(Float, nullable=False)
    tekrar_gun: Mapped[int] = mapped_column(Integer, nullable=False)
    durum: Mapped[str] = mapped_column(String(10), nullable=False)  # aktif | planli
    aciklama: Mapped[str | None] = mapped_column(Text, nullable=True)


class AcquisitionModel(Base):
    """Bir bahçe için bir kaynaktan denenen sahne. Ham bant yok: gösterge ızgaraları (float16) + sürüm bilgisi."""

    __tablename__ = "acquisitions"
    __table_args__ = (UniqueConstraint("garden_id", "source_id", "scene_id", name="uq_acquisition_scene"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    garden_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("gardens.id", ondelete="CASCADE"), nullable=False, index=True)
    source_id: Mapped[str] = mapped_column(String(40), ForeignKey("data_sources.id"), nullable=False)
    scene_id: Mapped[str] = mapped_column(String(120), nullable=False)
    tarih: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    bulut_orani: Mapped[float | None] = mapped_column(Float, nullable=True)
    durum: Mapped[str] = mapped_column(String(10), nullable=False)  # net | bulutlu | hata
    hata_mesaji: Mapped[str | None] = mapped_column(Text, nullable=True)
    gecerli_oran: Mapped[float | None] = mapped_column(Float, nullable=True)  # bahçede geçerli (bulutsuz) piksel oranı
    gecikme_gun: Mapped[int | None] = mapped_column(Integer, nullable=True)  # sahne tarihi → işleme günü
    isleme_surumu: Mapped[str | None] = mapped_column(String(10), nullable=True)  # processing baseline
    formul_surumu: Mapped[str | None] = mapped_column(String(40), nullable=True)
    yorunge: Mapped[int | None] = mapped_column(Integer, nullable=True)  # radar: göreli yörünge (değişim yalnız aynı yörüngede)
    gecis_yonu: Mapped[str | None] = mapped_column(String(10), nullable=True)  # radar: inis | cikis
    maskeli_oran: Mapped[float | None] = mapped_column(Float, nullable=True)  # radar: bahçede gölge/üst üste binme/geçersiz piksel payı
    izgara_yolu: Mapped[str | None] = mapped_column(Text, nullable=True)
    izgara_boyut_bayt: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class AcquisitionStatModel(Base):
    """Bir edinimin gösterge başına piksel istatistikleri (bahçe içi geçerli pikseller)."""

    __tablename__ = "acquisition_stats"

    acquisition_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("acquisitions.id", ondelete="CASCADE"), primary_key=True)
    indeks: Mapped[str] = mapped_column(String(12), primary_key=True)
    ortalama: Mapped[float] = mapped_column(Float, nullable=False)
    medyan: Mapped[float] = mapped_column(Float, nullable=False)
    p10: Mapped[float] = mapped_column(Float, nullable=False)
    p25: Mapped[float] = mapped_column(Float, nullable=False)
    p75: Mapped[float] = mapped_column(Float, nullable=False)
    p90: Mapped[float] = mapped_column(Float, nullable=False)
    minimum: Mapped[float] = mapped_column(Float, nullable=False)
    maksimum: Mapped[float] = mapped_column(Float, nullable=False)
    gecerli_piksel: Mapped[int] = mapped_column(Integer, nullable=False)


class RadarOrbitModel(Base):
    """Bahçeyi kapsayan radar yörüngeleri; en sık geçen «birincil» (ızgara saklanır), diğerleri ayrı seri (yalnız istatistik)."""

    __tablename__ = "radar_orbits"

    garden_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("gardens.id", ondelete="CASCADE"), primary_key=True)
    yorunge: Mapped[int] = mapped_column(Integer, primary_key=True)
    gecis_yonu: Mapped[str] = mapped_column(String(10), primary_key=True)
    sahne_sayisi: Mapped[int] = mapped_column(Integer, nullable=False)
    birincil: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    guncelleme: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class BackfillMonthModel(Base):
    """Geçmiş doldurma ilerlemesi: bahçe × kaynak × ay görevi (idempotent, kaldığı yerden devam)."""

    __tablename__ = "backfill_months"

    garden_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("gardens.id", ondelete="CASCADE"), primary_key=True)
    source_id: Mapped[str] = mapped_column(String(40), ForeignKey("data_sources.id"), primary_key=True)
    ay: Mapped[date] = mapped_column(Date, primary_key=True)  # ayın ilk günü
    durum: Mapped[str] = mapped_column(String(10), nullable=False, default=MONTH_PENDING)
    net_sahne: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    aday_sayisi: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    hata_mesaji: Mapped[str | None] = mapped_column(Text, nullable=True)
    sure_saniye: Mapped[float | None] = mapped_column(Float, nullable=True)
    guncelleme: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    geometry_hash: Mapped[str | None] = mapped_column(String(40), nullable=True)  # sınır değişirse eski aylar geçersiz


class NormalBandModel(Base):
    """Normal bant: bahçe × gösterge × takvim ayı için yıllar arası dağılım. Eksik yıl/aylar uydurulmaz; yetersiz geçmişte yüzdelikler boştur."""

    __tablename__ = "normal_bands"

    garden_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("gardens.id", ondelete="CASCADE"), primary_key=True)
    source_id: Mapped[str] = mapped_column(String(40), ForeignKey("data_sources.id"), primary_key=True)
    indeks: Mapped[str] = mapped_column(String(12), primary_key=True)
    ay: Mapped[int] = mapped_column(Integer, primary_key=True)  # 1–12
    yil_sayisi: Mapped[int] = mapped_column(Integer, nullable=False)
    yillar: Mapped[list[int]] = mapped_column(JSONB, nullable=False, default=list)  # banda giren yıllar
    p10: Mapped[float | None] = mapped_column(Float, nullable=True)
    p25: Mapped[float | None] = mapped_column(Float, nullable=True)
    p50: Mapped[float | None] = mapped_column(Float, nullable=True)
    p75: Mapped[float | None] = mapped_column(Float, nullable=True)
    p90: Mapped[float | None] = mapped_column(Float, nullable=True)
    ceyrek_yeterli: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)  # p25–p75 (en az 5 yıl)
    onluk_yeterli: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)  # p10–p90 (en az 8 yıl)
    formul_surumu: Mapped[str | None] = mapped_column(String(40), nullable=True)
    hesaplama: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    ayrinti: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)  # yıl → aylık temsilci değer (şeffaflık)
