"""ADIM 10B · Dilim 1 (ADR 0033): «sebep buydu» etiketleri (ileride model eğitimi için AYRI tablo; eğitimde kullanım açık rızaya bağlı, rıza metni Adım 19–20)."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "047_sebep_etiket"
down_revision: str | None = "046_don_uyari_tercih"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "sebep_etiket",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "garden_id",
            UUID(as_uuid=True),
            sa.ForeignKey("gardens.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "olay_anahtar", sa.String(80), nullable=False
        ),  # events.anahtar (olay motoru olayları yeniden kurabilir; anahtar kararlıdır)
        sa.Column(
            "sebep", sa.String(20), nullable=False
        ),  # su | don | besin | hastalik_zararli | budama_hasat | bilmiyorum
        sa.Column(
            "model_secim", sa.String(10), nullable=True
        ),  # yanıt anında motorun seçimi (null = belirsiz)
        sa.Column("model_guven", sa.String(12), nullable=True),
        sa.Column("model_surum", sa.String(24), nullable=False),
        sa.Column(
            "model_siralama", JSONB(), nullable=False
        ),  # [{sebep, puan}] — yanıt anındaki sıra
        sa.Column(
            "egitim_riza", sa.Boolean(), nullable=False, server_default=sa.false()
        ),  # eğitimde kullanım için AÇIK rıza (varsayılan yok; rıza metni Adım 19–20)
        sa.Column("egitim_riza_tarihi", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.UniqueConstraint("garden_id", "olay_anahtar", name="uq_sebep_etiket"),
        sa.CheckConstraint(
            "sebep IN ('su','don','besin','hastalik_zararli','budama_hasat','bilmiyorum')",
            name="ck_sebep_etiket_sebep",
        ),
        sa.CheckConstraint(
            "(egitim_riza = false) OR (egitim_riza_tarihi IS NOT NULL)",
            name="ck_sebep_etiket_riza_tarih",
        ),
    )
    op.create_index("ix_sebep_etiket_garden", "sebep_etiket", ["garden_id"])


def downgrade() -> None:
    op.drop_index("ix_sebep_etiket_garden", table_name="sebep_etiket")
    op.drop_table("sebep_etiket")
