import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.domain.planning.models import (
    ProductModel,
    RootstockModel,
    SimulationPlanModel,
    VarietyModel,
)
from bahcelab_backend.domain.planning.schemas import (
    CreatePlanRequest,
    ProductDetailResponse,
    ProductListItem,
    RootstockResponse,
    UpdatePlanRequest,
    VarietyResponse,
)
from bahcelab_backend.shared.errors import AppError, AppErrorCode


class PlanRepository:
    def __init__(self, session: AsyncSession, workspace_id: uuid.UUID) -> None:
        self.session = session
        self.workspace_id = workspace_id

    async def list_plans(self) -> list[SimulationPlanModel]:
        result = await self.session.execute(
            select(SimulationPlanModel)
            .where(SimulationPlanModel.workspace_id == self.workspace_id)
            .order_by(SimulationPlanModel.updated_at.desc())
        )
        return list(result.scalars().all())

    async def get_plan(self, plan_id: uuid.UUID) -> SimulationPlanModel | None:
        result = await self.session.execute(
            select(SimulationPlanModel).where(
                SimulationPlanModel.id == plan_id,
                SimulationPlanModel.workspace_id == self.workspace_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_plan_or_404(self, plan_id: uuid.UUID) -> SimulationPlanModel:
        plan = await self.get_plan(plan_id)
        if plan is None:
            raise AppError(404, AppErrorCode.NOT_FOUND, f"Plan bulunamadı: {plan_id}")
        return plan

    async def create_plan(self, request: CreatePlanRequest) -> SimulationPlanModel:
        plan = SimulationPlanModel(
            workspace_id=self.workspace_id,
            name=request.name,
            garden_id=request.garden_id,
        )
        self.session.add(plan)
        await self.session.flush()
        await self.session.refresh(plan)
        return plan

    async def update_plan(
        self, plan_id: uuid.UUID, request: UpdatePlanRequest
    ) -> SimulationPlanModel:
        plan = await self.get_plan_or_404(plan_id)

        if request.name is not None:
            plan.name = request.name
        if request.status is not None:
            plan.status = request.status
        if request.current_step is not None:
            plan.current_step = request.current_step
        if request.garden_id is not None:
            plan.garden_id = request.garden_id
        if request.product_selection is not None:
            plan.product_selection = request.product_selection.model_dump()
        if request.planting_plan is not None:
            plan.planting_plan = request.planting_plan.model_dump(mode="json")
        if request.maintenance_plan is not None:
            plan.maintenance_plan = request.maintenance_plan.model_dump()
        if request.growth_simulation is not None:
            plan.growth_simulation = request.growth_simulation.model_dump()

        plan.updated_at = datetime.now().astimezone()
        await self.session.flush()
        await self.session.refresh(plan)
        return plan

    async def delete_plan(self, plan_id: uuid.UUID) -> None:
        plan = await self.get_plan_or_404(plan_id)
        await self.session.delete(plan)


class ProductRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_products(self) -> list[ProductListItem]:
        result = await self.session.execute(
            select(ProductModel)
            .where(ProductModel.is_active.is_(True))
            .order_by(ProductModel.name)
        )
        products = result.scalars().all()
        return [
            ProductListItem(
                id=p.id,
                name=p.name,
                slug=p.slug,
                description=p.description,
                image_url=p.image_url,
            )
            for p in products
        ]

    async def get_product_detail(self, product_id: uuid.UUID) -> ProductDetailResponse:
        result = await self.session.execute(
            select(ProductModel).where(
                ProductModel.id == product_id,
                ProductModel.is_active.is_(True),
            )
        )
        product = result.scalar_one_or_none()
        if product is None:
            raise AppError(404, AppErrorCode.NOT_FOUND, f"Ürün bulunamadı: {product_id}")

        varieties_result = await self.session.execute(
            select(VarietyModel)
            .where(
                VarietyModel.product_id == product_id,
                VarietyModel.is_active.is_(True),
            )
            .order_by(VarietyModel.name)
        )
        varieties = varieties_result.scalars().all()

        variety_responses: list[VarietyResponse] = []
        for variety in varieties:
            rootstocks_result = await self.session.execute(
                select(RootstockModel)
                .where(
                    RootstockModel.variety_id == variety.id,
                    RootstockModel.is_active.is_(True),
                )
                .order_by(RootstockModel.name)
            )
            rootstocks = rootstocks_result.scalars().all()
            variety_responses.append(
                VarietyResponse(
                    id=variety.id,
                    name=variety.name,
                    slug=variety.slug,
                    recommended_planting_period=variety.recommended_planting_period,
                    yield_start_period=variety.yield_start_period,
                    image_url=variety.image_url,
                    rootstocks=[
                        RootstockResponse(id=r.id, name=r.name, slug=r.slug)
                        for r in rootstocks
                    ],
                )
            )

        return ProductDetailResponse(
            id=product.id,
            name=product.name,
            slug=product.slug,
            description=product.description,
            image_url=product.image_url,
            varieties=variety_responses,
        )
