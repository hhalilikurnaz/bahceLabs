"""Hava durumu: ızgara hücreleri ve günlük geçmiş."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "008_weather"
down_revision: Union[str, None] = "007_multi_index"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "weather_cells",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("enlem", sa.Float, nullable=False),
        sa.Column("boylam", sa.Float, nullable=False),
        sa.Column("tahmin", postgresql.JSONB, nullable=True),
        sa.Column("tahmin_zamani", sa.DateTime(timezone=True), nullable=True),
        sa.Column("tahmin_kaynak", sa.String(20), nullable=True),
        sa.Column("gecmis_senkron", sa.Date, nullable=True),
        sa.UniqueConstraint("enlem", "boylam", name="uq_weather_cell"),
    )
    op.create_table(
        "weather_daily",
        sa.Column(
            "cell_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("weather_cells.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("tarih", sa.Date, primary_key=True),
        sa.Column("min_sicaklik", sa.Float, nullable=True),
        sa.Column("max_sicaklik", sa.Float, nullable=True),
        sa.Column("yagis_mm", sa.Float, nullable=True),
        sa.Column("et0_mm", sa.Float, nullable=True),
        sa.Column("kaynak", sa.String(10), nullable=False, server_default="arsiv"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("weather_daily")
    op.drop_table("weather_cells")
