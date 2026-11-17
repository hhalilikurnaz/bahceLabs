"""ADIM 10 · Dilim 2 (ADR 0032): eski «hava_don» bildirimi emekli → kullanıcı tercihleri «don_uyari»'ya taşınır; don_risk'e «en soğuk saat» eklenir."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "046_don_uyari_tercih"
down_revision: Union[str, None] = "045_don"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("don_risk", sa.Column("en_soguk_saat", sa.SmallInteger(), nullable=True))  # yerel saat (0–23): en soğuk modelin gece minimumunu gördüğü saat
    # Tercih taşıma: «hava_don» kapatmış olan çalışma alanı «don_uyari»'yı da kapalı kazanır; açık olanlar varsayılan (açık) kalır. Sonra eski satır silinir.
    op.execute(
        "INSERT INTO notification_preferences (workspace_id, tur, acik) SELECT workspace_id, 'don_uyari', acik FROM notification_preferences WHERE tur = 'hava_don' "
        "ON CONFLICT DO NOTHING"
    )
    op.execute("INSERT INTO notification_preferences (workspace_id, tur, acik) SELECT workspace_id, 'don_soru', acik FROM notification_preferences WHERE tur = 'hava_don' ON CONFLICT DO NOTHING")
    op.execute("DELETE FROM notification_preferences WHERE tur = 'hava_don'")


def downgrade() -> None:
    op.execute("INSERT INTO notification_preferences (workspace_id, tur, acik) SELECT workspace_id, 'hava_don', acik FROM notification_preferences WHERE tur = 'don_uyari' ON CONFLICT DO NOTHING")
    op.drop_column("don_risk", "en_soguk_saat")
