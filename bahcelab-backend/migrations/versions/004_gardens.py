"""Gardens: PostGIS poligonlu bahçe kayıtları."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from geoalchemy2 import Geometry
from sqlalchemy.dialects import postgresql

revision: str = "004_gardens"
down_revision: Union[str, None] = "003_users_workspaces"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "gardens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "workspace_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("ad", sa.String(120), nullable=False),
        sa.Column("urun", sa.String(20), nullable=False, server_default="limon"),
        sa.Column("cesit", sa.String(100), nullable=True),
        sa.Column("dikim_yili", sa.SmallInteger, nullable=True),
        sa.Column(
            "geom",
            Geometry(geometry_type="GEOMETRY", srid=4326, spatial_index=False),
            nullable=False,
        ),
        sa.Column("alan_dekar", sa.Numeric(12, 3), nullable=False),
        sa.Column("il", sa.String(100), nullable=True),
        sa.Column("ilce", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "urun IN ('limon', 'portakal', 'mandalina', 'greyfurt', 'diger')",
            name="ck_gardens_urun",
        ),
        sa.CheckConstraint(
            "GeometryType(geom) IN ('POLYGON', 'MULTIPOLYGON')",
            name="ck_gardens_geom_type",
        ),
    )
    op.create_index("ix_gardens_workspace_id", "gardens", ["workspace_id"])
    op.create_index("ix_gardens_geom", "gardens", ["geom"], postgresql_using="gist")


def downgrade() -> None:
    op.drop_index("ix_gardens_geom", table_name="gardens")
    op.drop_index("ix_gardens_workspace_id", table_name="gardens")
    op.drop_table("gardens")
