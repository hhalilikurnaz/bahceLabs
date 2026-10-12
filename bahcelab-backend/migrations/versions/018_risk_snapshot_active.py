"""Risk özeti: aktif (orta ve yüksek) zararlı/hastalık riskleri adlarıyla."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "018_risk_snapshot_active"
down_revision: Union[str, None] = "017_notification_lifecycle"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("garden_risk_snapshots", sa.Column("aktif", JSONB(), nullable=False, server_default="[]"))


def downgrade() -> None:
    op.drop_column("garden_risk_snapshots", "aktif")
