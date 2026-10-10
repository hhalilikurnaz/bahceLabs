from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status

from bahcelab_backend.api.deps import (
    get_current_user,
    get_planning_service,
    get_product_repository,
)
from bahcelab_backend.domain.planning.repository import ProductRepository
from bahcelab_backend.domain.planning.schemas import (
    CreatePlanRequest,
    ProductDetailResponse,
    ProductListItem,
    SaveLandRequest,
    SimulationPlan,
    UpdatePlanRequest,
)
from bahcelab_backend.domain.planning.service import PlanningService

router = APIRouter(
    prefix="/planning", tags=["planning"], dependencies=[Depends(get_current_user)]
)


@router.get("/plans", response_model=list[SimulationPlan])
async def list_plans(
    service: Annotated[PlanningService, Depends(get_planning_service)],
) -> list[SimulationPlan]:
    return await service.list_plans()


@router.post("/plans", response_model=SimulationPlan, status_code=status.HTTP_201_CREATED)
async def create_plan(
    request: CreatePlanRequest,
    service: Annotated[PlanningService, Depends(get_planning_service)],
) -> SimulationPlan:
    return await service.create_plan(request)


@router.get("/plans/{plan_id}", response_model=SimulationPlan)
async def get_plan(
    plan_id: UUID,
    service: Annotated[PlanningService, Depends(get_planning_service)],
) -> SimulationPlan:
    return await service.get_plan(plan_id)


@router.patch("/plans/{plan_id}", response_model=SimulationPlan)
async def update_plan(
    plan_id: UUID,
    request: UpdatePlanRequest,
    service: Annotated[PlanningService, Depends(get_planning_service)],
) -> SimulationPlan:
    return await service.update_plan(plan_id, request)


@router.delete("/plans/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_plan(
    plan_id: UUID,
    service: Annotated[PlanningService, Depends(get_planning_service)],
) -> None:
    await service.delete_plan(plan_id)


@router.post("/plans/{plan_id}/land", response_model=SimulationPlan)
async def save_land(
    plan_id: UUID,
    request: SaveLandRequest,
    service: Annotated[PlanningService, Depends(get_planning_service)],
) -> SimulationPlan:
    return await service.save_land(plan_id, request)


@router.get("/products", response_model=list[ProductListItem])
async def list_products(
    repo: Annotated[ProductRepository, Depends(get_product_repository)],
) -> list[ProductListItem]:
    return await repo.list_products()


@router.get("/products/{product_id}", response_model=ProductDetailResponse)
async def get_product(
    product_id: UUID,
    repo: Annotated[ProductRepository, Depends(get_product_repository)],
) -> ProductDetailResponse:
    return await repo.get_product_detail(product_id)
