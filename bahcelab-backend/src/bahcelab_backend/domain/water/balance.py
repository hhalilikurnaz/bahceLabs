"""Su dengesi, kök bölgesi doluluğu, yüzey–hava sıcaklık farkı ve karar cümlesi (SAF fonksiyonlar, ADR 0017).

Tüm katsayı ve eşikler katalogda (`su` bloğu) «ön değer · mühendis onayı bekliyor». Toprak eşikleri (tarla kapasitesi, solma noktası) YALNIZ kovada kullanılır;
ERA5-Land'in mutlak nemine uygulanmaz: nem profili ve doluluk bahçenin/hücrenin KENDİ klimatolojisine göre normalize edilir.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

import numpy as np

from bahcelab_backend.domain.agro.catalog import SuKurali


def kc_from_ndvi(ndvi: float | None, rule: SuKurali) -> float | None:
    """Bitki katsayısı Kc: NDVI'dan doğrusal (alt/üst sınırda kırpılır); NDVI yoksa None (uydurma yok)."""
    if ndvi is None or not np.isfinite(ndvi):
        return None
    t = (ndvi - rule.kc_ndvi_alt) / (rule.kc_ndvi_ust - rule.kc_ndvi_alt)
    return float(rule.kc_alt + (rule.kc_ust - rule.kc_alt) * min(1.0, max(0.0, t)))


def etc_mm(et0_mm: float | None, kc: float | None) -> float | None:
    """ETc = Kc × ET0 (mm/gün)."""
    return None if et0_mm is None or kc is None else et0_mm * kc


def interpolate_ndvi(days: list[date], observations: list[tuple[date, float]]) -> list[float | None]:
    """Gün başına NDVI: sahneler arası doğrusal; ilk sahneden önce ve son sahneden sonra EN YAKIN sahne değeri (en fazla 45 gün; ötesi None)."""
    if not observations:
        return [None] * len(days)
    obs = sorted(observations)
    xs = np.array([o[0].toordinal() for o in obs], dtype=float)
    ys = np.array([o[1] for o in obs], dtype=float)
    out: list[float | None] = []
    for d in days:
        x = d.toordinal()
        if x < xs[0] - 45 or x > xs[-1] + 45:
            out.append(None)
        else:
            out.append(float(np.interp(x, xs, ys)))
    return out


@dataclass(frozen=True)
class DayInput:
    tarih: date
    yagis_mm: float | None
    et0_mm: float | None
    kc: float | None
    tahmin: bool = False  # True: model tahmini (kesikli çizilir)


@dataclass(frozen=True)
class DayBalance:
    tarih: date
    yagis_mm: float
    etc_mm: float
    tukenme_mm: float  # kök bölgesi su eksiği (0 = tarla kapasitesi, TAW = solma noktası)
    kullanilabilir_mm: float  # TAW − tükenme
    birikimli_mm: float  # birikimli (yağış − ETc), pencere başından
    tahmin: bool
    veri_eksik: bool  # yağış, ET0 ya da Kc eksikse gün sayılmaz (kova değişmez)


def simulate(days: list[DayInput], taw_mm: float, initial_depletion_mm: float) -> list[DayBalance]:
    """Günlük kova: Dr_t = clamp(Dr_{t−1} − P + ETc, 0, TAW). Sulama kaydı yoktur (yalnız yağış ve ETc); taşan su (Dr < 0) derin sızıntı sayılır.

    Veri eksik gün (yağış/ET0/Kc None): kova ve birikimli değişmez, `veri_eksik=True` — eksik değer uydurulmaz.
    """
    out: list[DayBalance] = []
    dr = min(max(initial_depletion_mm, 0.0), taw_mm)
    cumulative = 0.0
    for day in days:
        etc = etc_mm(day.et0_mm, day.kc)
        if day.yagis_mm is None or etc is None:
            out.append(DayBalance(day.tarih, 0.0, 0.0, dr, taw_mm - dr, cumulative, day.tahmin, True))
            continue
        dr = min(taw_mm, max(0.0, dr - day.yagis_mm + etc))
        cumulative += day.yagis_mm - etc
        out.append(DayBalance(day.tarih, day.yagis_mm, etc, dr, taw_mm - dr, cumulative, day.tahmin, False))
    return out


@dataclass(frozen=True)
class Climatology:
    """Bir toprak katmanının ERA5-Land klimatolojisi (2015–2025): normalize uçları ve «normal aralık»."""

    p_alt: float  # 0 sayılan nem (p2)
    p_ust: float  # 100 sayılan nem (p98)
    normal_alt: float  # p10
    normal_ust: float  # p90


def normalized_fill(value: float | None, clim: Climatology) -> float | None:
    """Katman nemi → «normale göre doluluk» %: p2 = 0, p98 = 100 (kırpılır). Klimatoloji dejenereyse None."""
    if value is None or clim.p_ust <= clim.p_alt:
        return None
    return float(min(100.0, max(0.0, (value - clim.p_alt) / (clim.p_ust - clim.p_alt) * 100.0)))


def root_zone_fill(layer_values: list[float | None], clims: list[Climatology], weights: tuple[float, float, float]) -> float | None:
    """Kök bölgesi (0–100 cm = ilk 3 katman) doluluğu: katman doluluklarının kalınlık ağırlıklı ortalaması; hiçbir katman yoksa None."""
    total = acc = 0.0
    for value, clim, w in zip(layer_values[:3], clims[:3], weights, strict=True):
        fill = normalized_fill(value, clim)
        if fill is not None:
            acc += fill * w
            total += w
    return acc / total if total > 0 else None


