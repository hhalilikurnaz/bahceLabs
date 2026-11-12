"""Uydudan ETa sağlayıcı soyutlaması (ADR 0028). Termal ETa kaynakları BU arayüzlerden bağlanır: bugün Landsat 8/9 (30 m ürün / 100 m fiziksel);
ileride Hydrosat ya da başka yüksek çözünürlüklü termal aynı `TermalSahneSaglayici` ile eklenir — hesap (`ssebop.py`) ve servis değişmez.
Bağlam (WaPOR L1) ve doğrulama (ECOSTRESS) ayrı, daha dar arayüzlerdir; hiçbiri kullanıcıya gösterilmez.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Any, Protocol

import numpy as np


@dataclass(frozen=True)
class SahneRef:
    tarih: date
    sahne_id: str
    platform: str
    handle: Any = field(default=None, compare=False)


@dataclass(frozen=True)
class TermalSahne:
    """Bahçe + çevre penceresi (tek ızgara): termal ETa için gereken her şey. Diziler aynı şekilde."""

    ref: SahneRef
    termal_m: float  # FİZİKSEL termal çözünürlük (karışık piksel hesabı için)
    lst_k: np.ndarray
    sigma_lst_k: np.ndarray | None  # ürünün kendi belirsizliği (Landsat ST_QA), K
    ndvi: np.ndarray
    gecerli: np.ndarray  # bool: bulut/gölge/kar/dolgu dışı ve LST+NDVI sonlu
    dem_m: np.ndarray
    bahce: np.ndarray  # bool: bahçe poligonu içi
    ic: np.ndarray  # bool: iç tampon (−N m) içi
    piksel_m: float  # ızgara aralığı (m)


class TermalSahneSaglayici(Protocol):
    kaynak_id: str
    termal_m: float

    def ara(self, geometry: dict[str, Any], bas: date, bit: date) -> list[SahneRef]: ...

    def oku(self, ref: SahneRef, geometry: dict[str, Any], *, ic_tampon_m: float, pencere_yari_m: float) -> TermalSahne: ...


@dataclass(frozen=True)
class BaglamNoktasi:
    bas: date
    bit: date
    et_mm_gun: float | None
    piksel_dokunan: int
    piksel_gecerli: int
    piksel_m: float | None


class BaglamSaglayici(Protocol):
    """Kaba, sürekli seri (WaPOR L1 dekadal 300 m): yalnız iç bağlam, bahçe değeri değildir."""

    kaynak_id: str

    def seri(self, geometry: dict[str, Any], bas: date, bit: date) -> list[BaglamNoktasi]: ...


@dataclass(frozen=True)
class DogrulamaNoktasi:
    tarih: date
    sahne_id: str
    et_mm_gun: float | None
    piksel_gecerli: int
    piksel_dokunan: int


class DogrulamaSaglayici(Protocol):
    """Seyrek, bağımsız ikinci kaynak (ECOSTRESS V003 `ETdaily`): kısmi doğrulama."""

    kaynak_id: str

    def seri(self, geometry: dict[str, Any], bas: date, bit: date) -> list[DogrulamaNoktasi]: ...
