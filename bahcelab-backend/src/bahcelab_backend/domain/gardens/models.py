import uuid
from datetime import datetime
from decimal import Decimal

from geoalchemy2 import Geometry
from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, SmallInteger, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from bahcelab_backend.database import Base

PRODUCTS = ("limon", "portakal", "mandalina", "greyfurt", "diger")

class GardenModel(Base):
    __tablename__ = "gardens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    ad: Mapped[str] = mapped_column(String(120), nullable=False)
    urun: Mapped[str] = mapped_column(String(20), nullable=False, default="limon")
    cesit: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # Katalog çeşit kodu (domain/agro/rules/katalog.yaml); 'diger' ise `cesit` serbest metindir
    cesit_kodu: Mapped[str | None] = mapped_column(String(40), nullable=True)
    dikim_yili: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    agac_sayisi: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Polygon veya MultiPolygon, EPSG:4326. GiST indeksi migration'da oluşturulur.
    geom = mapped_column(
        Geometry(geometry_type="GEOMETRY", srid=4326, spatial_index=False), nullable=False
    )
    alan_dekar: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    il: Mapped[str | None] = mapped_column(String(100), nullable=True)
    ilce: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
