"""HLS NDVI gözlemleri (ADR 0018): kesintisiz canlılık eğrisi için bahçe başına sahne özeti (ızgara saklanmaz)."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "031_hls_observations"
down_revision: Union[str, None] = "030_notification_decision"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO data_sources (id, ad, cozunurluk_m, tekrar_gun, durum, aciklama) VALUES
        ('hls-s30', 'HLS Sentinel-2 (uyumlaştırılmış, 30 m)', 30, 3, 'aktif', 'Planetary Computer hls2-s30 (2020→): NDVI bahçe ortancası; kesintisiz canlılık eğrisinde gözlem olarak kullanılır.'),
        ('hls-l30', 'HLS Landsat (uyumlaştırılmış, 30 m)', 30, 8, 'aktif', 'Planetary Computer hls2-l30 (2020→): NDVI bahçe ortancası; kesintisiz canlılık eğrisinde gözlem olarak kullanılır.')
        """
    )
    op.create_table(
        "hls_observations",
        sa.Column("garden_id", UUID(as_uuid=True), sa.ForeignKey("gardens.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("scene_id", sa.String(80), primary_key=True),
        sa.Column("source_id", sa.String(20), sa.ForeignKey("data_sources.id"), nullable=False),
        sa.Column("tarih", sa.Date(), nullable=False),
        sa.Column("ndvi", sa.Float(), nullable=True),  # geçerli piksel yoksa boş (yeniden okunmasın diye satır yine yazılır)
        sa.Column("gecerli_oran", sa.Float(), nullable=False),
        sa.Column("gecerli_piksel", sa.Integer(), nullable=False),
        sa.Column("toplam_piksel", sa.Integer(), nullable=False),
        sa.Column("bulut_orani", sa.Float(), nullable=True),
        sa.Column("hesaplama", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_hls_obs_garden_date", "hls_observations", ["garden_id", "tarih"])


def downgrade() -> None:
    op.drop_index("ix_hls_obs_garden_date", table_name="hls_observations")
    op.drop_table("hls_observations")
    op.execute("DELETE FROM data_sources WHERE id IN ('hls-s30', 'hls-l30')")
