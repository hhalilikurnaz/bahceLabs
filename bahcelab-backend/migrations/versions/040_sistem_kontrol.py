"""9I Dilim 1B: vana bazında sulama sistemi kontrol işareti — NDMI seri önbelleği ve kullanıcı yanıtları (kural doğruluğu bununla ölçülür)."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "040_sistem_kontrol"
down_revision: Union[str, None] = "039_eta_ic"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "sk_ndmi",
        sa.Column("garden_id", UUID(as_uuid=True), sa.ForeignKey("gardens.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sektor_ad", sa.String(24), nullable=False),  # «Bahçe» = vana çizilmemiş
        sa.Column("tarih", sa.Date(), nullable=False),
        sa.Column("geom_hash", sa.String(32), nullable=False),  # vana çokgeni değişince önbellek geçersiz
        sa.Column("ndmi", sa.Float(), nullable=False),
        sa.Column("gecerli_oran", sa.Float(), nullable=False),
        sa.Column("piksel", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("garden_id", "sektor_ad", "tarih"),
    )
    op.create_table(
        "sk_yanit",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("garden_id", UUID(as_uuid=True), sa.ForeignKey("gardens.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sektor_ad", sa.String(24), nullable=False),
        sa.Column("sahne_tarihi", sa.Date(), nullable=False),  # işareti doğuran son sahnenin tarihi
        sa.Column("yanit", sa.String(24), nullable=False),  # sorun_yok | damlatici_tikali | baska_sorun
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("garden_id", "sektor_ad", "sahne_tarihi", name="uq_sk_yanit"),
        sa.CheckConstraint("yanit IN ('sorun_yok','damlatici_tikali','baska_sorun')", name="ck_sk_yanit"),
    )


def downgrade() -> None:
    op.drop_table("sk_yanit")
    op.drop_table("sk_ndmi")
