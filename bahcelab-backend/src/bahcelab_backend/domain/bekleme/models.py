"""Erken erişim bekleme listesi (kayıtlar kapalıyken landing'den gelen başvurular)."""

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from bahcelab_backend.database import Base

URUNLER = ("limon", "portakal", "mandalina", "diger")


class BeklemeListesiModel(Base):
    """Bir e-posta bir kez yazılır (benzersiz). IP adresi ya da başka izleme verisi SAKLANMAZ."""

    __tablename__ = "bekleme_listesi"
    __table_args__ = (CheckConstraint("urun IN ('limon', 'portakal', 'mandalina', 'diger')", name="ck_bekleme_urun"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), nullable=False, unique=True)
    il: Mapped[str] = mapped_column(String(80), nullable=False)
    urun: Mapped[str] = mapped_column(String(20), nullable=False)
    riza_zamani: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)  # açık rızanın verildiği an
    aydinlatma_surumu: Mapped[str] = mapped_column(String(20), nullable=False)  # rızanın verildiği aydınlatma metninin sürümü
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
