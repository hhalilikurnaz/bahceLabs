"""İç yol haritası metni («Adım 11», «Faz 1.5», «Dilim 2» …) kullanıcıya dönen metinlere SIZMAZ: arka uç kaynağındaki tüm dize sabitleri (docstring ve yorum hariç) ve kural kataloğu YAML değerleri taranır.
Not: ADR numarası kaynak künyesidir (yol haritası değil) ve serbesttir. İç kalite ekranına özgü sabitler de taramaya dahildir (yol haritası metni oraya da yazılmaz)."""

import ast
import re
from pathlib import Path

import yaml

KOK = Path(__file__).parent.parent / "src" / "bahcelab_backend"
DESEN = re.compile(r"\b(Adım|ADIM|Faz|Dilim)\s*\d", re.IGNORECASE)  # numaralı adım/faz/dilim iç plandır


def _dizeler(yol: Path) -> list[tuple[int, str]]:
    agac = ast.parse(yol.read_text(encoding="utf-8"))
    docstring = {id(n.body[0].value) for n in ast.walk(agac) if isinstance(n, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)) and n.body and isinstance(n.body[0], ast.Expr) and isinstance(getattr(n.body[0], "value", None), ast.Constant)}
    return [(n.lineno, n.value) for n in ast.walk(agac) if isinstance(n, ast.Constant) and isinstance(n.value, str) and id(n) not in docstring]


def test_arka_uc_dize_sabitlerinde_yol_haritasi_metni_yok():
    bulunan = [f"{p.relative_to(KOK)}:{no}: {metin[:90]!r}" for p in sorted(KOK.rglob("*.py")) for no, metin in _dizeler(p) if DESEN.search(metin)]
    assert not bulunan, "Kullanıcıya dönebilecek dizede iç yol haritası metni var:\n  " + "\n  ".join(bulunan)


def _yaml_degerleri(x: object) -> list[str]:
    if isinstance(x, str):
        return [x]
    if isinstance(x, dict):
        return [v for d in x.values() for v in _yaml_degerleri(d)]
    if isinstance(x, list):
        return [v for d in x for v in _yaml_degerleri(d)]
    return []


def test_kural_katalogu_degerlerinde_yol_haritasi_metni_yok():
    bulunan = []
    for yol in sorted((KOK / "domain" / "agro" / "rules").glob("*.yaml")):
        for metin in _yaml_degerleri(yaml.safe_load(yol.read_text(encoding="utf-8"))):  # YAML yorumları (#) yüklenmez: yalnız değerler
            if DESEN.search(metin):
                bulunan.append(f"{yol.name}: {metin[:90]!r}")
    assert not bulunan, "Katalog değerinde iç yol haritası metni var:\n  " + "\n  ".join(bulunan)
