"""Çok yıllık: yıl veri yeterliliği (net sahne tarihleri, yetersiz veri işareti)."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "015_multiyear_sufficiency"
down_revision: Union[str, None] = "014_multiyear"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("multiyear_years", sa.Column("sahne_tarihleri", JSONB(), nullable=True))
    op.add_column("multiyear_years", sa.Column("yetersiz_veri", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    op.drop_column("multiyear_years", "yetersiz_veri")
    op.drop_column("multiyear_years", "sahne_tarihleri")
