"""L1: erken erişim bekleme listesi (landing; kayıtlar kapalıyken e-posta + il + ürün + açık rıza kaydı)."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "048_bekleme_listesi"
down_revision: Union[str, None] = "047_sebep_etiket"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "bekleme_listesi",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("il", sa.String(80), nullable=False),
        sa.Column("urun", sa.String(20), nullable=False),
        sa.Column("riza_zamani", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("aydinlatma_surumu", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("email", name="uq_bekleme_listesi_email"),
        sa.CheckConstraint("urun IN ('limon', 'portakal', 'mandalina', 'diger')", name="ck_bekleme_urun"),
    )


def downgrade() -> None:
    op.drop_table("bekleme_listesi")
