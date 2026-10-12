"""Normal bantlar (SAF): bir göstergenin takvim ayı başına yıllar arası dağılımı (p10/p25/ortanca/p75/p90).

Her yıl-ay için tek temsilci değer (o ayın net edinimlerinin medyan ortalaması) kullanılır; net edinimi olmayan yıl-ay EKSİK sayılır (uydurma
yok). Banda yetersiz veri ve uyumsuz/hariç yıllar girmez (`allowed_years`). Eşikler katalogda ön değerdir: p25–p75 için en az 5 yıl,
p10–p90 için en az 8 yıl; altında yüzdelikler boş bırakılır («yetersiz geçmiş»).
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np


@dataclass(frozen=True)
class BandThresholds:
    min_years_quartile: int  # p25–p75 (ve ortanca)
    min_years_decile: int  # p10–p90


@dataclass
class MonthBand:
    ay: int
    yil_sayisi: int
    yillar: list[int]
    p10: float | None = None
    p25: float | None = None
    p50: float | None = None
    p75: float | None = None
    p90: float | None = None
    ceyrek_yeterli: bool = False
    onluk_yeterli: bool = False
    ayrinti: dict[str, float] = field(default_factory=dict)  # yıl → temsilci değer (şeffaflık)


def compute_normal_bands(
    values: dict[int, dict[int, float]], *, allowed_years: set[int] | None, first_year: int, last_year: int, thresholds: BandThresholds
) -> list[MonthBand]:
    """`values[yıl][ay]` → 12 aylık bant listesi. Yıl aralığı [first_year, last_year] dışı ve `allowed_years` dışı yıllar atlanır."""
    out: list[MonthBand] = []
    for month in range(1, 13):
        picked = {
            year: float(v[month])
            for year, v in values.items()
            if first_year <= year <= last_year and (allowed_years is None or year in allowed_years) and month in v and np.isfinite(v[month])
        }
        years = sorted(picked)
        band = MonthBand(month, len(years), years, ayrinti={str(y): round(picked[y], 4) for y in years})
        arr = np.array([picked[y] for y in years], dtype=np.float64)
        if len(years) >= thresholds.min_years_quartile:
            band.ceyrek_yeterli = True
            band.p25, band.p50, band.p75 = (float(np.percentile(arr, q)) for q in (25, 50, 75))
        if len(years) >= thresholds.min_years_decile:
            band.onluk_yeterli = True
            band.p10, band.p90 = (float(np.percentile(arr, q)) for q in (10, 90))
        out.append(band)
    return out


def position_in_band(value: float, band: MonthBand) -> str | None:
    """Bugünkü değerin banda göre konumu: 'normal' (p25–p75), 'alt' (p10–p25), 'en dusuk' (p10 altı), 'ust' (p75 üstü); band yetersizse None."""
    if not band.ceyrek_yeterli or band.p25 is None or band.p75 is None:
        return None
    if value > band.p75:
        return "ust"
    if value >= band.p25:
        return "normal"
    if band.onluk_yeterli and band.p10 is not None:
        return "alt" if value >= band.p10 else "en_dusuk"
    return "alt"
