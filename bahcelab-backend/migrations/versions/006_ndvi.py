"""NDVI gözlemleri ve işleme işleri."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "006_ndvi"
down_revision: Union[str, None] = "005_area_geography"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_NOW = sa.text("now()")


def upgrade() -> None:
    op.create_table(
        "ndvi_observations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "garden_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("gardens.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("tarih", sa.Date, nullable=False),
        sa.Column("scene_id", sa.String(120), nullable=False),
        sa.Column("durum", sa.String(10), nullable=False, server_default="tamam"),
        sa.Column("bulut_orani", sa.Float, nullable=True),
        sa.Column("gecerli_piksel_orani", sa.Float, nullable=False),
        sa.Column("ortalama", sa.Float, nullable=True),
        sa.Column("medyan", sa.Float, nullable=True),
        sa.Column("p10", sa.Float, nullable=True),
        sa.Column("p90", sa.Float, nullable=True),
        sa.Column("min", sa.Float, nullable=True),
        sa.Column("max", sa.Float, nullable=True),
        sa.Column("png_yolu", sa.Text, nullable=True),
        sa.Column("sorunlu_bolge_geojson", postgresql.JSONB, nullable=True),
        sa.Column("goruntu_koordinatlari", postgresql.JSONB, nullable=True),
        sa.Column("kaynak", sa.String(20), nullable=False, server_default="sentinel-2"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_NOW, nullable=False),
        sa.UniqueConstraint("garden_id", "tarih", name="uq_ndvi_garden_tarih"),
        sa.CheckConstraint("durum IN ('tamam', 'bulutlu')", name="ck_ndvi_durum"),
    )
    op.create_index("ix_ndvi_observations_garden_id", "ndvi_observations", ["garden_id"])

    op.create_table(
        "ndvi_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "garden_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("gardens.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("tur", sa.String(15), nullable=False),
        sa.Column("durum", sa.String(12), nullable=False, server_default="bekliyor"),
        sa.Column("toplam", sa.Integer, nullable=False, server_default="0"),
        sa.Column("islenen", sa.Integer, nullable=False, server_default="0"),
        sa.Column("hata_mesaji", sa.Text, nullable=True),
        sa.Column("baslangic", sa.DateTime(timezone=True), nullable=True),
        sa.Column("bitis", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_NOW, nullable=False),
        sa.CheckConstraint(
            "durum IN ('bekliyor', 'isleniyor', 'tamam', 'hata')", name="ck_ndvi_jobs_durum"
        ),
    )
    op.create_index("ix_ndvi_jobs_garden_id", "ndvi_jobs", ["garden_id"])
    op.create_index(
        "ux_ndvi_jobs_active",
        "ndvi_jobs",
        ["garden_id"],
        unique=True,
        postgresql_where=sa.text("durum IN ('bekliyor', 'isleniyor')"),
    )


def downgrade() -> None:
    op.drop_index("ux_ndvi_jobs_active", table_name="ndvi_jobs")
    op.drop_index("ix_ndvi_jobs_garden_id", table_name="ndvi_jobs")
    op.drop_table("ndvi_jobs")
    op.drop_index("ix_ndvi_observations_garden_id", table_name="ndvi_observations")
    op.drop_table("ndvi_observations")
