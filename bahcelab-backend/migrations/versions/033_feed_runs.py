"""Arka plan veri çekimi işlerinin durumu (devam et / düşerse görünür ol): bahçe × kaynak başına tek satır."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "033_feed_runs"
down_revision: Union[str, None] = "032_field_book"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "feed_runs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("garden_id", UUID(as_uuid=True), sa.ForeignKey("gardens.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kaynak", sa.String(8), nullable=False),
        sa.Column("durum", sa.String(10), nullable=False),
        sa.Column("deneme", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("baslangic", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("kalp_atisi", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("bitis", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ilerleme", JSONB, nullable=True),
        sa.Column("hata", sa.Text(), nullable=True),
        sa.UniqueConstraint("garden_id", "kaynak", name="uq_feed_run"),
        sa.CheckConstraint("kaynak IN ('era5','hls','imerg','smap')", name="ck_feed_run_kaynak"),
        sa.CheckConstraint("durum IN ('calisiyor','tamam','hata','kesildi','atlandi')", name="ck_feed_run_durum"),
    )
    op.create_index("ix_feed_runs_garden_id", "feed_runs", ["garden_id"])


def downgrade() -> None:
    op.drop_table("feed_runs")
