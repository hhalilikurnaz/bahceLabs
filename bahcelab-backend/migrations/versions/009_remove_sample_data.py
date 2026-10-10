"""Örnek (sahte) veri kayıtlarını temizler: uygulamada hazır veri yoktur."""

from typing import Sequence, Union

from alembic import op

revision: str = "009_remove_sample"
down_revision: Union[str, None] = "008_weather"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # index_observations, scene_observations silinince zincirleme silinir
    op.execute("DELETE FROM scene_observations WHERE kaynak = 'ornek'")
    op.execute("DELETE FROM weather_daily WHERE kaynak = 'ornek'")
    op.execute(
        "UPDATE weather_cells SET tahmin = NULL, tahmin_zamani = NULL, tahmin_kaynak = NULL, "
        "gecmis_senkron = NULL WHERE tahmin_kaynak = 'ornek'"
    )


def downgrade() -> None:
    # Silinen sahte veri geri getirilmez
    pass
