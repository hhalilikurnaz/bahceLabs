import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from bahcelab_backend.database import Base


class PhenologyOverrideModel(Base):
    """Bahçe düzeyinde fenoloji evresi tarih düzeltmesi (katalog değerinin yerine geçer)."""

    __tablename__ = "garden_phenology_overrides"

    garden_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("gardens.id", ondelete="CASCADE"), primary_key=True
    )
    evre_kodu: Mapped[str] = mapped_column(String(40), primary_key=True)
    baslangic: Mapped[str] = mapped_column(String(5), nullable=False)  # AA-GG
    bitis: Mapped[str] = mapped_column(String(5), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
