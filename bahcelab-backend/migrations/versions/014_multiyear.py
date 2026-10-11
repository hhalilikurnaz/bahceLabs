"""Çok yıllık analiz: çalıştırma, yıl ilerleme tablosu, sürümlü sonuçlar ve PostGIS bölge çokgenleri."""

from typing import Sequence, Union

import geoalchemy2
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "014_multiyear"
down_revision: Union[str, None] = "013_risk_snapshots"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "multiyear_runs",
        sa.Column("garden_id", UUID(as_uuid=True), sa.ForeignKey("gardens.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("provider", sa.String(40), nullable=False),
        sa.Column("arsiv_baslangic", sa.Date(), nullable=True),
        sa.Column("baslangic_yili", sa.Integer(), nullable=False),
        sa.Column("bitis_yili", sa.Integer(), nullable=False),
        sa.Column("pencere", sa.String(40), nullable=False),
        sa.Column("geometry_hash", sa.String(40), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "multiyear_years",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("garden_id", UUID(as_uuid=True), sa.ForeignKey("gardens.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("yil", sa.Integer(), nullable=False),
        sa.Column("durum", sa.String(12), nullable=False, server_default="bekliyor"),
        sa.Column("sahne_sayisi", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("aday_sayisi", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("kismi", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("hata_mesaji", sa.Text(), nullable=True),
        sa.Column("kompozit_yolu", sa.Text(), nullable=True),
        sa.Column("baslangic", sa.DateTime(timezone=True), nullable=True),
        sa.Column("bitis", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sure_saniye", sa.Float(), nullable=True),
        sa.Column("dahil_elle", sa.Boolean(), nullable=True),
        sa.Column("uyumsuz", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("korelasyon", sa.Float(), nullable=True),
        sa.Column("uyumsuz_nedeni", sa.Text(), nullable=True),
        sa.Column("kapsam", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("garden_id", "yil", name="uq_multiyear_garden_yil"),
    )
    op.create_table(
        "multiyear_results",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("garden_id", UUID(as_uuid=True), sa.ForeignKey("gardens.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("bolge_sayisi", sa.Integer(), nullable=False),
        sa.Column("versiyon", sa.Integer(), nullable=False),
        sa.Column("durum", sa.String(12), nullable=False),
        sa.Column("mesaj", sa.Text(), nullable=True),
        sa.Column("yillar", JSONB(), nullable=False, server_default="[]"),
        sa.Column("homojen", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("yayilim_yuzde", sa.Float(), nullable=True),
        sa.Column("bahce_ortalamasi", sa.Float(), nullable=True),
        sa.Column("parametreler", JSONB(), nullable=False, server_default="{}"),
        sa.Column("aktif", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("garden_id", "bolge_sayisi", "versiyon", name="uq_multiyear_result_version"),
    )
    op.create_table(
        "multiyear_zones",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("result_id", UUID(as_uuid=True), sa.ForeignKey("multiyear_results.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("tur", sa.String(10), nullable=False),
        sa.Column("sinif", sa.Integer(), nullable=False),
        sa.Column("alan_m2", sa.Float(), nullable=False),
        sa.Column("pay", sa.Float(), nullable=False),
        sa.Column("fark_yuzde", sa.Float(), nullable=True),
        sa.Column("istikrar", sa.Float(), nullable=True),
        sa.Column("ortalama", sa.Float(), nullable=True),
        sa.Column("geom", geoalchemy2.Geometry(geometry_type="MULTIPOLYGON", srid=4326, spatial_index=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("multiyear_zones")
    op.drop_table("multiyear_results")
    op.drop_table("multiyear_years")
    op.drop_table("multiyear_runs")
