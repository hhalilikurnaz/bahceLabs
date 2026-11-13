"""9J Dilim 1: veri ve model kalitesi izleme — akış durum anlık görüntüleri, veri bayrakları, kaynaklar arası uyum serisi."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "042_izleme"
down_revision: Union[str, None] = "041_sk_halka"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "izleme_akis",
        sa.Column("tarih", sa.Date(), nullable=False),
        sa.Column("akis", sa.String(32), nullable=False),
        sa.Column("durum", sa.String(10), nullable=False),  # taze | gecikmeli | kopuk | bos
        sa.Column("son_veri", sa.Date(), nullable=True),
        sa.Column("gecikme_gun", sa.Float(), nullable=True),
        sa.Column("bosluk_gun", sa.Integer(), nullable=True),
        sa.Column("son_basari", sa.DateTime(timezone=True), nullable=True),
        sa.Column("neden", sa.Text(), nullable=False, server_default=""),
        sa.PrimaryKeyConstraint("tarih", "akis"),
    )
    op.create_table(
        "veri_bayrak",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("kaynak", sa.String(32), nullable=False),  # era5 | station | imerg | smap | acquisition | wapor | ...
        sa.Column("anahtar", sa.String(64), nullable=False),  # hücre / istasyon / bahçe kimliği
        sa.Column("tarih", sa.Date(), nullable=False),
        sa.Column("degisken", sa.String(24), nullable=False),
        sa.Column("deger", sa.Float(), nullable=True),
        sa.Column("kural", sa.String(24), nullable=False),  # aralik | sicrama | tekrar | birim | eksik_gun
        sa.Column("siddet", sa.String(8), nullable=False),  # sert (imkânsız) | yumusak (şüpheli)
        sa.Column("ayrinti", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("kaynak", "anahtar", "tarih", "degisken", "kural", name="uq_veri_bayrak"),
    )
    op.create_index("ix_veri_bayrak_tarih", "veri_bayrak", ["tarih"])
    op.create_table(
        "izleme_uyum",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tarih", sa.Date(), nullable=False),  # hesaplandığı gün (haftalık iş)
        sa.Column("kontrol", sa.String(32), nullable=False),  # era5_meteostat_tmax | era5_imerg_aylik | olcer_era5 | etc_wapor
        sa.Column("garden_id", UUID(as_uuid=True), sa.ForeignKey("gardens.id", ondelete="CASCADE"), nullable=True),
        sa.Column("deger", sa.Float(), nullable=True),  # güncel pencere (örn. son 90 gün sapması)
        sa.Column("taban", sa.Float(), nullable=True),  # geçmiş referans (örn. 1A taban sapması / geçmiş medyan)
        sa.Column("sapma", sa.Float(), nullable=True),  # deger − taban (ya da göreli)
        sa.Column("esik", sa.Float(), nullable=False),
        sa.Column("n", sa.Integer(), nullable=False),
        sa.Column("durum", sa.String(12), nullable=False),  # uyumlu | drift | yetersiz
        sa.Column("ayrinti", JSONB(), nullable=True),
        sa.UniqueConstraint("tarih", "kontrol", "garden_id", name="uq_izleme_uyum"),
    )


def downgrade() -> None:
    op.drop_table("izleme_uyum")
    op.drop_table("veri_bayrak")
    op.drop_table("izleme_akis")
