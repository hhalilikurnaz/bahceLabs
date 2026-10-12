"""Bildirim yaşam döngüsü: oluştu → görüldü → çözüldü / ertelendi."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "017_notification_lifecycle"
down_revision: Union[str, None] = "016_multiyear_decision"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("notifications", sa.Column("durum", sa.String(12), nullable=False, server_default="olustu"))
    op.add_column("notifications", sa.Column("ertelendi_bitis", sa.DateTime(timezone=True), nullable=True))
    op.add_column("notifications", sa.Column("cozuldu_zamani", sa.DateTime(timezone=True), nullable=True))
    op.execute("UPDATE notifications SET durum = 'goruldu' WHERE okundu")


def downgrade() -> None:
    op.drop_column("notifications", "cozuldu_zamani")
    op.drop_column("notifications", "ertelendi_bitis")
    op.drop_column("notifications", "durum")
