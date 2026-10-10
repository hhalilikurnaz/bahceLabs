import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    Date,
    DateTime,
    Float,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from bahcelab_backend.database import Base

JOB_ACTIVE = ("bekliyor", "isleniyor")


class SceneObservationModel(Base):
    """Bir bahçe için bir tarihteki sahne: bulut durumu ve ortak ızgara. İndeksler `IndexObservationModel`'de."""

    __tablename__ = "scene_observations"
    __table_args__ = (UniqueConstraint("garden_id", "tarih", name="uq_scene_garden_tarih"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    garden_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("gardens.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tarih: Mapped[date] = mapped_column(Date, nullable=False)
    scene_id: Mapped[str] = mapped_column(String(120), nullable=False)
    # tamam: indeksler hesaplandı · bulutlu: geçerli piksel oranı < %70, atlandı
    durum: Mapped[str] = mapped_column(String(10), nullable=False, default="tamam")
    bulut_orani: Mapped[float | None] = mapped_column(
        Float, nullable=True
    )  # sahnenin eo:cloud_cover değeri
    gecerli_piksel_orani: Mapped[float] = mapped_column(Float, nullable=False)
    # Izgara boyutu ve görüntü köşeleri [boylam, enlem]: KB, KD, GD, GB (sahne UTM ızgarası WGS84'te hafif döner)
    satir: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sutun: Mapped[int | None] = mapped_column(Integer, nullable=True)
    goruntu_koordinatlari: Mapped[list[list[float]] | None] = mapped_column(JSONB, nullable=True)
    gercek_renk_png_yolu: Mapped[str | None] = mapped_column(Text, nullable=True)
    # sentinel-2: gerçek uydu verisi · ornek: geliştirme tohum verisi (arayüzde etiketlenir)
    kaynak: Mapped[str] = mapped_column(String(20), nullable=False, default="sentinel-2")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class IndexObservationModel(Base):
    """Bir bahçe, tarih ve indeks için istatistikler, PNG, ham ızgara ve sorunlu bölgeler."""

    __tablename__ = "index_observations"
    __table_args__ = (
        UniqueConstraint("garden_id", "tarih", "indeks", name="uq_index_garden_tarih_indeks"),
        ForeignKeyConstraint(
            ["garden_id", "tarih"],
            ["scene_observations.garden_id", "scene_observations.tarih"],
            ondelete="CASCADE",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    garden_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("gardens.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tarih: Mapped[date] = mapped_column(Date, nullable=False)
    indeks: Mapped[str] = mapped_column(String(20), nullable=False)
    ortalama: Mapped[float] = mapped_column(Float, nullable=False)
    medyan: Mapped[float] = mapped_column(Float, nullable=False)
    p10: Mapped[float] = mapped_column(Float, nullable=False)
    p90: Mapped[float] = mapped_column(Float, nullable=False)
    minimum: Mapped[float] = mapped_column("min", Float, nullable=False)
    maksimum: Mapped[float] = mapped_column("max", Float, nullable=False)
    png_yolu: Mapped[str | None] = mapped_column(Text, nullable=True)  # depolama anahtarı
    # Ham değerler (float32, satır sırası, geçersiz = NaN). NULL: eski kayıt, eksik tamamlanacak
    veri_yolu: Mapped[str | None] = mapped_column(Text, nullable=True)
    sorunlu_bolge_geojson: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class NdviJobModel(Base):
    __tablename__ = "ndvi_jobs"
    __table_args__ = (
        # Bir bahçe için aynı anda yalnızca bir aktif iş
        Index(
            "ux_ndvi_jobs_active",
            "garden_id",
            unique=True,
            postgresql_where=text("durum IN ('bekliyor', 'isleniyor')"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    garden_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("gardens.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tur: Mapped[str] = mapped_column(String(15), nullable=False)  # ilk | guncelleme | yeniden
    durum: Mapped[str] = mapped_column(String(12), nullable=False, default="bekliyor")
    toplam: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    islenen: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    hata_mesaji: Mapped[str | None] = mapped_column(Text, nullable=True)
    baslangic: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    bitis: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
