import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from bahcelab_backend.database import Base


class SimulationPlanStatus(StrEnum):
    DRAFT = "draft"
    SAVED = "saved"
    APPLIED = "applied"


class PlanningStepId(StrEnum):
    LAND = "land"
    PRODUCT = "product"
    PLANTING = "planting"
    MAINTENANCE = "maintenance"
    SIMULATION = "simulation"


def _default_draft_land() -> dict:
    return {
        "geometry": None,
        "area_m2": None,
        "perimeter_m": None,
        "location_label": None,
        "validation_status": "not_set",
        "validation_message": None,
    }


def _default_product_selection() -> dict:
    return {
        "product_id": None,
        "product_name": None,
        "variety_id": None,
        "variety_name": None,
        "rootstock_id": None,
        "rootstock_name": None,
        "image_url": None,
        "recommended_planting_period": None,
        "yield_start_period": None,
    }


class SimulationPlanModel(Base):
    __tablename__ = "simulation_plans"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, default="Yeni Plan")
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=SimulationPlanStatus.DRAFT
    )
    garden_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    current_step: Mapped[str] = mapped_column(
        String(20), nullable=False, default=PlanningStepId.LAND
    )

    draft_land: Mapped[dict] = mapped_column(JSONB, nullable=False, default=_default_draft_land)
    product_selection: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=_default_product_selection
    )
    planting_plan: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    maintenance_plan: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    growth_simulation: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class ProductModel(Base):
    __tablename__ = "products"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    slug: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class VarietyModel(Base):
    __tablename__ = "varieties"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), nullable=False)
    recommended_planting_period: Mapped[str | None] = mapped_column(String(100), nullable=True)
    yield_start_period: Mapped[str | None] = mapped_column(String(100), nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)


class RootstockModel(Base):
    __tablename__ = "rootstocks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    variety_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
