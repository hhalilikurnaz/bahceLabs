"""Bildirim merkezi (bildirimler + tercihler) ve bahçeye isteğe bağlı sulama sistemi."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "012_notifications"
down_revision: Union[str, None] = "011_agro_catalog"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("gardens", sa.Column("sulama_sistemi", sa.String(20), nullable=True))
    op.create_table(
        "notifications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("workspace_id", UUID(as_uuid=True), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("garden_id", UUID(as_uuid=True), sa.ForeignKey("gardens.id", ondelete="CASCADE"), nullable=True, index=True),
        sa.Column("tur", sa.String(30), nullable=False),
        sa.Column("oncelik", sa.String(10), nullable=False),
        sa.Column("baslik", sa.String(200), nullable=False),
        sa.Column("metin", sa.Text(), nullable=False),
        sa.Column("baglanti", sa.String(200), nullable=False),
        sa.Column("okundu", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("okundu_zamani", sa.DateTime(timezone=True), nullable=True),
        sa.Column("dedupe_key", sa.String(200), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("workspace_id", "dedupe_key", name="uq_notification_dedupe"),
    )
    op.create_index("ix_notifications_unread", "notifications", ["workspace_id", "okundu", "created_at"])
    op.create_table(
        "notification_preferences",
        sa.Column("workspace_id", UUID(as_uuid=True), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("tur", sa.String(30), primary_key=True),
        sa.Column("acik", sa.Boolean(), nullable=False, server_default=sa.true()),
    )


def downgrade() -> None:
    op.drop_table("notification_preferences")
    op.drop_index("ix_notifications_unread", table_name="notifications")
    op.drop_table("notifications")
    op.drop_column("gardens", "sulama_sistemi")
