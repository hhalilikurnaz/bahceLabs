import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from bahcelab_backend.config import get_settings
from bahcelab_backend.domain.auth.repository import AuthRepository
from bahcelab_backend.domain.auth.schemas import AuthUser, LoginRequest, RegisterRequest
from bahcelab_backend.domain.auth.security import (
    create_access_token,
    hash_password,
    hash_refresh_token,
    new_refresh_token,
    verify_password,
)
from bahcelab_backend.shared.errors import AppError, AppErrorCode


@dataclass(frozen=True)
class IssuedSession:
    user: AuthUser
    access_token: str
    refresh_token: str


def _unauthorized(message: str = "Oturum geçersiz veya süresi dolmuş") -> AppError:
    return AppError(401, AppErrorCode.UNAUTHORIZED, message)


class AuthService:
    def __init__(self, repo: AuthRepository) -> None:
        self.repo = repo

    async def _issue(self, user_id: uuid.UUID) -> IssuedSession:
        user = await self.repo.get_user(user_id)
        workspace_id = await self.repo.get_workspace_id(user_id)
        if user is None or workspace_id is None:
            raise _unauthorized()

        settings = get_settings()
        refresh = new_refresh_token()
        await self.repo.add_refresh_token(
            user_id=user.id,
            token_hash=hash_refresh_token(refresh),
            expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_days),
        )
        await self.repo.commit()  # yanıt gitmeden kalıcı olsun: istemci hemen ardından çerezle istek atar (yield bağımlılığı yanıttan sonra commit eder)
        return IssuedSession(
            user=AuthUser(id=user.id, name=user.name, email=user.email, workspace_id=workspace_id),
            access_token=create_access_token(user.id),
            refresh_token=refresh,
        )

    async def register(self, request: RegisterRequest) -> IssuedSession:
        if not get_settings().registration_enabled:
            raise AppError(403, AppErrorCode.FORBIDDEN, "Kayıtlar çok yakında sizlerle!")

        created = await self.repo.create_user_with_workspace(
            name=request.name,
            email=request.email,
            password_hash=hash_password(request.password),
        )
        if created is None:
            raise AppError(409, AppErrorCode.CONFLICT, "Bu e-posta ile zaten kayıt var.")
        user, _workspace_id = created
        return await self._issue(user.id)

    async def login(self, request: LoginRequest) -> IssuedSession:
        user = await self.repo.get_user_by_email(request.email)
        valid = verify_password(request.password, user.password_hash if user else None)
        if user is None or not valid:
            raise _unauthorized("E-posta veya şifre hatalı.")
        return await self._issue(user.id)

    async def refresh(self, refresh_token: str | None) -> IssuedSession:
        if not refresh_token:
            raise _unauthorized()
        stored = await self.repo.get_refresh_token(hash_refresh_token(refresh_token))
        if stored is None:
            raise _unauthorized()
        if stored.revoked_at is not None:
            # Kullanılmış token tekrar geldi: çalınmış olabilir, kullanıcının tüm oturumlarını kapat
            await self.repo.revoke_all_refresh_tokens(stored.user_id)
            await self.repo.commit()  # hata fırlatınca oturum rollback edilir; iptal kalıcı olmalı
            raise _unauthorized()
        if stored.expires_at <= datetime.now(UTC):
            raise _unauthorized()

        await self.repo.revoke_refresh_token(stored)
        return await self._issue(stored.user_id)

    async def logout(self, refresh_token: str | None) -> None:
        if not refresh_token:
            return
        stored = await self.repo.get_refresh_token(hash_refresh_token(refresh_token))
        if stored is not None and stored.revoked_at is None:
            await self.repo.revoke_refresh_token(stored)

    async def get_user(self, user_id: uuid.UUID) -> AuthUser:
        user = await self.repo.get_user(user_id)
        workspace_id = await self.repo.get_workspace_id(user_id)
        if user is None or workspace_id is None:
            raise _unauthorized()
        return AuthUser(id=user.id, name=user.name, email=user.email, workspace_id=workspace_id)
