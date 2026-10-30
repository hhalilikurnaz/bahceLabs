"""Sulama sektörleri (vana), vardiya başlangıcı ve program onayı."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from geoalchemy2 import Geometry
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "036_irrigation_sectors"
down_revision: Union[str, None] = "035_irrigation_profile"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("irrigation_profiles", sa.Column("vardiya_baslangic", sa.String(5), nullable=False, server_default="05:00"))
    op.create_table(
        "irrigation_sectors",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("garden_id", UUID(as_uuid=True), sa.ForeignKey("gardens.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ad", sa.String(24), nullable=False),
        sa.Column("sira", sa.SmallInteger(), nullable=False, server_default="0"),
        sa.Column("geom", Geometry(geometry_type="POLYGON", srid=4326, spatial_index=False), nullable=False),
        sa.Column("alan_m2", sa.Float(), nullable=False),
        sa.Column("agac_sayisi", sa.Integer(), nullable=True),
        sa.Column("sira_aralik_m", sa.Float(), nullable=True),
        sa.Column("agac_aralik_m", sa.Float(), nullable=True),
        sa.Column("vana_debi_m3h", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("garden_id", "ad", name="uq_sektor_ad"),
    )
    op.create_index("ix_irrigation_sectors_garden_id", "irrigation_sectors", ["garden_id"])
    op.execute("CREATE INDEX ix_irrigation_sectors_geom ON irrigation_sectors USING gist (geom)")
    op.create_table(
        "irrigation_approvals",
        sa.Column("garden_id", UUID(as_uuid=True), sa.ForeignKey("gardens.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("tarih", sa.Date(), primary_key=True),
        sa.Column("program", JSONB(), nullable=False),
        sa.Column("onaylayan", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("irrigation_approvals")
    op.drop_table("irrigation_sectors")
    op.drop_column("irrigation_profiles", "vardiya_baslangic")
