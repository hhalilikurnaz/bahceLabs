"""ADIM 11 · Dilim 1 (ADR 0034): etiketli gözlem ayrıntısı (kategori, etiket, şiddet, yaygınlık, vana, kaynak, GPS doğruluğu)."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "049_gozlem_detay"
down_revision: Union[str, None] = "048_bekleme_listesi"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "gozlem_detay",
        sa.Column("record_id", UUID(as_uuid=True), sa.ForeignKey("field_records.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("kategori", sa.String(20), nullable=False),
        sa.Column("etiket", sa.String(32), nullable=False),
        sa.Column("siddet", sa.String(4), nullable=True),
        sa.Column("yayginlik", sa.String(12), nullable=True),
        sa.Column("sector_id", UUID(as_uuid=True), sa.ForeignKey("irrigation_sectors.id", ondelete="SET NULL"), nullable=True),
        sa.Column("kaynak", sa.String(10), nullable=False, server_default="kullanici"),
        sa.Column("iliski_anahtar", sa.String(80), nullable=True),
        sa.Column("konum_dogruluk_m", sa.Float(), nullable=True),
        sa.CheckConstraint("kaynak IN ('kullanici','sistem')", name="ck_gozlem_detay_kaynak"),
    )
    op.create_index("ix_gozlem_detay_kategori", "gozlem_detay", ["kategori"])


def downgrade() -> None:
    op.drop_index("ix_gozlem_detay_kategori", table_name="gozlem_detay")
    op.drop_table("gozlem_detay")
