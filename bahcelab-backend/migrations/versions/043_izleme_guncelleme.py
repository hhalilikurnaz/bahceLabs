"""9J: veri taraması «son taramadan beri DEĞİŞEN satırlar» ölçütüyle (güncelleme zamanı); kaynak satırı güncellenince (ERA5 kesinleşmesi, WaPOR NRT→final) yeniden taranır.
Güncelleme zamanı bir TETİKLEYİCİYLE tutulur (satırın yazıldığı an, `clock_timestamp`): hangi yazıcı kodu (upsert) kullanırsa kullansın her INSERT/UPDATE `guncelleme`'yi günceller."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "043_izleme_guncelleme"
down_revision: Union[str, None] = "042_izleme"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLOLAR = ("era5_daily", "dogrulama_gozlem", "station_daily", "eta_baglam")


def upgrade() -> None:
    for t in ("station_daily", "eta_baglam"):
        op.add_column(t, sa.Column("guncelleme", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.execute("CREATE OR REPLACE FUNCTION izleme_guncelleme() RETURNS trigger AS $$ BEGIN NEW.guncelleme = clock_timestamp(); RETURN NEW; END; $$ LANGUAGE plpgsql")
    for t in TABLOLAR:
        op.execute(f"CREATE TRIGGER trg_{t}_guncelleme BEFORE INSERT OR UPDATE ON {t} FOR EACH ROW EXECUTE FUNCTION izleme_guncelleme()")
        op.create_index(f"ix_{t}_guncelleme", t, ["guncelleme"])
    op.create_table(
        "izleme_tarama",
        sa.Column("kaynak", sa.String(24), primary_key=True),
        sa.Column("son_tarama", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("izleme_tarama")
    for t in TABLOLAR:
        op.drop_index(f"ix_{t}_guncelleme", table_name=t)
        op.execute(f"DROP TRIGGER IF EXISTS trg_{t}_guncelleme ON {t}")
    op.execute("DROP FUNCTION IF EXISTS izleme_guncelleme()")
    for t in ("eta_baglam", "station_daily"):
        op.drop_column(t, "guncelleme")