def classify_fill(fill: float | None, rule: SuKurali) -> str:
    """nemli | orta | kuru | bilinmiyor"""
    if fill is None:
        return "bilinmiyor"
    return "nemli" if fill >= rule.doluluk_nemli_min else "kuru" if fill <= rule.doluluk_kuru_max else "orta"


def decision_sentence(fill: float | None, forecast: list[DayBalance], taw_mm: float | None, rule: SuKurali, now: DayBalance | None = None) -> str:
    """Su sekmesi karar cümlesi (ön değer): kök bölgesi doluluğu + 7 günlük tahminle kovanın tükenmesi."""
    state = classify_fill(fill, rule)
    if state == "bilinmiyor":
        return "Kök bölgesi nemi için yeterli veri yok; durum değerlendirilemiyor."
    usable = [d for d in forecast if not d.veri_eksik]
    if taw_mm is None or taw_mm <= 0 or not usable:
        return {"nemli": "Kök bölgesi normale göre nemli.", "orta": "Kök bölgesi normale göre orta nemde.", "kuru": "Kök bölgesi normale göre kuru."}[state] + " Önümüzdeki günler için su dengesi hesaplanamadı."
    worst = max(d.tukenme_mm for d in usable)
    raw = rule.tukenme_orani * taw_mm
    days = len(forecast)
    if now is not None and not now.veri_eksik and now.tukenme_mm >= raw:
        return "Kök bölgesi kuru; kullanılabilir su stres eşiğinin altında: sulama planlayın." if state == "kuru" else "Kullanılabilir su stres eşiğinin altında (normale göre doluluk yüksek olsa da): sulama planlayın."
    if state == "kuru" or worst >= raw:
        return f"Kök bölgesi {'kuru' if state == 'kuru' else 'kuruyor'}; önümüzdeki {days} gün içinde kullanılabilir su stres eşiğine iniyor: sulama planlayın."
    if state == "nemli":
        return f"Kök bölgesi nemli; önümüzdeki {days} gün sulama gerekmiyor."
    return f"Kök bölgesi orta nemde; önümüzdeki {days} gün sulama gerekmiyor, durumu izleyin."


@dataclass(frozen=True)
class ThermalPoint:
    tarih: date
    yuzey_bahce_c: float
    yuzey_tampon_c: float | None
    hava_c: float | None
    fark_c: float | None  # yüzey (bahçe) − hava
    stres: bool | None
    karisik_piksel: bool | None
    bahce_tampon_fark_c: float | None


def thermal_point(day: date, garden_c: float, buffer_c: float | None, air_c: float | None, rule: SuKurali) -> ThermalPoint:
    """Yüzey–hava sıcaklık farkı ve işaretler. Hava yoksa fark/stres None; tampon yoksa karışık piksel None (bilinmiyor)."""
    diff = None if air_c is None else garden_c - air_c
    gap = None if buffer_c is None else garden_c - buffer_c
    return ThermalPoint(
        day, garden_c, buffer_c, air_c, diff, None if diff is None else diff > rule.yuzey_hava_stres_c, None if gap is None else abs(gap) >= rule.karisik_piksel_c, gap
    )


# ----------------------------------------------------------------------------- yağış kaynağı seçimi (ERA5 ↔ IMERG)
MIN_DAYS_PER_MONTH = 25
MIN_MONTHS = 6
SYSTEMATIC_RATIO = 1.25  # ERA5 / IMERG bu orandan büyük ve ayların çoğunda tekrarlanıyorsa fark sistematik sayılır


@dataclass(frozen=True)
class MonthlyRain:
    yil: int
    ay: int
    era5_mm: float
    imerg_mm: float
    gun: int

    @property
    def oran(self) -> float | None:
        return self.era5_mm / self.imerg_mm if self.imerg_mm >= 5.0 else None  # çok kurak ayda oran anlamsız


def monthly_rain(era5: dict[date, float], imerg: dict[date, float]) -> list[MonthlyRain]:
    """Her iki kaynağın da değeri olan günlerden aylık toplamlar (en az 25 ortak gün olan aylar)."""
    by_month: dict[tuple[int, int], list[date]] = {}
    for d in sorted(set(era5) & set(imerg)):
        by_month.setdefault((d.year, d.month), []).append(d)
    return [
        MonthlyRain(y, m, sum(era5[d] for d in days), sum(imerg[d] for d in days), len(days))
        for (y, m), days in sorted(by_month.items())
        if len(days) >= MIN_DAYS_PER_MONTH
    ]


def choose_rain_source(months: list[MonthlyRain]) -> tuple[str, str]:
    """(kaynak, gerekçe): fark SİSTEMATİKSE (medyan ERA5/IMERG ≥ 1,25 ve ayların ≥ %60'ında oran ≥ 1,25) geçmiş yağış IMERG'den; değilse ERA5."""
    ratios = [m.oran for m in months if m.oran is not None]
    if len(ratios) < MIN_MONTHS:
        return "era5", f"IMERG ile karşılaştırma için yeterli ay yok ({len(ratios)}/{MIN_MONTHS}): ERA5 kalır."
    median = float(np.median(ratios))
    share = sum(1 for r in ratios if r >= SYSTEMATIC_RATIO) / len(ratios)
    if median >= SYSTEMATIC_RATIO and share >= 0.6:
        return "imerg", f"ERA5 yağışı IMERG'den sistematik yüksek (aylık oran medyanı {median:.2f}, ayların %{round(100 * share)}'ında ≥ {SYSTEMATIC_RATIO}): geçmiş yağış IMERG'den."
    return "era5", f"ERA5–IMERG farkı sistematik değil (oran medyanı {median:.2f}, ayların %{round(100 * share)}'ı ≥ {SYSTEMATIC_RATIO}): ERA5 kalır."
