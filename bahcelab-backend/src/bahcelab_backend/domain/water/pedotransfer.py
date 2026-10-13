"""Toprak parametreleri (ADR 0017): SoilGrids 250 m doku/organik karbon → Saxton & Rawls (2006) pedotransfer ile tarla kapasitesi ve solma noktası.

ÖN DEĞER: Adım 14 toprak tahlili gelince onun yerine geçer. Bu eşikler ERA5-Land'in mutlak nemine UYGULANMAZ (farklı toprak şeması); yalnız su dengesi kovasında
(kullanılabilir su, mm) kullanılır.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

ORGANIC_CARBON_TO_MATTER = 1.724  # Van Bemmelen: OM = 1,724 × OC
SOILGRIDS_DEPTHS = ("0-5cm", "5-15cm", "15-30cm", "30-60cm", "60-100cm")
DEPTH_WIDTHS_CM = (5, 10, 15, 30, 40)


@dataclass(frozen=True)
class Texture:
    kum_yuzde: float
    kil_yuzde: float
    silt_yuzde: float
    organik_karbon_g_kg: float

    @property
    def organik_madde_yuzde(self) -> float:
        return self.organik_karbon_g_kg * ORGANIC_CARBON_TO_MATTER / 10.0


def saxton_rawls(kum_yuzde: float, kil_yuzde: float, organik_madde_yuzde: float) -> tuple[float, float]:
    """(tarla kapasitesi θ33, solma noktası θ1500) hacimsel nem m³/m³. Saxton & Rawls 2006 (Soil Sci. Soc. Am. J. 70:1569), denklem 1–2 + düzeltme.

    Geçerlilik: OM ≤ %8, kil ≤ %60.
    """
    s, c = kum_yuzde / 100.0, kil_yuzde / 100.0
    om = min(max(organik_madde_yuzde, 0.0), 8.0)
    t1500 = -0.024 * s + 0.487 * c + 0.006 * om + 0.005 * s * om - 0.013 * c * om + 0.068 * s * c + 0.031
    wp = t1500 + (0.14 * t1500 - 0.02)
    t33 = -0.251 * s + 0.195 * c + 0.011 * om + 0.006 * s * om - 0.027 * c * om + 0.452 * s * c + 0.299
    fc = t33 + (1.283 * t33 * t33 - 0.374 * t33 - 0.015)
    return fc, wp


def aggregate_soilgrids(payload: dict[str, Any]) -> Texture:
    """SoilGrids REST yanıtı (0–100 cm, 5 katman) → kalınlık ağırlıklı doku (%) ve organik karbon (g/kg). Birimler d_factor ile geleneksel birime çevrilir."""
    sums: dict[str, float] = {}
    for layer in payload["properties"]["layers"]:
        factor = float(layer["unit_measure"]["d_factor"])
        weighted = total = 0.0
        for depth, width in zip(SOILGRIDS_DEPTHS, DEPTH_WIDTHS_CM, strict=True):
            entry = next((d for d in layer["depths"] if d["label"] == depth), None)
            value = None if entry is None else entry["values"].get("mean")
            if value is None:
                continue
            weighted += float(value) / factor * width
            total += width
        if total < 60:  # 100 cm'nin en az %60'ı dolu olmalı
            raise ValueError(f"SoilGrids {layer['name']} için yeterli derinlik verisi yok")
        sums[layer["name"]] = weighted / total
    return Texture(sums["sand"], sums["clay"], sums["silt"], sums["soc"])


def available_water_mm(fc: float, wp: float, root_depth_cm: float) -> float:
    """Kullanılabilir su kapasitesi (TAW, mm) = (θfc − θwp) × kök derinliği (mm)."""
    return max(0.0, (fc - wp) * root_depth_cm * 10.0)
