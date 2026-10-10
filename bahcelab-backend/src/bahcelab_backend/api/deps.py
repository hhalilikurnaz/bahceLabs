import uuid
from typing import Annotated

from fastapi import BackgroundTasks, Cookie, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.api.auth.cookies import ACCESS_COOKIE
from bahcelab_backend.database import get_db_session
from bahcelab_backend.domain.auth.repository import AuthRepository
from bahcelab_backend.domain.auth.schemas import AuthUser
from bahcelab_backend.domain.auth.security import decode_access_token
from bahcelab_backend.domain.auth.service import AuthService
from bahcelab_backend.domain.gardens.repository import GardenRepository
from bahcelab_backend.domain.gardens.service import GardenService
from bahcelab_backend.domain.ndvi.repository import NdviRepository
from bahcelab_backend.domain.ndvi.service import NdviCoordinator, NdviService
from bahcelab_backend.domain.planning.repository import PlanRepository, ProductRepository
from bahcelab_backend.domain.planning.service import PlanningService
from bahcelab_backend.shared.errors import AppError, AppErrorCode
from bahcelab_backend.shared.storage import get_storage


async def get_auth_service(
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> AuthService:
    return AuthService(AuthRepository(session))


async def get_current_user(
    service: Annotated[AuthService, Depends(get_auth_service)],
    access_token: Annotated[str | None, Cookie(alias=ACCESS_COOKIE)] = None,
) -> AuthUser:
    user_id = decode_access_token(access_token) if access_token else None
    if user_id is None:
        raise AppError(401, AppErrorCode.UNAUTHORIZED, "Giriş yapmanız gerekiyor")
    return await service.get_user(user_id)


async def get_workspace_id(
    user: Annotated[AuthUser, Depends(get_current_user)],
) -> uuid.UUID:
    """Çalışma alanı istemciden değil, giriş yapmış kullanıcıdan gelir."""
    return user.workspace_id


def _coordinator(session: AsyncSession, background_tasks: BackgroundTasks) -> NdviCoordinator:
    return NdviCoordinator(NdviRepository(session), get_storage(), background_tasks)


async def get_garden_service(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    workspace_id: Annotated[uuid.UUID, Depends(get_workspace_id)],
    background_tasks: BackgroundTasks,
) -> GardenService:
    return GardenService(
        GardenRepository(session, workspace_id), _coordinator(session, background_tasks)
    )


async def get_ndvi_service(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    workspace_id: Annotated[uuid.UUID, Depends(get_workspace_id)],
    background_tasks: BackgroundTasks,
) -> NdviService:
    return NdviService(
        GardenRepository(session, workspace_id),
        NdviRepository(session),
        _coordinator(session, background_tasks),
        get_storage(),
    )


async def get_plan_repository(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    workspace_id: Annotated[uuid.UUID, Depends(get_workspace_id)],
) -> PlanRepository:
    return PlanRepository(session, workspace_id)


async def get_planning_service(
    repo: Annotated[PlanRepository, Depends(get_plan_repository)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    workspace_id: Annotated[uuid.UUID, Depends(get_workspace_id)],
) -> PlanningService:
    return PlanningService(repo, GardenRepository(session, workspace_id))


async def get_product_repository(
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> ProductRepository:
    return ProductRepository(session)
