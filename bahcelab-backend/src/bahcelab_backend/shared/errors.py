from enum import StrEnum
from typing import Any

from fastapi import HTTPException


class AppErrorCode(StrEnum):
    INVALID_GEOMETRY = "INVALID_GEOMETRY"
    NOT_FOUND = "NOT_FOUND"
    FORBIDDEN = "FORBIDDEN"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    CONFLICT = "CONFLICT"
    INTERNAL_ERROR = "INTERNAL_ERROR"


class AppError(HTTPException):
    def __init__(
        self,
        status_code: int,
        code: AppErrorCode,
        message: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        self.code = code
        self.details = details or {}
        super().__init__(
            status_code=status_code,
            detail={"code": code, "message": message, "details": self.details},
        )
