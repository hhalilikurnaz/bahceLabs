"""Risk bildirimi: bahçe + risk başına tek bildirim (haftalık anahtar kalktı) ve otomatik çözüm işareti."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "021_risk_notification_single"
down_revision: Union[str, None] = "020_year_decision_note"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("notifications", sa.Column("otomatik_cozuldu", sa.Boolean(), nullable=False, server_default=sa.false()))
    # Haftalık anahtarlı kopyalar: bahçe + risk başına en yenisi kalır, diğerleri silinir.
    op.execute(
        """
        DELETE FROM notifications n
        USING (
            SELECT id, row_number() OVER (PARTITION BY garden_id, split_part(dedupe_key, ':', 3) ORDER BY created_at DESC, id) AS sira
            FROM notifications WHERE tur = 'zararli_riski' AND dedupe_key LIKE 'risk:%'
        ) d
        WHERE n.id = d.id AND d.sira > 1
        """
    )
    op.execute(
        """
        UPDATE notifications
        SET dedupe_key = 'risk:' || split_part(dedupe_key, ':', 2) || ':' || split_part(dedupe_key, ':', 3)
        WHERE tur = 'zararli_riski' AND dedupe_key LIKE 'risk:%'
        """
    )


def downgrade() -> None:
    op.drop_column("notifications", "otomatik_cozuldu")
