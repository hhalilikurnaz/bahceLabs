from bahcelab_backend.domain.planning.geometry_service import (
    GeometryValidationError,
    validate_and_measure_land,
)
from bahcelab_backend.domain.planning.models import SimulationPlanModel
from bahcelab_backend.domain.planning.repository import PlanRepository
from bahcelab_backend.domain.planning.schemas import (
    CreatePlanRequest,
    PlanningLand,
    ProductSelection,
    SaveLandRequest,
    SimulationPlan,
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
        status=plan.status,
        current_step=plan.current_step,
        draft_land=draft_land,
        product_selection=product_selection,
        planting_plan=plan.planting_plan,
        maintenance_plan=plan.maintenance_plan,
        growth_simulation=plan.growth_simulation,
        created_at=plan.created_at.isoformat(),
        updated_at=plan.updated_at.isoformat(),
        is_dirty=is_dirty,
    )


class PlanningService:
    def __init__(self, repo: PlanRepository) -> None:
        self.repo = repo

    async def list_plans(self) -> list[SimulationPlan]:
        plans = await self.repo.list_plans()
        return [_model_to_schema(p) for p in plans]

    async def get_plan(self, plan_id) -> SimulationPlan:
        plan = await self.repo.get_plan_or_404(plan_id)
        return _model_to_schema(plan)

    async def create_plan(self, request: CreatePlanRequest) -> SimulationPlan:
        plan = await self.repo.create_plan(request)
        return _model_to_schema(plan, is_dirty=True)

    async def update_plan(self, plan_id, request: UpdatePlanRequest) -> SimulationPlan:
        plan = await self.repo.update_plan(plan_id, request)
        return _model_to_schema(plan)

    async def delete_plan(self, plan_id) -> None:
        await self.repo.delete_plan(plan_id)

    async def save_land(self, plan_id, request: SaveLandRequest) -> SimulationPlan:
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
