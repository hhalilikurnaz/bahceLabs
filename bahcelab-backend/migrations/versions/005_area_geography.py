"""Bahçe alanları: UTM 36N yerine elipsoid üzerinde (geography) hesaplanır."""

from typing import Sequence, Union

from alembic import op

revision: str = "005_area_geography"
down_revision: Union[str, None] = "004_gardens"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE gardens SET alan_dekar = ST_Area(geom::geography) / 1000.0")


def downgrade() -> None:
    op.execute("UPDATE gardens SET alan_dekar = ST_Area(ST_Transform(geom, 32636)) / 1000.0")
