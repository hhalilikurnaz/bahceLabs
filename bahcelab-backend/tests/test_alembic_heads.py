"""Migration zinciri tek başlı olmalı: paralel dallarda aynı numara alınırsa `alembic upgrade head` «Multiple head revisions» ile kırılır."""

from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory

ROOT = Path(__file__).resolve().parents[1]


def _script() -> ScriptDirectory:
    cfg = Config(str(ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(ROOT / "migrations"))
    return ScriptDirectory.from_config(cfg)


def test_alembic_tek_bas_var():
    heads = _script().get_heads()
    assert len(heads) == 1, f"Birden fazla alembic başı: {heads}. Sonradan birleşen dalın migration'ı bir sonraki boş numaraya taşınmalı (down_revision = mevcut baş)."


def test_migration_numaralari_benzersiz():
    """Dosya adındaki sıra numarası tekrar etmez (047_a / 047_b gibi çift numara çakışmanın erken işaretidir)."""
    numaralar = [p.name.split("_", 1)[0] for p in (ROOT / "migrations" / "versions").glob("[0-9][0-9][0-9]_*.py")]
    yinelenen = sorted({n for n in numaralar if numaralar.count(n) > 1})
    assert not yinelenen, f"Yinelenen migration numarası: {yinelenen}"
