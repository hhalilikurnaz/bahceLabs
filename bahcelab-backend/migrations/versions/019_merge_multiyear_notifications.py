"""Çok yıllık analiz bildirimlerinin kopyalarını birleştir: bahçe + yıl aralığı başına tek bildirim (en yenisi kalır)."""

from typing import Sequence, Union

from alembic import op

revision: str = "019_merge_multiyear_notes"
down_revision: Union[str, None] = "018_risk_snapshot_active"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Bahçe başına en yeni olan kalır; diğer kopyalar silinir.
    op.execute(
        """
        DELETE FROM notifications n
        USING (
            SELECT id, row_number() OVER (PARTITION BY garden_id ORDER BY created_at DESC, id) AS sira
            FROM notifications WHERE tur = 'cok_yillik'
        ) d
        WHERE n.id = d.id AND d.sira > 1
        """
    )
    # Kalan bildirimin anahtarı yeni biçime (bahçe + yıl aralığı) çevrilir: yeniden işleme tekrar üretmez.
    op.execute(
        """
        UPDATE notifications n
        SET dedupe_key = 'cok-yillik:' || n.garden_id::text || ':' || r.baslangic_yili || '-' || r.bitis_yili
        FROM multiyear_runs r
        WHERE n.tur = 'cok_yillik' AND r.garden_id = n.garden_id
        """
    )


def downgrade() -> None:
    pass  # silinen kopyalar geri getirilemez; anahtar biçimi eski kayıtlarla çakışmaz
