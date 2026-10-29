"""Bağımsız dış kanıt: istasyon gözlemleri (yalnız gerçek gözlem satırları) ve feed_runs'a `imerg_gecmis` kaynağı."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "034_station_evidence"
down_revision: Union[str, None] = "033_feed_runs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "stations",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("saglayici", sa.String(16), nullable=False),
        sa.Column("ad", sa.String(120), nullable=False),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lng", sa.Float(), nullable=False),
        sa.Column("yukseklik", sa.Float(), nullable=True),
        sa.Column("gozlem_baslangic", sa.Date(), nullable=True),
        sa.Column("gozlem_bitis", sa.Date(), nullable=True),
        sa.Column("guncellendi", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "station_daily",
        sa.Column("istasyon_id", sa.String(32), sa.ForeignKey("stations.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("tarih", sa.Date(), primary_key=True),
        sa.Column("tmin", sa.Float(), nullable=True),
        sa.Column("prcp", sa.Float(), nullable=True),
    )
    op.drop_constraint("ck_feed_run_kaynak", "feed_runs", type_="check")
    op.alter_column("feed_runs", "kaynak", type_=sa.String(12))
    op.create_check_constraint("ck_feed_run_kaynak", "feed_runs", "kaynak IN ('era5','hls','imerg','smap','imerg_gecmis')")


def downgrade() -> None:
    op.execute("DELETE FROM feed_runs WHERE kaynak = 'imerg_gecmis'")
    op.drop_constraint("ck_feed_run_kaynak", "feed_runs", type_="check")
    op.create_check_constraint("ck_feed_run_kaynak", "feed_runs", "kaynak IN ('era5','hls','imerg','smap')")
    op.drop_table("station_daily")
    op.drop_table("stations")
