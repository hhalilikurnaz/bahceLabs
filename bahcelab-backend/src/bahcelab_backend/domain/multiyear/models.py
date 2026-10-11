import uuid
from datetime import date, datetime
from typing import Any

from geoalchemy2 import Geometry
from sqlalchemy import (
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

YEAR_ACTIVE = ("bekliyor", "isleniyor")
YEAR_FINAL = ("tamam", "hata")


class MultiyearRunModel(Base):
    """Bahçe başına çok yıllık analiz çalıştırması: kapsam (arşiv başlangıcı…bitiş yılı), sağlayıcı ve sınır özeti."""

    __tablename__ = "multiyear_runs"

    garden_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("gardens.id", ondelete="CASCADE"), primary_key=True)
    provider: Mapped[str] = mapped_column(String(40), nullable=False)
    arsiv_baslangic: Mapped[date | None] = mapped_column(Date, nullable=True)
    baslangic_yili: Mapped[int] = mapped_column(Integer, nullable=False)
    bitis_yili: Mapped[int] = mapped_column(Integer, nullable=False)
    pencere: Mapped[str] = mapped_column(String(40), nullable=False)  # "ndvi:06-09" (indeks:ay aralığı) – değişirse yeniden hesaplanır
    geometry_hash: Mapped[str] = mapped_column(String(40), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class MultiyearYearModel(Base):
    """İlerleme tablosu: bahçe × yıl görevi (durum, net sahne sayısı, hata) ve kompozit meta verisi."""

    __tablename__ = "multiyear_years"
    __table_args__ = (UniqueConstraint("garden_id", "yil", name="uq_multiyear_garden_yil"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    garden_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("gardens.id", ondelete="CASCADE"), nullable=False, index=True)
    yil: Mapped[int] = mapped_column(Integer, nullable=False)
    # bekliyor · isleniyor · tamam · hata
    durum: Mapped[str] = mapped_column(String(12), nullable=False, default="bekliyor")
    sahne_sayisi: Mapped[int] = mapped_column(Integer, nullable=False, default=0)  # kompozite giren net sahne
    aday_sayisi: Mapped[int] = mapped_column(Integer, nullable=False, default=0)  # aranan/okunan aday sahne
    kismi: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)  # arşiv yıl penceresinin ortasında başlıyor
    hata_mesaji: Mapped[str | None] = mapped_column(Text, nullable=True)
    kompozit_yolu: Mapped[str | None] = mapped_column(Text, nullable=True)
    baslangic: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    bitis: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sure_saniye: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Kullanıcı seçimi: None = otomatik (uyumsuz değilse dahil), True/False = elle
    dahil_elle: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    uyumsuz: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    korelasyon: Mapped[float | None] = mapped_column(Float, nullable=True)
    uyumsuz_nedeni: Mapped[str | None] = mapped_column(Text, nullable=True)
    kapsam: Mapped[float | None] = mapped_column(Float, nullable=True)  # bahçe piksellerinin geçerli oranı
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class MultiyearResultModel(Base):
    """Sürümlü bölgeleme sonucu (bahçe × bölge sayısı × sürüm). Çokgenler `MultiyearZoneModel`'de, PostGIS'te."""

    __tablename__ = "multiyear_results"
    __table_args__ = (UniqueConstraint("garden_id", "bolge_sayisi", "versiyon", name="uq_multiyear_result_version"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    garden_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("gardens.id", ondelete="CASCADE"), nullable=False, index=True)
    bolge_sayisi: Mapped[int] = mapped_column(Integer, nullable=False)
    versiyon: Mapped[int] = mapped_column(Integer, nullable=False)
    durum: Mapped[str] = mapped_column(String(12), nullable=False)  # tamam · yetersiz
    mesaj: Mapped[str | None] = mapped_column(Text, nullable=True)
    yillar: Mapped[list[int]] = mapped_column(JSONB, nullable=False, default=list)  # kullanılan yıllar
    homojen: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    yayilim_yuzde: Mapped[float | None] = mapped_column(Float, nullable=True)
    bahce_ortalamasi: Mapped[float | None] = mapped_column(Float, nullable=True)
    parametreler: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    aktif: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class MultiyearZoneModel(Base):
    """Bir sonuca ait çokgenler: tur = 'bolge' (sinif 1..k, 1 en zayıf) ya da 'istikrar' (1 düşük, 2 orta, 3 yüksek)."""

    __tablename__ = "multiyear_zones"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    result_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("multiyear_results.id", ondelete="CASCADE"), nullable=False, index=True)
    tur: Mapped[str] = mapped_column(String(10), nullable=False)
    sinif: Mapped[int] = mapped_column(Integer, nullable=False)
    alan_m2: Mapped[float] = mapped_column(Float, nullable=False)
    pay: Mapped[float] = mapped_column(Float, nullable=False)
    fark_yuzde: Mapped[float | None] = mapped_column(Float, nullable=True)
    istikrar: Mapped[float | None] = mapped_column(Float, nullable=True)
    ortalama: Mapped[float | None] = mapped_column(Float, nullable=True)
    geom = mapped_column(Geometry(geometry_type="MULTIPOLYGON", srid=4326, spatial_index=True), nullable=False)
