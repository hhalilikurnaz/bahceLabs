"""Sentinel-2 L2A radyometrisi (SAF): sayısal değer → yüzey yansıtımı için bant başına ölçek ve ofset.

Kaynak öncelik sırası (her sahne için ayrı):
1. Ürün meta verisi (MTD_MSIL2A.xml): `BOA_QUANTIFICATION_VALUE` ve bant başına `BOA_ADD_OFFSET` — sahnenin kendi değeri.
2. STAC varlığındaki `raster:bands` (scale/offset).
3. İşleme sürümü kuralı (≥ 04.00 → −1000 DN): yalnızca meta veri okunamazsa; kayıtta «surum-kurali» olarak işaretlenir.
Ofset atlanırsa 2022-01-25 sonrası sahnelerde her bant +0,1 yüksek çıkar ve NDVI ≈ 0,2 düşük hesaplanır.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Literal

# MTD_MSIL2A.xml'deki band_id sırası
BAND_IDS: tuple[str, ...] = ("B01", "B02", "B03", "B04", "B05", "B06", "B07", "B08", "B8A", "B09", "B10", "B11", "B12")
DEFAULT_QUANTIFICATION = 10000.0
BASELINE_WITH_OFFSET = 4.0
RULE_OFFSET_DN = -1000.0

Source = Literal["urun-metaverisi", "raster-bands", "surum-kurali"]

_QUANT = re.compile(r"<BOA_QUANTIFICATION_VALUE[^>]*>\s*([0-9.]+)\s*<")
_OFFSET = re.compile(r'<BOA_ADD_OFFSET\s+band_id="(\d+)"\s*>\s*(-?[0-9.]+)\s*<')
_BASELINE = re.compile(r"<PROCESSING_BASELINE>\s*([0-9.]+)\s*<")


@dataclass(frozen=True)
class Radiometry:
    quantification: float
    offsets_dn: dict[str, float] = field(default_factory=dict)  # bant → DN ofseti (yoksa 0)
    kaynak: Source = "urun-metaverisi"
    baseline: float | None = None

    def scale_offset(self, band: str) -> tuple[float, float]:
        """(ölçek, ofset) yansıtım biriminde: yansıtım = DN × ölçek + ofset."""
        return 1.0 / self.quantification, self.offsets_dn.get(band, 0.0) / self.quantification


def parse_l2a_metadata(xml: str) -> Radiometry | None:
    """Ürün meta verisinden radyometri; nicemleme değeri bulunamazsa None (ayrıştırılamadı)."""
    q = _QUANT.search(xml)
    if q is None:
        return None
    offsets = {BAND_IDS[int(i)]: float(v) for i, v in _OFFSET.findall(xml) if int(i) < len(BAND_IDS)}
    b = _BASELINE.search(xml)
    return Radiometry(float(q.group(1)), offsets, "urun-metaverisi", float(b.group(1)) if b else None)


def from_raster_bands(bands: dict[str, tuple[float, float]]) -> Radiometry:
    """STAC `raster:bands` (yansıtım biriminde ölçek/ofset) → ortak biçim."""
    scale = next(iter(bands.values()))[0] if bands else 1.0 / DEFAULT_QUANTIFICATION
    quant = 1.0 / scale
    return Radiometry(quant, {k: off * quant for k, (_, off) in bands.items()}, "raster-bands")


def from_baseline(baseline: float | None) -> Radiometry:
    """Son çare: işleme sürümü kuralı."""
    off = RULE_OFFSET_DN if baseline is not None and baseline >= BASELINE_WITH_OFFSET else 0.0
    return Radiometry(DEFAULT_QUANTIFICATION, {b: off for b in BAND_IDS}, "surum-kurali", baseline)
