"""CHIRPS kaynağı devre dışı: dağıtım sunucusu bu ağdan 403 (IP engeli) veriyor; kayıt dürüstçe bunu söyler (ADR 0017)."""

from typing import Sequence, Union

from alembic import op

revision: str = "027_chirps_disabled"
down_revision: Union[str, None] = "026_water_sources"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE data_sources SET durum = 'devre_disi', aciklama = 'devre dışı · IP engeli' WHERE id = 'chirps-daily'")


def downgrade() -> None:
    op.execute("UPDATE data_sources SET durum = 'aktif', aciklama = 'Doğrulama: tarihsel ikincil yağış kaynağı. Arayüzde gösterilmez.' WHERE id = 'chirps-daily'")
