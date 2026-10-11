"""Bahçeye isteğe bağlı ağaç sayısı."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "010_tree_count"
down_revision: Union[str, None] = "009_remove_sample"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("gardens", sa.Column("agac_sayisi", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("gardens", "agac_sayisi")
