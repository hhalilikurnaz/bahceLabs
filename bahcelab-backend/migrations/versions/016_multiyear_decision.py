"""Çok yıllık: uyumsuz yıl kararı (korumalı işaret ve karar zamanı)."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "016_multiyear_decision"
down_revision: Union[str, None] = "015_multiyear_sufficiency"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("multiyear_years", sa.Column("korumali", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("multiyear_years", sa.Column("karar_zamani", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("multiyear_years", "karar_zamani")
    op.drop_column("multiyear_years", "korumali")
