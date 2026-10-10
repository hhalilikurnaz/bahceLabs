from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field

DataAvailability = Literal["available", "no_data", "not_configured", "unavailable"]
SimulationPlanStatus = Literal["draft", "saved", "applied"]
PlanningStepId = Literal["land", "product", "planting", "maintenance", "simulation"]
ValidationStatus = Literal["valid", "invalid", "pending", "not_set"]


class GeoJsonPolygon(BaseModel):
    type: Literal["Polygon"] = "Polygon"
    coordinates: list[list[list[float]]]


class PlanningLand(BaseModel):
    geometry: GeoJsonPolygon | None = None
    area_m2: float | None = None
    perimeter_m: float | None = None
    location_label: str | None = None
    validation_status: ValidationStatus = "not_set"
    validation_message: str | None = None


class ProductSelection(BaseModel):
    product_id: str | None = None
    product_name: str | None = None
    variety_id: str | None = None
    variety_name: str | None = None
    rootstock_id: str | None = None
    rootstock_name: str | None = None
    image_url: str | None = None
    recommended_planting_period: str | None = None
    yield_start_period: str | None = None


class PlantingSpacing(BaseModel):
    row_spacing_m: float | None = None
    plant_spacing_m: float | None = None


class PlantingPoint(BaseModel):
    id: str
    coordinates: tuple[float, float]
    row_number: int
    point_index: int


class PlantingRow(BaseModel):
    id: str
    row_number: int
    points: list[PlantingPoint] = Field(default_factory=list)


class PlantingSummary(BaseModel):
    total_area_ha: float | None = None
    usable_area_ha: float | None = None
    row_count: int | None = None
    planting_point_count: int | None = None
    spacing_label: str | None = None
    estimated_yield_label: str | None = None
    estimated_yield_availability: DataAvailability = "no_data"
    first_harvest_month: int | None = None
    first_harvest_availability: DataAvailability = "no_data"


class PlantingPlan(BaseModel):
    spacing: PlantingSpacing = Field(default_factory=PlantingSpacing)
    orientation_degrees: float | None = None
    orientation_mode: Literal["auto", "manual"] = "auto"
    boundary_margin_m: float | None = None
    rows: list[PlantingRow] = Field(default_factory=list)
    points: list[PlantingPoint] = Field(default_factory=list)
    summary: PlantingSummary = Field(default_factory=PlantingSummary)


class MaintenancePlan(BaseModel):
    irrigation: dict[str, Any] = Field(
        default_factory=lambda: {
            "method": None,
            "frequency": None,
            "availability": "no_data",
        }
    )
    fertilization: dict[str, Any] = Field(
        default_factory=lambda: {"schedule": None, "availability": "no_data"}
    )
    pruning: dict[str, Any] = Field(
        default_factory=lambda: {"schedule": None, "availability": "no_data"}
    )


class GrowthStage(BaseModel):
    id: str
    name: str
    relative_month: int
    description: str | None = None


class GrowthSimulation(BaseModel):
    current_month: int = 0
    is_playing: bool = False
    stages: list[GrowthStage] = Field(default_factory=list)
    active_stage_id: str | None = None
    result_label: str | None = None
    result_availability: DataAvailability = "no_data"


class SimulationPlan(BaseModel):
    id: UUID
    name: str
    workspace_id: UUID
    garden_id: UUID | None = None
    status: SimulationPlanStatus
    current_step: PlanningStepId
    draft_land: PlanningLand
    product_selection: ProductSelection
    planting_plan: PlantingPlan | None = None
    maintenance_plan: MaintenancePlan | None = None
    growth_simulation: GrowthSimulation | None = None
    created_at: str
    updated_at: str
    is_dirty: bool = False


class CreatePlanRequest(BaseModel):
    name: str = "Yeni Plan"
    garden_id: UUID | None = None


class UpdatePlanRequest(BaseModel):
    name: str | None = None
    status: SimulationPlanStatus | None = None
    current_step: PlanningStepId | None = None
    garden_id: UUID | None = None
    product_selection: ProductSelection | None = None
    planting_plan: PlantingPlan | None = None
    maintenance_plan: MaintenancePlan | None = None
    growth_simulation: GrowthSimulation | None = None


class SaveLandRequest(BaseModel):
    geometry: GeoJsonPolygon
    location_label: str | None = None


class RootstockResponse(BaseModel):
    id: UUID
    name: str
    slug: str


class VarietyResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    recommended_planting_period: str | None = None
    yield_start_period: str | None = None
    image_url: str | None = None
    rootstocks: list[RootstockResponse] = Field(default_factory=list)


class ProductListItem(BaseModel):
    id: UUID
    name: str
    slug: str
    description: str | None = None
    image_url: str | None = None


class ProductDetailResponse(ProductListItem):
    varieties: list[VarietyResponse] = Field(default_factory=list)
