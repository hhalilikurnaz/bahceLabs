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
    # Pydantic validator'ları ctx içinde ValueError nesnesi döndürebilir; JSON'a çevrilebilir yap
    errors = [
        {**err, "ctx": {k: str(v) for k, v in err["ctx"].items()}} if "ctx" in err else err
        for err in exc.errors()
    ]
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": AppErrorCode.VALIDATION_ERROR,
                "message": "Request validation failed",
                "details": {"errors": errors},
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
