"""Ürün/çeşit kataloğu yükleyici: `rules/katalog.yaml` (sürümlü) → doğrulanmış modeller.

Tarımsal hiçbir sabit kodda yoktur. Her blok (fenoloji, Kc, GDD) kendi `durum` ve `kaynak` alanını taşır;
`dogrulanmadi` değerler arayüzde "ön değer – ziraat mühendisi onayı bekleniyor" rozetiyle gösterilir.
"""

from __future__ import annotations

import re
import unicodedata
from datetime import date
from functools import lru_cache
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, Field, model_validator

RULES_DIR = Path(__file__).parent / "rules"
CATALOG_FILE = RULES_DIR / "katalog.yaml"

KuralDurumu = Literal["dogrulanmadi", "muhendis_onayli"]
_MMDD = re.compile(r"^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$")


class KuralBlok(BaseModel):
    """Her kuralın ortak alanları: doğrulama durumu ve kaynak notu."""

    durum: KuralDurumu
    kaynak: str = Field(min_length=1)
    onaylayan: str | None = None
    onay_tarihi: date | None = None

    @model_validator(mode="after")
    def _approved_needs_owner(self) -> KuralBlok:
        if self.durum == "muhendis_onayli" and not (self.onaylayan and self.onay_tarihi):
            raise ValueError("Mühendis onaylı kuralda 'onaylayan' ve 'onay_tarihi' zorunludur.")
        return self


class EvreTanimi(BaseModel):
    kod: str
    ad: str
    baslangic: str  # AA-GG
    bitis: str

    @model_validator(mode="after")
    def _dates(self) -> EvreTanimi:
        for value in (self.baslangic, self.bitis):
            if not _MMDD.match(value):
                raise ValueError(f"Evre tarihi 'AA-GG' biçiminde olmalı: {value}")
        return self


class FenolojiKurali(KuralBlok):
    evreler: list[EvreTanimi]


class KcKurali(KuralBlok):
    degerler: dict[str, float]


class GddKurali(KuralBlok):
    taban_c: float


class Cesit(BaseModel):
    kod: str
    ad: str
    aliaslar: list[str] = []
    # Çeşit düzeyinde ayrı değer girilirse ürün değerlerinin yerine geçer
    fenoloji: FenolojiKurali | None = None
    kc: KcKurali | None = None
    gdd: GddKurali | None = None
    not_: str | None = Field(default=None, alias="not")


class Urun(BaseModel):
    ad: str
    fenoloji: FenolojiKurali | None = None
    kc: KcKurali | None = None
    gdd: GddKurali | None = None
    cesitler: list[Cesit]


class Katalog(BaseModel):
    surum: int
    sezon_baslangici: str
    urunler: dict[str, Urun]

    @model_validator(mode="after")
    def _consistent(self) -> Katalog:
        for kod, urun in self.urunler.items():
            if urun.fenoloji and urun.kc:
                stages = {e.kod for e in urun.fenoloji.evreler}
                if stages != set(urun.kc.degerler):
                    raise ValueError(f"{kod}: Kc değerleri fenoloji evreleriyle aynı olmalı.")
            if not any(c.kod == "diger" for c in urun.cesitler):
                raise ValueError(f"{kod}: 'diger' çeşidi zorunludur.")
        return self

    def urun(self, kod: str) -> Urun | None:
        return self.urunler.get(kod)

    def cesit(self, urun: str, cesit: str) -> Cesit | None:
        u = self.urun(urun)
        return next((c for c in u.cesitler if c.kod == cesit), None) if u else None


@lru_cache
def load_catalog(path: Path = CATALOG_FILE) -> Katalog:
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    raw.pop("varsayilan_narenciye", None)  # yalnızca YAML çapa tanımı
    return Katalog.model_validate(raw)


# ----------------------------------------------------------------------------- yardımcılar
def fold(text: str) -> str:
    """Türkçe harfleri sadeleştirip küçültür: 'Kütdiken' → 'kutdiken'."""
    table = str.maketrans("ıİöÖüÜşŞçÇğĞ", "iioouussccgg")
    text = text.translate(table).lower()
    return "".join(c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c)).strip()


def match_variety(catalog: Katalog, urun: str, free_text: str | None) -> str | None:
    """Serbest metindeki çeşit adını katalog koduna eşler (göç için); bulunamazsa metin varsa 'diger', yoksa None."""
    if not free_text or not free_text.strip():
        return None
    needle = fold(free_text)
    u = catalog.urun(urun)
    for cesit in u.cesitler if u else []:
        if needle == cesit.kod or needle in {fold(a) for a in cesit.aliaslar} or needle == fold(cesit.ad):
            return cesit.kod
    return "diger"


class EtkinKurallar(BaseModel):
    """Bir ürün+çeşit için geçerli (çeşit değeri varsa onun, yoksa ürünün) kurallar."""

    fenoloji: FenolojiKurali | None
    kc: KcKurali | None
    gdd: GddKurali | None


def effective_rules(catalog: Katalog, urun: str, cesit: str | None) -> EtkinKurallar:
    u = catalog.urun(urun)
    if u is None:
        return EtkinKurallar(fenoloji=None, kc=None, gdd=None)
    c = catalog.cesit(urun, cesit) if cesit else None
    return EtkinKurallar(
        fenoloji=(c.fenoloji if c and c.fenoloji else u.fenoloji),
        kc=(c.kc if c and c.kc else u.kc),
        gdd=(c.gdd if c and c.gdd else u.gdd),
    )


# ----------------------------------------------------------------------------- sezon ve evre tarihleri
def season_start_year(today: date, season_start: str = "10-01") -> int:
    month, day = (int(p) for p in season_start.split("-"))
    return today.year if (today.month, today.day) >= (month, day) else today.year - 1


def _anchor(mmdd: str, season_year: int, season_start: str) -> date:
    sm, sd = (int(p) for p in season_start.split("-"))
    m, d = (int(p) for p in mmdd.split("-"))
    year = season_year if (m, d) >= (sm, sd) else season_year + 1
    return date(year, m, d)


def stage_window(baslangic: str, bitis: str, season_year: int, season_start: str = "10-01") -> tuple[date, date]:
    """AA-GG aralığını `season_year` sezonunun içindeki gerçek tarihlere çevirir (yıl sonunu aşan evreler dahil)."""
    start = _anchor(baslangic, season_year, season_start)
    end = _anchor(bitis, season_year, season_start)
    if end < start:
        end = date(end.year + 1, end.month, end.day)
    return start, end
