from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from bahcelab_backend.api.planning.router import router as planning_router
from bahcelab_backend.config import get_settings
from bahcelab_backend.shared.errors import AppError
from bahcelab_backend.shared.exception_handlers import (
    app_error_handler,
    generic_error_handler,
    validation_error_handler,
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield


def create_app() -> FastAPI:
    settings = get_settings()

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

    app.include_router(planning_router)

    @app.get("/health", tags=["system"])
    async def health_check() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
