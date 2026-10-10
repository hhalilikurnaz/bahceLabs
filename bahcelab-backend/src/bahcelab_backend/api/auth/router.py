from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, Response, status

from bahcelab_backend.api.auth.cookies import (
    REFRESH_COOKIE,
    clear_auth_cookies,
    set_auth_cookies,
)
from bahcelab_backend.api.deps import get_auth_service, get_current_user
from bahcelab_backend.domain.auth.schemas import AuthUser, LoginRequest, RegisterRequest
from bahcelab_backend.domain.auth.service import AuthService, IssuedSession

router = APIRouter(prefix="/auth", tags=["auth"])


def _respond(response: Response, issued: IssuedSession) -> AuthUser:
    set_auth_cookies(
        response, access_token=issued.access_token, refresh_token=issued.refresh_token
    )
    return issued.user


@router.post("/register", response_model=AuthUser, status_code=status.HTTP_201_CREATED)
async def register(
    request: RegisterRequest,
    response: Response,
    service: Annotated[AuthService, Depends(get_auth_service)],
) -> AuthUser:
    return _respond(response, await service.register(request))


@router.post("/login", response_model=AuthUser)
async def login(
    request: LoginRequest,
    response: Response,
    service: Annotated[AuthService, Depends(get_auth_service)],
) -> AuthUser:
    return _respond(response, await service.login(request))


@router.post("/refresh", response_model=AuthUser)
async def refresh(
    response: Response,
    service: Annotated[AuthService, Depends(get_auth_service)],
    refresh_token: Annotated[str | None, Cookie(alias=REFRESH_COOKIE)] = None,
) -> AuthUser:
    return _respond(response, await service.refresh(refresh_token))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    service: Annotated[AuthService, Depends(get_auth_service)],
    refresh_token: Annotated[str | None, Cookie(alias=REFRESH_COOKIE)] = None,
) -> None:
    await service.logout(refresh_token)
    clear_auth_cookies(response)


@router.get("/me", response_model=AuthUser)
async def me(user: Annotated[AuthUser, Depends(get_current_user)]) -> AuthUser:
    return user

