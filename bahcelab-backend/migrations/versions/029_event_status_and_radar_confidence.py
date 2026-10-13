"""Radar güven adı «normal» → «orta» (olay birleştirmede radar tek başına orta güvendir) ve `events.durum` (olay | suphe): atmosfer şüphesi olay değildir (ADR 0018)."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "029_event_status"
down_revision: Union[str, None] = "028_events"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE change_events SET guven = 'orta' WHERE guven = 'normal'")
    op.alter_column("change_events", "guven", server_default="orta")
    op.add_column("events", sa.Column("durum", sa.String(10), nullable=False, server_default="olay"))  # olay | suphe


def downgrade() -> None:
    op.drop_column("events", "durum")
    op.alter_column("change_events", "guven", server_default=None)
    op.execute("UPDATE change_events SET guven = 'normal' WHERE guven = 'orta'")
