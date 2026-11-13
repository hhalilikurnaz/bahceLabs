"""«Bugün» tek yerden (shared/clock.bugun): alan/servis/iş/betik kodunda `date.today()`, `datetime.today()`, `datetime.utcnow()` ve `datetime.now(UTC).date()` YASAK.
Sebep: UTC günü ile bahçenin yerel günü 00:00–03:00 (İstanbul) arasında ayrışır; tohum/plan/olay/besleme günleri bir gün kayar (9J Dilim 2 e2e bulgusu)."""

import ast
from pathlib import Path

KOK = Path(__file__).resolve().parents[1]
ISTISNA = {KOK / "src" / "bahcelab_backend" / "shared" / "clock.py"}


def _yasakli(node: ast.AST) -> str | None:
    if not isinstance(node, ast.Call) or not isinstance(node.func, ast.Attribute):
        return None
    f = node.func
    ad = ast.unparse(f)
    if ad in ("date.today", "datetime.today", "datetime.utcnow", "datetime.datetime.utcnow", "datetime.date.today"):
        return ad + "()"
    if f.attr == "date" and isinstance(f.value, ast.Call) and isinstance(f.value.func, ast.Attribute) and f.value.func.attr == "now":
        a = f.value.args
        if len(a) == 1 and ast.unparse(a[0]) in ("UTC", "timezone.utc", "datetime.UTC"):
            return "datetime.now(UTC).date()"
    return None


def test_alan_kodunda_date_today_ve_utc_gunu_yok():
    ihlal: list[str] = []
    for klasor in ("src", "scripts"):
        for yol in sorted((KOK / klasor).rglob("*.py")):
            if yol in ISTISNA:
                continue
            for node in ast.walk(ast.parse(yol.read_text())):
                if (ad := _yasakli(node)) is not None:
                    ihlal.append(f"{yol.relative_to(KOK)}:{node.lineno} {ad}")
    assert not ihlal, "Yasak «bugün» kullanımı (shared.clock.bugun / bahce_bugunu kullanın):\n" + "\n".join(ihlal)
