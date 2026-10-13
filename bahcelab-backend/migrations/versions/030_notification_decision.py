"""Bildirim karar katmanı (ADR 0018): önem adı «uyari» → «onemli»; `teslim` (anlik | ozet), `ozet_id`, özet maddeleri; kademe anlık görüntüsü."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "030_notification_decision"
down_revision: Union[str, None] = "029_event_status"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE notifications SET oncelik = 'onemli' WHERE oncelik = 'uyari'")
    op.add_column("notifications", sa.Column("teslim", sa.String(8), nullable=False, server_default="anlik"))  # anlik | ozet (özet maddeleri listede görünmez; özet kartında gösterilir)
    op.add_column("notifications", sa.Column("ozet_id", UUID(as_uuid=True), nullable=True))  # bu maddeyi kapsayan özet bildirimi (boşsa özet bekliyor)
    op.add_column("notifications", sa.Column("ayrinti", JSONB, nullable=True))  # özet kartı: [{onem, baslik, baglanti, tur}]
    op.create_index("ix_notifications_ozet", "notifications", ["workspace_id", "teslim", "ozet_id"])
    op.create_table(
        "garden_status_snapshots",
        sa.Column("garden_id", UUID(as_uuid=True), sa.ForeignKey("gardens.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("kademe", sa.String(10), nullable=False),
        sa.Column("hesaplama", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("garden_status_snapshots")
    op.drop_index("ix_notifications_ozet", table_name="notifications")
    op.drop_column("notifications", "ayrinti")
    op.drop_column("notifications", "ozet_id")
    op.drop_column("notifications", "teslim")
    op.execute("UPDATE notifications SET oncelik = 'uyari' WHERE oncelik = 'onemli'")
