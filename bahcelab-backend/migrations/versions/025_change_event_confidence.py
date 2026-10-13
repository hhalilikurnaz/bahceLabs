"""Radar olay adayı güveni: «ıslaklık olabilir» notlu aday düşük güvenlidir (ADR 0016)."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "025_change_event_confidence"
down_revision: Union[str, None] = "024_change_events"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("change_events", sa.Column("guven", sa.String(10), nullable=False, server_default="normal"))
    op.execute("UPDATE change_events SET guven = 'dusuk' WHERE durum = 'aday' AND islaklik_olabilir IS TRUE")


def downgrade() -> None:
    op.drop_column("change_events", "guven")
