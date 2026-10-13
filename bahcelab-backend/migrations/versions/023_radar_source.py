"""Sentinel-1 radar kaynağı (ADR 0016): etkin kaynak kaydı, edinimde yörünge/yön/maske alanları, bahçe başına yörünge özeti."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "023_radar_source"
down_revision: Union[str, None] = "022_acquisitions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("DELETE FROM data_sources WHERE id = 'sentinel1-grd'")
    op.execute(
        """
        INSERT INTO data_sources (id, ad, cozunurluk_m, tekrar_gun, durum, aciklama) VALUES
        ('sentinel1-rtc', 'Sentinel-1 radar (RTC γ⁰)', 10, 6, 'aktif',
         'Radar: VH/VV yansıma gücü, bulut geçirmez. Planetary Computer sentinel-1-rtc; yalnız aynı yörünge ve geçiş yönü içinde karşılaştırılır.')
        """
    )
    op.add_column("acquisitions", sa.Column("yorunge", sa.Integer(), nullable=True))
    op.add_column("acquisitions", sa.Column("gecis_yonu", sa.String(10), nullable=True))
    op.add_column("acquisitions", sa.Column("maskeli_oran", sa.Float(), nullable=True))
    op.create_table(
        "radar_orbits",
        sa.Column("garden_id", UUID(as_uuid=True), sa.ForeignKey("gardens.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("yorunge", sa.Integer(), primary_key=True),
        sa.Column("gecis_yonu", sa.String(10), primary_key=True),
        sa.Column("sahne_sayisi", sa.Integer(), nullable=False),
        sa.Column("birincil", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("guncelleme", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("radar_orbits")
    op.drop_column("acquisitions", "maskeli_oran")
    op.drop_column("acquisitions", "gecis_yonu")
    op.drop_column("acquisitions", "yorunge")
    op.execute("DELETE FROM data_sources WHERE id = 'sentinel1-rtc'")
