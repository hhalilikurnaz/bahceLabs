"""Çeşit kataloğu: gardens.cesit_kodu (mevcut serbest metinler eşlenir) ve bahçe düzeyi fenoloji düzeltmeleri."""

import re
import unicodedata
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "011_agro_catalog"
down_revision: Union[str, None] = "010_tree_count"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Göç sırasında kullanılan takma adlar (kod: rules/katalog.yaml ile aynı kodlar)
ALIASES: dict[str, dict[str, str]] = {
    "limon": {
        "enterdonat": "enterdonat", "interdonato": "enterdonat", "enterdonato": "enterdonat", "interdonat": "enterdonat",
        "kutdiken": "kutdiken", "lamas": "lamas", "meyer": "meyer", "yediveren": "yediveren", "yedi veren": "yediveren",
    },
    "portakal": {"washington": "washington_navel", "washington navel": "washington_navel", "navel": "washington_navel", "valencia": "valencia"},
    "mandalina": {"satsuma": "satsuma", "owari": "satsuma", "klemantin": "klemantin", "clementine": "klemantin", "klementin": "klemantin"},
    "greyfurt": {"star ruby": "star_ruby", "starruby": "star_ruby"},
}


def _fold(text: str) -> str:
    table = str.maketrans("ıİöÖüÜşŞçÇğĞ", "iioouussccgg")
    text = text.translate(table).lower()
    return "".join(c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c)).strip()


def upgrade() -> None:
    op.add_column("gardens", sa.Column("cesit_kodu", sa.String(40), nullable=True))
    op.create_table(
        "garden_phenology_overrides",
        sa.Column("garden_id", UUID(as_uuid=True), sa.ForeignKey("gardens.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("evre_kodu", sa.String(40), primary_key=True),
        sa.Column("baslangic", sa.String(5), nullable=False),  # AA-GG
        sa.Column("bitis", sa.String(5), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT id, urun, cesit FROM gardens WHERE cesit IS NOT NULL AND btrim(cesit) <> ''")).fetchall()
    for garden_id, urun, cesit in rows:
        code = ALIASES.get(urun, {}).get(re.sub(r"\s+", " ", _fold(cesit)), "diger")
        bind.execute(sa.text("UPDATE gardens SET cesit_kodu = :c WHERE id = :i"), {"c": code, "i": garden_id})


def downgrade() -> None:
    op.drop_table("garden_phenology_overrides")
    op.drop_column("gardens", "cesit_kodu")
