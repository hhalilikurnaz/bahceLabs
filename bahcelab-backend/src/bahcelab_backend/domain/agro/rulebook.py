"""Sulama ve risk kural dosyalarının (`rules/sulama.yaml`, `rules/riskler.yaml`) yükleyicileri. Katalogla aynı ilkeler:
kuralda tarımsal sabit kodda değildir; her blok `durum` + `kaynak` taşır."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel

from bahcelab_backend.domain.agro.catalog import RULES_DIR, KuralBlok

IRRIGATION_FILE = RULES_DIR / "sulama.yaml"
RISK_FILE = RULES_DIR / "riskler.yaml"


class EtkiliYagis(KuralBlok):
    kucuk_yagis_esigi_mm: float
    oran: float
    gunluk_ust_sinir_mm: float


class SistemBilgisi(BaseModel):
    ad: str
    verimlilik: float | None


class SulamaSistemleri(KuralBlok):
    sistemler: dict[str, SistemBilgisi]


class Hesap(BaseModel):
    gecmis_gun: int
    gelecek_gun: int
    mm_basina_ton_dekar: float
    ihtiyac_esigi_mm: float


class SulamaKurallari(BaseModel):
    surum: int
    etkili_yagis: EtkiliYagis
    sulama_sistemleri: SulamaSistemleri
    hesap: Hesap


class RiskKurali(KuralBlok):
    ad: str
    kisa: str
    urunler: list[str]
    parametreler: dict[str, Any]


class RiskKitabi(BaseModel):
    surum: int
    kurallar: dict[str, RiskKurali]


@lru_cache
def load_irrigation_rules(path: Path = IRRIGATION_FILE) -> SulamaKurallari:
    return SulamaKurallari.model_validate(yaml.safe_load(path.read_text(encoding="utf-8")))


@lru_cache
def load_risk_rules(path: Path = RISK_FILE) -> RiskKitabi:
    return RiskKitabi.model_validate(yaml.safe_load(path.read_text(encoding="utf-8")))
