"""Bahçe sulama profili (sulama planı sihirbazı)."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "035_irrigation_profile"
down_revision: Union[str, None] = "034_station_evidence"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "irrigation_profiles",
        sa.Column("garden_id", UUID(as_uuid=True), sa.ForeignKey("gardens.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("sistem", sa.String(16), nullable=False),
        sa.Column("damlatici_sayisi", sa.SmallInteger(), nullable=True),
        sa.Column("damlatici_debi_lh", sa.Float(), nullable=True),
        sa.Column("sira_aralik_m", sa.Float(), nullable=True),
        sa.Column("agac_aralik_m", sa.Float(), nullable=True),
        sa.Column("pompa_kw", sa.Float(), nullable=True),
        sa.Column("pompa_debi_m3h", sa.Float(), nullable=True),
        sa.Column("enerji", sa.String(8), nullable=False, server_default="sebeke"),
        sa.Column("kwh_fiyat_tl", sa.Float(), nullable=True),
        sa.Column("enerji_m3_maliyet_tl", sa.Float(), nullable=True),
        sa.Column("su_ucreti_m3_tl", sa.Float(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("sistem IN ('damla','mini_yagmurlama','salma')", name="ck_irr_sistem"),
        sa.CheckConstraint("enerji IN ('sebeke','gunes','dizel')", name="ck_irr_enerji"),
    )


def downgrade() -> None:
    op.drop_table("irrigation_profiles")
