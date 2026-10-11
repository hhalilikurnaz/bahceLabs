"""Zamanlanmış işin son risk özeti (liste skoru için)."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "013_risk_snapshots"
down_revision: Union[str, None] = "012_notifications"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "garden_risk_snapshots",
        sa.Column("garden_id", UUID(as_uuid=True), sa.ForeignKey("gardens.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("yuksek_sayisi", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("hesaplama_zamani", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("garden_risk_snapshots")
