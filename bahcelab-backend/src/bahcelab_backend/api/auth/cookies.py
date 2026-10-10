from fastapi import Response

from bahcelab_backend.config import get_settings

ACCESS_COOKIE = "bahcelab_access"
REFRESH_COOKIE = "bahcelab_refresh"


def _common() -> dict:
    settings = get_settings()
    return {
        "httponly": True,
        "secure": settings.cookie_secure,
        "samesite": settings.cookie_samesite,
        "domain": settings.cookie_domain,
        "path": "/",
    }


def set_auth_cookies(response: Response, *, access_token: str, refresh_token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        ACCESS_COOKIE, access_token, max_age=settings.access_token_minutes * 60, **_common()
    )
    response.set_cookie(
        REFRESH_COOKIE, refresh_token, max_age=settings.refresh_token_days * 86400, **_common()
    )


def clear_auth_cookies(response: Response) -> None:
    common = _common()
    response.delete_cookie(ACCESS_COOKIE, **common)
    response.delete_cookie(REFRESH_COOKIE, **common)
