import uuid
from typing import Annotated

from fastapi import Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.config import get_settings
from bahcelab_backend.database import get_db_session
from bahcelab_backend.domain.planning.repository import PlanRepository, ProductRepository
from bahcelab_backend.domain.planning.service import PlanningService
from bahcelab_backend.shared.errors import AppError, AppErrorCode


async def get_workspace_id(
    x_workspace_id: Annotated[str | None, Header()] = None,
) -> uuid.UUID:
    settings = get_settings()
    if not settings.require_workspace_header:
        return uuid.UUID("00000000-0000-0000-0000-000000000001")

    if not x_workspace_id:
        raise AppError(
            401,
            AppErrorCode.FORBIDDEN,
            "X-Workspace-Id header gerekli",
        )

    try:
        return uuid.UUID(x_workspace_id)
    except ValueError:
        raise AppError(
            422,
            AppErrorCode.VALIDATION_ERROR,
            "X-Workspace-Id geçerli bir UUID olmalı",
        ) from None


async def get_plan_repository(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    workspace_id: Annotated[uuid.UUID, Depends(get_workspace_id)],
) -> PlanRepository:
    return PlanRepository(session, workspace_id)


async def get_planning_service(
    repo: Annotated[PlanRepository, Depends(get_plan_repository)],
) -> PlanningService:
    return PlanningService(repo)


async def get_product_repository(
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> ProductRepository:
    return ProductRepository(session)
