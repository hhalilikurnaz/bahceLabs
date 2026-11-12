"""9I Dilim 1B eki: komşu halka NDMI serisi (bahçe sınırından 100–300 m, ağaçlık pikseller) — sulama sistemi kontrol işaretinin referansı."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "041_sk_halka"
down_revision: Union[str, None] = "040_sistem_kontrol"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "sk_halka",
        sa.Column("garden_id", UUID(as_uuid=True), sa.ForeignKey("gardens.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tarih", sa.Date(), nullable=False),
        sa.Column("geom_hash", sa.String(32), nullable=False),  # bahçe sınırı + halka parametreleri değişince geçersiz
        sa.Column("ndmi", sa.Float(), nullable=True),  # geçerli ağaçlık piksel < eşik ise boş
        sa.Column("ndvi", sa.Float(), nullable=True),
        sa.Column("piksel", sa.Integer(), nullable=False),  # geçerli ağaçlık piksel sayısı
        sa.Column("halka_piksel", sa.Integer(), nullable=False),  # halkadaki tüm piksel
        sa.PrimaryKeyConstraint("garden_id", "tarih"),
    )


def downgrade() -> None:
    op.drop_table("sk_halka")
