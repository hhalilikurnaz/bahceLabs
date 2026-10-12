"""Veri temeli: data_sources, acquisitions, acquisition_stats, backfill_months, normal_bands (ADR 0015)."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "022_acquisitions"
down_revision: Union[str, None] = "021_risk_notification_single"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "data_sources",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("ad", sa.String(80), nullable=False),
        sa.Column("cozunurluk_m", sa.Float(), nullable=False),
        sa.Column("tekrar_gun", sa.Integer(), nullable=False),
        sa.Column("durum", sa.String(10), nullable=False),
        sa.Column("aciklama", sa.Text(), nullable=True),
    )
    op.execute(
        """
        INSERT INTO data_sources (id, ad, cozunurluk_m, tekrar_gun, durum, aciklama) VALUES
        ('sentinel2-l2a', 'Sentinel-2 L2A', 10, 5, 'aktif', 'Optik: canlılık, klorofil, yaprak suyu, yaprak alanı. Arşiv 13 Ağu 2015''te başlar.'),
        ('sentinel1-grd', 'Sentinel-1 radar', 10, 6, 'planli', 'Radar değişimi (Adım 9D).'),
        ('landsat-lst', 'Landsat yüzey sıcaklığı', 30, 8, 'planli', 'Su stresi için yüzey sıcaklığı (Adım 9E).'),
        ('era5-land', 'ERA5-Land toprak nemi', 9000, 1, 'planli', 'Toprak nemi ve hava (Adım 9E).')
        """
    )
    op.create_table(
        "acquisitions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("garden_id", UUID(as_uuid=True), sa.ForeignKey("gardens.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("source_id", sa.String(40), sa.ForeignKey("data_sources.id"), nullable=False),
        sa.Column("scene_id", sa.String(120), nullable=False),
        sa.Column("tarih", sa.Date(), nullable=False, index=True),
        sa.Column("bulut_orani", sa.Float(), nullable=True),
        sa.Column("durum", sa.String(10), nullable=False),
        sa.Column("hata_mesaji", sa.Text(), nullable=True),
        sa.Column("gecerli_oran", sa.Float(), nullable=True),
        sa.Column("gecikme_gun", sa.Integer(), nullable=True),
        sa.Column("isleme_surumu", sa.String(10), nullable=True),
        sa.Column("formul_surumu", sa.String(40), nullable=True),
        sa.Column("izgara_yolu", sa.Text(), nullable=True),
        sa.Column("izgara_boyut_bayt", sa.BigInteger(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("garden_id", "source_id", "scene_id", name="uq_acquisition_scene"),
    )
    op.create_table(
        "acquisition_stats",
        sa.Column("acquisition_id", UUID(as_uuid=True), sa.ForeignKey("acquisitions.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("indeks", sa.String(12), primary_key=True),
        *[sa.Column(n, sa.Float(), nullable=False) for n in ("ortalama", "medyan", "p10", "p25", "p75", "p90", "minimum", "maksimum")],
        sa.Column("gecerli_piksel", sa.Integer(), nullable=False),
    )
    op.create_table(
        "backfill_months",
        sa.Column("garden_id", UUID(as_uuid=True), sa.ForeignKey("gardens.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("source_id", sa.String(40), sa.ForeignKey("data_sources.id"), primary_key=True),
        sa.Column("ay", sa.Date(), primary_key=True),
        sa.Column("durum", sa.String(10), nullable=False, server_default="bekliyor"),
        sa.Column("net_sahne", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("aday_sayisi", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("hata_mesaji", sa.Text(), nullable=True),
        sa.Column("sure_saniye", sa.Float(), nullable=True),
        sa.Column("guncelleme", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("geometry_hash", sa.String(40), nullable=True),
    )
    op.create_table(
        "normal_bands",
        sa.Column("garden_id", UUID(as_uuid=True), sa.ForeignKey("gardens.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("source_id", sa.String(40), sa.ForeignKey("data_sources.id"), primary_key=True),
        sa.Column("indeks", sa.String(12), primary_key=True),
        sa.Column("ay", sa.Integer(), primary_key=True),
        sa.Column("yil_sayisi", sa.Integer(), nullable=False),
        sa.Column("yillar", JSONB(), nullable=False, server_default="[]"),
        *[sa.Column(n, sa.Float(), nullable=True) for n in ("p10", "p25", "p50", "p75", "p90")],
        sa.Column("ceyrek_yeterli", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("onluk_yeterli", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("formul_surumu", sa.String(40), nullable=True),
        sa.Column("hesaplama", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("ayrinti", JSONB(), nullable=True),
    )


def downgrade() -> None:
    for table in ("normal_bands", "backfill_months", "acquisition_stats", "acquisitions", "data_sources"):
        op.drop_table(table)
