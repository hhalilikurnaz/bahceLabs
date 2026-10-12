"""Çok yıllık: yıl kararına isteğe bağlı olay notu."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "020_year_decision_note"
down_revision: Union[str, None] = "019_merge_multiyear_notes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("multiyear_years", sa.Column("karar_notu", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("multiyear_years", "karar_notu")
