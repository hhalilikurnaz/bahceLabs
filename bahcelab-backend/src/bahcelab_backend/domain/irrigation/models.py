"""Bahçe sulama profili (kurulum sihirbazı). Ağaç SAYISI burada değil: bahçenin mevcut beyanından (gardens.agac_sayisi) gelir; konum uydurulmaz."""

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Float, ForeignKey, SmallInteger, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from bahcelab_backend.database import Base


class IrrigationProfileModel(Base):
    __tablename__ = "irrigation_profiles"
    __table_args__ = (
        CheckConstraint("sistem IN ('damla','mini_yagmurlama','salma')", name="ck_irr_sistem"),
        CheckConstraint("enerji IN ('sebeke','gunes','dizel')", name="ck_irr_enerji"),
    )

    garden_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("gardens.id", ondelete="CASCADE"), primary_key=True)
    sistem: Mapped[str] = mapped_column(String(16), nullable=False)
    damlatici_sayisi: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)  # ağaç başına (damla)
    damlatici_debi_lh: Mapped[float | None] = mapped_column(Float, nullable=True)  # L/sa
    sira_aralik_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    agac_aralik_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    pompa_kw: Mapped[float | None] = mapped_column(Float, nullable=True)  # None = bilmiyorum
    pompa_debi_m3h: Mapped[float | None] = mapped_column(Float, nullable=True)
    enerji: Mapped[str] = mapped_column(String(8), nullable=False, default="sebeke")
    kwh_fiyat_tl: Mapped[float | None] = mapped_column(Float, nullable=True)  # kullanıcının girdiği şebeke birim fiyatı
    enerji_m3_maliyet_tl: Mapped[float | None] = mapped_column(Float, nullable=True)  # dizel/güneş: kullanıcı girer
    su_ucreti_m3_tl: Mapped[float | None] = mapped_column(Float, nullable=True)  # sulama birliği, isteğe bağlı
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
