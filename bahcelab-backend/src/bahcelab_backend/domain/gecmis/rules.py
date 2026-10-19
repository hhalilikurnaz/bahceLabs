"""Geçmiş sayfası kuralları (SAF, veritabanı yok): yıl özeti etiketi ve yeşerme başlangıcı. Eşikler katalogdadır (`gecmis`, ön değer)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from statistics import median

from bahcelab_backend.domain.agro.catalog import DurumV2Kurali, GecmisKurali
from bahcelab_backend.domain.agro.status_v2 import Seviye, percentile_band, position_label


def summer_value(months: dict[int, float], rule: GecmisKurali) -> float | None:
    """Yılın yaz değeri: yaz aylarının temsilci değerlerinin ortalaması; yeterli ay yoksa None (uydurma yok)."""
    picked = [v for m, v in months.items() if rule.yaz_ilk_ay <= m <= rule.yaz_son_ay]
    return sum(picked) / len(picked) if len(picked) >= rule.yaz_asgari_ay else None


def year_levels(values: dict[int, float | None], rule: GecmisKurali, label_rule: DurumV2Kurali) -> dict[int, Seviye | None]:
    """Her yılın yaz değeri, DİĞER yılların dağılımına göre TEK etiket kuralıyla etiketlenir (kendi kendini normallemez). Yeterli diğer yıl yoksa None."""
    out: dict[int, Seviye | None] = {}
    for year, value in values.items():
        others = [v for y, v in values.items() if y != year and v is not None]
        if value is None or len(others) < rule.asgari_diger_yil:
            out[year] = None
            continue
        out[year] = position_label(value, percentile_band(others, label_rule), label_rule)
    return out


@dataclass(frozen=True)
class CurvePoint:
    tarih: date
    deger: float
    tahmini: bool


@dataclass(frozen=True)
class GreenUp:
    tarih: date
    taban: float
    tepe: float
    gozlem: int


def _mmdd(year: int, text: str) -> date:
    return date(year, int(text[:2]), int(text[3:]))


def green_up(year: int, points: list[CurvePoint], observation_days: list[date], rule: GecmisKurali) -> GreenUp | None:
    """Yeşerme başlangıcı: kış tabanı → ilkbahar tepesi farkının eşik oranını KALICI aştığı ilk gün. Güvenilir değilse (yetersiz gözlem, düşük genlik, tahmini ağırlıklı eğri) None."""
    start, base_end = date(year, 1, 1), _mmdd(year, rule.yesillenme_taban_son)
    peak_start, peak_end = _mmdd(year, rule.yesillenme_tepe_ilk), _mmdd(year, rule.yesillenme_tepe_son)
    search_start = date(year, 2, 1)
    base_points = [p for p in points if start <= p.tarih <= base_end]
    peak_points = [p for p in points if peak_start <= p.tarih <= peak_end]
    window = [p for p in points if search_start <= p.tarih <= peak_end]
    seen = [d for d in observation_days if search_start <= d <= peak_end]
    if not base_points or not peak_points or not window or len(seen) < rule.yesillenme_asgari_gozlem:
        return None
    if sum(1 for p in window if not p.tahmini) / len(window) < rule.yesillenme_gozlem_orani:
        return None
    base = float(median(p.deger for p in base_points))
    peak = max(p.deger for p in peak_points)
    if peak - base < rule.yesillenme_asgari_genlik:
        return None
    threshold = base + rule.yesillenme_esik_orani * (peak - base)
    hold = timedelta(days=rule.yesillenme_kalicilik_gun)
    for p in window:
        if p.deger >= threshold and all(q.deger >= threshold for q in window if p.tarih <= q.tarih <= p.tarih + hold):
            return GreenUp(p.tarih, round(base, 3), round(peak, 3), len(seen))
    return None
