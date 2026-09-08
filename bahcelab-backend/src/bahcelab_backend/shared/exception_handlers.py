from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from bahcelab_backend.shared.errors import AppError, AppErrorCode


def app_error_handler(_request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail},
    )


def validation_error_handler(
    _request: Request, exc: RequestValidationError
) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": AppErrorCode.VALIDATION_ERROR,
                "message": "Request validation failed",
                "details": {"errors": exc.errors()},
            }
        },
    )


def generic_error_handler(_request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": AppErrorCode.INTERNAL_ERROR,
                "message": "An unexpected error occurred",
                "details": {},
            }
        },
    )
