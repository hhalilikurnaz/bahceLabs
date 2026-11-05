"""Sulama ağı: pompa noktası, ana boru çizgisi, ağaç sırası yönü; vana programına elle eklenenler."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from geoalchemy2 import Geometry
from sqlalchemy.dialects.postgresql import UUID

revision: str = "038_sulama_agi"
down_revision: Union[str, None] = "037_yagis_olcumu"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "irrigation_network",
        sa.Column("garden_id", UUID(as_uuid=True), sa.ForeignKey("gardens.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("pompa", Geometry(geometry_type="POINT", srid=4326, spatial_index=False), nullable=True),
        sa.Column("ana_boru", Geometry(geometry_type="LINESTRING", srid=4326, spatial_index=False), nullable=True),
        sa.Column("sira_yonu_derece", sa.Float(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "irrigation_extras",
        sa.Column("garden_id", UUID(as_uuid=True), sa.ForeignKey("gardens.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("tarih", sa.Date(), primary_key=True),
        sa.Column("sektor_ad", sa.String(24), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("irrigation_extras")
    op.drop_table("irrigation_network")
