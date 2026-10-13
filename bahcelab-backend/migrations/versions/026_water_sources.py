"""Su ve sıcaklık dilimi (ADR 0017): kaynak kayıtları, ERA5-Land günlük/saatlik, doğrulama gözlemleri, toprak profili."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "026_water_sources"
down_revision: Union[str, None] = "025_change_event_confidence"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("DELETE FROM data_sources WHERE id = 'landsat-lst'")
    op.execute("UPDATE data_sources SET durum = 'aktif', aciklama = 'ERA5-Land (Open-Meteo): 4 katman toprak nemi, ET0, yağış, sıcaklık; saatlik ve günlük. Son günler ve tahmin için model tahmini.' WHERE id = 'era5-land'")
    op.execute(
        """
        INSERT INTO data_sources (id, ad, cozunurluk_m, tekrar_gun, durum, aciklama) VALUES
        ('landsat-c2-l2', 'Landsat 8/9 yüzey sıcaklığı', 30, 8, 'aktif', 'Planetary Computer landsat-c2-l2: ST_B10 (lwir11) → K → °C; ürün 30 m, fiziksel çözünürlük 100 m. Bahçe ve 300 m tampon ayrı saklanır.'),
        ('smap-l3', 'SMAP L3 9 km yüzey nemi', 9000, 2, 'aktif', 'Doğrulama: ERA5-Land yüzey nemiyle karşılaştırma (earthaccess). Arayüzde gösterilmez.'),
        ('imerg-daily', 'GPM IMERG günlük yağış', 10000, 1, 'aktif', 'Doğrulama: ERA5 yağışıyla karşılaştırma ve yağış notu (earthaccess). Arayüzde gösterilmez.'),
        ('chirps-daily', 'CHIRPS günlük yağış (0,05°)', 5000, 1, 'aktif', 'Doğrulama: tarihsel ikincil yağış kaynağı. Arayüzde gösterilmez.')
        """
    )
    op.create_table(
        "era5_daily",
        sa.Column("cell_id", UUID(as_uuid=True), sa.ForeignKey("weather_cells.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("tarih", sa.Date(), primary_key=True),
        *[sa.Column(n, sa.Float(), nullable=True) for n in ("sm0", "sm1", "sm2", "sm3", "et0_mm", "yagis_mm", "t_ort", "t_min", "t_max")],
        sa.Column("saatlik", JSONB(), nullable=True),
        sa.Column("toprak_kaynak", sa.String(12), nullable=False, server_default="era5_land"),
        sa.Column("hava_kaynak", sa.String(12), nullable=False, server_default="era5_land"),
        sa.Column("guncelleme", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "dogrulama_gozlem",
        sa.Column("garden_id", UUID(as_uuid=True), sa.ForeignKey("gardens.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("source_id", sa.String(40), sa.ForeignKey("data_sources.id"), primary_key=True),
        sa.Column("tarih", sa.Date(), primary_key=True),
        sa.Column("indeks", sa.String(16), primary_key=True),
        sa.Column("deger", sa.Float(), nullable=True),
        sa.Column("ayrinti", JSONB(), nullable=True),
        sa.Column("guncelleme", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "soil_profiles",
        sa.Column("garden_id", UUID(as_uuid=True), sa.ForeignKey("gardens.id", ondelete="CASCADE"), primary_key=True),
        *[sa.Column(n, sa.Float(), nullable=True) for n in ("kum_yuzde", "kil_yuzde", "silt_yuzde", "organik_karbon_g_kg", "tarla_kapasitesi", "solma_noktasi")],
        sa.Column("kaynak", sa.String(80), nullable=False),
        sa.Column("ayrinti", JSONB(), nullable=True),
        sa.Column("hesaplama", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("soil_profiles")
    op.drop_table("dogrulama_gozlem")
    op.drop_table("era5_daily")
    op.execute("DELETE FROM data_sources WHERE id IN ('landsat-c2-l2', 'smap-l3', 'imerg-daily', 'chirps-daily')")
