"""ADIM 10 · Dilim 1 (ADR 0031): bahçe topografya profili, gece don riski, don geri bildirimi, olay yeniden değerlendirme işareti."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "045_don"
down_revision: Union[str, None] = "044_bahce_zaman_dilimi"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "bahce_topografya",
        sa.Column("garden_id", UUID(as_uuid=True), sa.ForeignKey("gardens.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("geom_hash", sa.String(40), nullable=False),  # bahçe geometrisi + kural sürümü: değişince yeniden hesaplanır
        sa.Column("kaynak", sa.Text(), nullable=False),
        sa.Column("profil", JSONB(), nullable=False),  # yükseklik, eğim, bakı, TPI 300/1000, akış birikimi, çanak, SVF (betimleyici; °C yok)
        sa.Column("bahce_ici", JSONB(), nullable=False),  # rölyef, eğim, uygun?, neden, göreli soğuk hücreler (yalnız uygunsa)
        sa.Column("hesaplandi", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        "don_risk",
        sa.Column("garden_id", UUID(as_uuid=True), sa.ForeignKey("gardens.id", ondelete="CASCADE"), nullable=False),
        sa.Column("gece", sa.Date(), nullable=False),  # akşamın (yerel) tarihi; minimum ertesi sabah görülür
        sa.Column("uretildi", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("kritik_c", sa.Float(), nullable=False),
        sa.Column("evre", sa.String(24), nullable=False),
        sa.Column("organlar", JSONB(), nullable=False),
        sa.Column("en_soguk_c", sa.Float(), nullable=False),
        sa.Column("tmin_model", JSONB(), nullable=False),
        sa.Column("uzlasi", sa.Integer(), nullable=False),
        sa.Column("bulut", sa.Float(), nullable=True),
        sa.Column("ruzgar", sa.Float(), nullable=True),
        sa.Column("saat_kritik_alti", sa.Integer(), nullable=False),
        sa.Column("seviye", sa.String(8), nullable=False),  # yok | izle | uyari
        sa.Column("olasilik", sa.Float(), nullable=False),
        sa.Column("neden", sa.Text(), nullable=False),
        sa.Column("kural_surum", sa.String(24), nullable=False),
        sa.PrimaryKeyConstraint("garden_id", "gece"),
    )
    op.create_table(
        "don_geri_bildirim",
        sa.Column("garden_id", UUID(as_uuid=True), sa.ForeignKey("gardens.id", ondelete="CASCADE"), nullable=False),
        sa.Column("gece", sa.Date(), nullable=False),
        sa.Column("yanit", sa.String(10), nullable=False),  # oldu | olmadi | bilmiyorum
        sa.Column("created_by", UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("garden_id", "gece"),
        sa.CheckConstraint("yanit IN ('oldu','olmadi','bilmiyorum')", name="ck_don_geri_bildirim_yanit"),
    )
    op.create_table(
        "olay_yeniden_degerlendirme",
        sa.Column("garden_id", UUID(as_uuid=True), sa.ForeignKey("gardens.id", ondelete="CASCADE"), nullable=False),
        sa.Column("anahtar", sa.String(80), nullable=False),  # events.anahtar (olay silinmez/değiştirilmez; işaret ayrı tabloda)
        sa.Column("kural_surum", sa.String(24), nullable=False),
        sa.Column("sonuc", sa.String(24), nullable=False),
        sa.Column("ayrinti", JSONB(), nullable=False),
        sa.Column("hesaplandi", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("garden_id", "anahtar", "kural_surum"),
    )


def downgrade() -> None:
    for t in ("olay_yeniden_degerlendirme", "don_geri_bildirim", "don_risk", "bahce_topografya"):
        op.drop_table(t)
