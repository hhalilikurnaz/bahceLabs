import uuid
from typing import cast

from bahcelab_backend.domain.gardens.repository import GardenRepository
from bahcelab_backend.domain.planning.geometry_service import (
    GeometryValidationError,
    validate_and_measure_land,
)
from bahcelab_backend.domain.planning.models import SimulationPlanModel
from bahcelab_backend.domain.planning.repository import PlanRepository
from bahcelab_backend.domain.planning.schemas import (
    CreatePlanRequest,
    GeoJsonPolygon,
    GrowthSimulation,
    MaintenancePlan,
    PlanningLand,
    PlanningStepId,
    PlantingPlan,
    ProductSelection,
    SaveLandRequest,
    SimulationPlan,
    SimulationPlanStatus,
    UpdatePlanRequest,
)
from bahcelab_backend.shared.errors import AppError, AppErrorCode


def _model_to_schema(plan: SimulationPlanModel, is_dirty: bool = False) -> SimulationPlan:
    draft_land = PlanningLand.model_validate(plan.draft_land)
    product_selection = ProductSelection.model_validate(plan.product_selection)

    return SimulationPlan(
        id=plan.id,
        name=plan.name,
        workspace_id=plan.workspace_id,
        garden_id=plan.garden_id,
        status=cast(SimulationPlanStatus, plan.status),
        current_step=cast(PlanningStepId, plan.current_step),
        draft_land=draft_land,
        product_selection=product_selection,
        planting_plan=PlantingPlan.model_validate(plan.planting_plan) if plan.planting_plan else None,
        maintenance_plan=MaintenancePlan.model_validate(plan.maintenance_plan) if plan.maintenance_plan else None,
        growth_simulation=GrowthSimulation.model_validate(plan.growth_simulation) if plan.growth_simulation else None,
        created_at=plan.created_at.isoformat(),
        updated_at=plan.updated_at.isoformat(),
        is_dirty=is_dirty,
    )


class PlanningService:
    def __init__(self, repo: PlanRepository, garden_repo: GardenRepository | None = None) -> None:
        self.repo = repo
        self.garden_repo = garden_repo

    async def _land_from_garden(self, garden_id: uuid.UUID) -> PlanningLand:
        """Kayıtlı bahçenin sınırını plan taslağına aktarır (yalnızca kullanıcının kendi bahçesi)."""
        row = await self.garden_repo.get(garden_id) if self.garden_repo else None
        if row is None:
            raise AppError(404, AppErrorCode.NOT_FOUND, "Bahçe bulunamadı.")
        if row.geojson["type"] != "Polygon":
            raise AppError(
                422,
                AppErrorCode.INVALID_GEOMETRY,
                "Çok parçalı bahçeler planlamada henüz desteklenmiyor.",
            )

        geometry = GeoJsonPolygon(coordinates=row.geojson["coordinates"])
        land = validate_and_measure_land(geometry)  # çevre ve geçerlilik
        garden = row.garden
        land.area_m2 = round(float(garden.alan_dekar) * 1000, 1)  # bahçe listesiyle aynı değer
        parts = [p for p in (garden.ilce, garden.il) if p]
        land.location_label = ", ".join(parts) if parts else None
        return land

    async def list_plans(self) -> list[SimulationPlan]:
        plans = await self.repo.list_plans()
        return [_model_to_schema(p) for p in plans]

    async def get_plan(self, plan_id: uuid.UUID) -> SimulationPlan:
        plan = await self.repo.get_plan_or_404(plan_id)
        return _model_to_schema(plan)

    async def create_plan(self, request: CreatePlanRequest) -> SimulationPlan:
        land = await self._land_from_garden(request.garden_id) if request.garden_id else None
        plan = await self.repo.create_plan(request)
        if land is not None:
            plan.draft_land = land.model_dump()
            await self.repo.session.flush()
            await self.repo.session.refresh(plan)
        return _model_to_schema(plan, is_dirty=True)

    async def update_plan(self, plan_id: uuid.UUID, request: UpdatePlanRequest) -> SimulationPlan:
        plan = await self.repo.update_plan(plan_id, request)
        return _model_to_schema(plan)

    async def delete_plan(self, plan_id: uuid.UUID) -> None:
        await self.repo.delete_plan(plan_id)

    async def save_land(self, plan_id: uuid.UUID, request: SaveLandRequest) -> SimulationPlan:
        plan = await self.repo.get_plan_or_404(plan_id)

        try:
            land = validate_and_measure_land(request.geometry)
        except GeometryValidationError as exc:
            raise AppError(
                422,
                AppErrorCode.INVALID_GEOMETRY,
                exc.message,
                details=exc.details,
            ) from exc

        if request.location_label:
            land.location_label = request.location_label

        plan.draft_land = land.model_dump()
        if plan.current_step == "land":
            plan.current_step = "product"

        await self.repo.session.flush()
        await self.repo.session.refresh(plan)
        return _model_to_schema(plan, is_dirty=True)
