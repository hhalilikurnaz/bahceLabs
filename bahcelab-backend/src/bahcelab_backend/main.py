import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from bahcelab_backend.api.auth.router import router as auth_router
from bahcelab_backend.api.gardens.router import router as gardens_router
from bahcelab_backend.api.ndvi.router import definitions_router
from bahcelab_backend.api.ndvi.router import router as ndvi_router
from bahcelab_backend.api.planning.router import router as planning_router
from bahcelab_backend.api.weather.router import router as weather_router
from bahcelab_backend.config import get_settings
from bahcelab_backend.domain.ndvi.runner import fail_stale_jobs
from bahcelab_backend.shared.errors import AppError
from bahcelab_backend.shared.exception_handlers import (
    app_error_handler,
    generic_error_handler,
    validation_error_handler,
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if get_settings().ndvi_enabled:
        try:
            # Önceki süreçte yarıda kalan NDVI işleri hata olarak işaretlenir (yeniden başlatılabilir)
            await fail_stale_jobs()
        except Exception:  # noqa: BLE001 - veritabanı hazır değilse API yine açılır
            logging.getLogger(__name__).warning(
                "Yarım kalan NDVI işleri temizlenemedi", exc_info=True
            )
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    if settings.uses_default_jwt_secret and not settings.api_debug:
        raise RuntimeError("JWT_SECRET ayarlanmadan API_DEBUG=false ile başlatılamaz")

    app = FastAPI(
        title="BahçeLab Planning API",
        description="Planning & Simulation backend for BahçeLab",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(Exception, generic_error_handler)

    app.include_router(auth_router)
    app.include_router(gardens_router)
    app.include_router(ndvi_router)
    app.include_router(definitions_router)
    app.include_router(planning_router)
    app.include_router(weather_router)

    @app.get("/health", tags=["system"])
    async def health_check() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
