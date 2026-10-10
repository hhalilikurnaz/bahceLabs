import uuid
from datetime import UTC, datetime

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.domain.auth.models import (
    RefreshTokenModel,
    UserModel,
    WorkspaceMemberModel,
    WorkspaceModel,
)


class AuthRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def commit(self) -> None:
        await self.session.commit()

    async def get_user_by_email(self, email: str) -> UserModel | None:
        result = await self.session.execute(select(UserModel).where(UserModel.email == email))
        return result.scalar_one_or_none()

    async def get_user(self, user_id: uuid.UUID) -> UserModel | None:
        result = await self.session.execute(select(UserModel).where(UserModel.id == user_id))
        return result.scalar_one_or_none()

    async def get_workspace_id(self, user_id: uuid.UUID) -> uuid.UUID | None:
        result = await self.session.execute(
            select(WorkspaceMemberModel.workspace_id)
            .where(WorkspaceMemberModel.user_id == user_id)
            .order_by(WorkspaceMemberModel.workspace_id)
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def create_user_with_workspace(
        self, *, name: str, email: str, password_hash: str
    ) -> tuple[UserModel, uuid.UUID] | None:
        """E-posta zaten kayıtlıysa None döner."""
        user = UserModel(name=name, email=email, password_hash=password_hash)
        workspace = WorkspaceModel(name=f"{name} çalışma alanı")
        try:
            async with self.session.begin_nested():
                self.session.add_all([user, workspace])
                await self.session.flush()
                self.session.add(
                    WorkspaceMemberModel(user_id=user.id, workspace_id=workspace.id, role="owner")
                )
                await self.session.flush()
        except IntegrityError:
            return None
        return user, workspace.id

    async def add_refresh_token(
        self, *, user_id: uuid.UUID, token_hash: str, expires_at: datetime
    ) -> None:
        self.session.add(
            RefreshTokenModel(user_id=user_id, token_hash=token_hash, expires_at=expires_at)
        )
        await self.session.flush()

    async def get_refresh_token(self, token_hash: str) -> RefreshTokenModel | None:
        result = await self.session.execute(
            select(RefreshTokenModel).where(RefreshTokenModel.token_hash == token_hash)
        )
        return result.scalar_one_or_none()

    async def revoke_refresh_token(self, token: RefreshTokenModel) -> None:
        token.revoked_at = datetime.now(UTC)
        await self.session.flush()

    async def revoke_all_refresh_tokens(self, user_id: uuid.UUID) -> None:
        await self.session.execute(
            update(RefreshTokenModel)
            .where(RefreshTokenModel.user_id == user_id, RefreshTokenModel.revoked_at.is_(None))
            .values(revoked_at=datetime.now(UTC))
        )
