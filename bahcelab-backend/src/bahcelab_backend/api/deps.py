import uuid
from typing import Annotated

from fastapi import Cookie, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.api.auth.cookies import ACCESS_COOKIE
from bahcelab_backend.config import get_settings
from bahcelab_backend.database import async_session_factory, get_db_session
from bahcelab_backend.domain.acquisitions.backfill import (
    BackfillRunner,
    BackfillService,
    MonthQueue,
    month_queue_for,
)
from bahcelab_backend.domain.acquisitions.radar_processor import RadarProvider
from bahcelab_backend.domain.acquisitions.service import DataFoundationService
from bahcelab_backend.domain.agro.repository import AgroRepository
from bahcelab_backend.domain.agro.service import AgroService
from bahcelab_backend.domain.auth.repository import AuthRepository
from bahcelab_backend.domain.auth.schemas import AuthUser
from bahcelab_backend.domain.auth.security import decode_access_token
from bahcelab_backend.domain.auth.service import AuthService
from bahcelab_backend.domain.gardens.repository import GardenRepository
from bahcelab_backend.domain.gardens.service import GardenService
from bahcelab_backend.domain.imagery.provider import ImageryProvider
from bahcelab_backend.domain.imagery.registry import (
    get_imagery_provider,
    get_landsat_provider,
    get_radar_provider,
)
from bahcelab_backend.domain.multiyear.service import MultiyearService
from bahcelab_backend.domain.ndvi.repository import NdviRepository
from bahcelab_backend.domain.ndvi.service import NdviCoordinator, NdviService
from bahcelab_backend.domain.notifications.repository import (
    NotificationRepository,
    RiskSnapshotRepository,
)
from bahcelab_backend.domain.notifications.service import NotificationService
from bahcelab_backend.domain.overview.service import GardenOverviewService
from bahcelab_backend.domain.planning.repository import PlanRepository, ProductRepository
from bahcelab_backend.domain.planning.service import PlanningService
from bahcelab_backend.domain.weather.provider import WeatherProvider, get_provider
from bahcelab_backend.domain.weather.repository import WeatherRepository
from bahcelab_backend.domain.weather.service import WeatherService
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


def _coordinator(session: AsyncSession) -> NdviCoordinator:
    return NdviCoordinator(NdviRepository(session), get_storage())


async def get_garden_service(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    workspace_id: Annotated[uuid.UUID, Depends(get_workspace_id)],
) -> GardenService:
    return GardenService(GardenRepository(session, workspace_id), _coordinator(session))


async def get_ndvi_service(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    workspace_id: Annotated[uuid.UUID, Depends(get_workspace_id)],
) -> NdviService:
    return NdviService(
        GardenRepository(session, workspace_id),
        NdviRepository(session),
        _coordinator(session),
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


def get_weather_provider() -> WeatherProvider:
    return get_provider()


async def get_weather_service(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    workspace_id: Annotated[uuid.UUID, Depends(get_workspace_id)],
    provider: Annotated[WeatherProvider, Depends(get_weather_provider)],
) -> WeatherService:
    return WeatherService(WeatherRepository(session, workspace_id), provider)


async def get_overview_service(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    workspace_id: Annotated[uuid.UUID, Depends(get_workspace_id)],
) -> GardenOverviewService:
    return GardenOverviewService(
        GardenRepository(session, workspace_id), NdviRepository(session), WeatherRepository(session, workspace_id), RiskSnapshotRepository(session)
    )


async def get_agro_service(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    workspace_id: Annotated[uuid.UUID, Depends(get_workspace_id)],
    provider: Annotated[WeatherProvider, Depends(get_weather_provider)],
) -> AgroService:
    return AgroService(
        GardenRepository(session, workspace_id),
        NdviRepository(session),
        WeatherService(WeatherRepository(session, workspace_id), provider),
        AgroRepository(session),
    )


async def get_notification_service(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    workspace_id: Annotated[uuid.UUID, Depends(get_workspace_id)],
) -> NotificationService:
    return NotificationService(NotificationRepository(session, workspace_id))


def get_radar() -> RadarProvider:
    """Radar kaynağı (ADR 0016); testlerde sahte sağlayıcıyla değiştirilir."""
    return get_radar_provider()


def get_imagery() -> ImageryProvider:
    """Uydu kaynağı (ADR 0011); testlerde sahte sağlayıcıyla değiştirilir."""
    return get_imagery_provider()


_ARQ_POOL: object | None = None


async def get_month_queue(provider: Annotated[ImageryProvider, Depends(get_imagery)], radar: Annotated[RadarProvider, Depends(get_radar)]) -> MonthQueue:
    """Ay görevi kuyruğu: `JOB_BACKEND=arq` ise Redis, değilse süreç içi."""
    global _ARQ_POOL
    settings = get_settings()
    runner = BackfillRunner(async_session_factory, provider, get_storage(), settings, radar_provider=radar, landsat_provider=get_landsat_provider())
    if settings.job_backend == "arq":
        if _ARQ_POOL is None:
            from arq import create_pool
            from arq.connections import RedisSettings

            _ARQ_POOL = await create_pool(RedisSettings.from_dsn(settings.redis_url))
        return month_queue_for(runner, _ARQ_POOL)
    return month_queue_for(runner)


async def get_data_foundation_service(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    workspace_id: Annotated[uuid.UUID, Depends(get_workspace_id)],
    provider: Annotated[ImageryProvider, Depends(get_imagery)],
    queue: Annotated[MonthQueue, Depends(get_month_queue)],
    radar: Annotated[RadarProvider, Depends(get_radar)],
) -> DataFoundationService:
    return DataFoundationService(session, workspace_id, BackfillService(session, provider, get_storage(), queue, radar_provider=radar))


async def get_multiyear_service(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    workspace_id: Annotated[uuid.UUID, Depends(get_workspace_id)],
    provider: Annotated[ImageryProvider, Depends(get_imagery)],
    queue: Annotated[MonthQueue, Depends(get_month_queue)],
) -> MultiyearService:
    """Çok yıllık analiz TEK VERİ HATTINDAN okur: geçmiş doldurma (acquisitions) ADR 0015."""
    return MultiyearService(session, workspace_id, provider, get_storage(), BackfillService(session, provider, get_storage(), queue))
