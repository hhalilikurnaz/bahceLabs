"""«Bugün» bahçenin yerel gününe göre: gardens.zaman_dilimi (varsayılan Europe/Istanbul; Türkiye dışı bahçeler boylamdan Etc/GMT∓n)."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "044_bahce_zaman_dilimi"
down_revision: Union[str, None] = "043_izleme_guncelleme"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("gardens", sa.Column("zaman_dilimi", sa.String(40), nullable=False, server_default="Europe/Istanbul"))
    # Mevcut bahçeler: Türkiye kutusu dışındakiler boylamdan türetilir (kutu içi varsayılan kalır); shared/clock.zaman_dilimi_adi ile aynı kural
    op.execute(
        """
        UPDATE gardens g SET zaman_dilimi = CASE
            WHEN round(c.lng / 15.0) = 0 THEN 'Etc/GMT'
            WHEN round(c.lng / 15.0) > 0 THEN 'Etc/GMT-' || least(14, round(c.lng / 15.0))::int
            ELSE 'Etc/GMT+' || least(12, abs(round(c.lng / 15.0)))::int END
        FROM (SELECT id, ST_X(ST_Centroid(geom)) AS lng, ST_Y(ST_Centroid(geom)) AS lat FROM gardens) c
        WHERE c.id = g.id AND NOT (c.lat BETWEEN 35.5 AND 42.5 AND c.lng BETWEEN 25.5 AND 45.0)
        """
    )


def downgrade() -> None:
    op.drop_column("gardens", "zaman_dilimi")
