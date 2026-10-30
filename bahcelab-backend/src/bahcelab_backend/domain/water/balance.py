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
    yagis_mm: float  # ham yağış (grafikte gösterilir)
    etc_mm: float
    etkili_yagis_mm: float  # dengede SAYILAN yağış: günlük eşiğin (katalog, ön değer 2 mm) altı 0
    tukenme_mm: float  # kök bölgesi su eksiği (0 = tarla kapasitesi, TAW = solma noktası)
    kullanilabilir_mm: float  # TAW − tükenme
    birikimli_mm: float  # birikimli (yağış − ETc), pencere başından
    tahmin: bool
    veri_eksik: bool  # yağış, ET0 ya da Kc eksikse gün sayılmaz (kova değişmez)


def effective_rain(rain_mm: float, min_rain_mm: float) -> float:
    """Etkili yağış: günlük yağış eşiğin altındaysa kök bölgesine ulaşmadan buharlaşır, sayılmaz (ön değer 2 mm)."""
    return rain_mm if rain_mm >= min_rain_mm else 0.0


def simulate(days: list[DayInput], taw_mm: float, initial_depletion_mm: float, min_rain_mm: float = 0.0) -> list[DayBalance]:
    """Günlük kova: Dr_t = clamp(Dr_{t−1} − P_etkili + ETc, 0, TAW). Sulama kaydı yoktur (yalnız yağış ve ETc); taşan su (Dr < 0) derin sızıntı sayılır.

    Veri eksik gün (yağış/ET0/Kc None): kova ve birikimli değişmez, `veri_eksik=True` — eksik değer uydurulmaz.
    """
    out: list[DayBalance] = []
    dr = min(max(initial_depletion_mm, 0.0), taw_mm)
    cumulative = 0.0
    for day in days:
        etc = etc_mm(day.et0_mm, day.kc)
        if day.yagis_mm is None or etc is None:
            out.append(DayBalance(day.tarih, 0.0, 0.0, 0.0, dr, taw_mm - dr, cumulative, day.tahmin, True))
            continue
        eff = effective_rain(day.yagis_mm, min_rain_mm)
        dr = min(taw_mm, max(0.0, dr - eff + etc))
        cumulative += eff - etc
        out.append(DayBalance(day.tarih, day.yagis_mm, etc, eff, dr, taw_mm - dr, cumulative, day.tahmin, False))
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


def root_zone_fill(layer_values: list[float | None], clims: list[Climatology], weights: tuple[float, float, float, float]) -> float | None:
    """Kök bölgesi (0–100 cm = ilk 3 katman) doluluğu: katman doluluklarının kalınlık ağırlıklı ortalaması; hiçbir katman yoksa None."""
    total = acc = 0.0
    for value, clim, w in zip(layer_values, clims, weights, strict=True):
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


TR_AYLAR = ("Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık")


@dataclass(frozen=True)
class IrrigationDecision:
    """TEK sulama kararı (Hava ve Su sekmeleri aynısını gösterir). durum: sulama | izle | gerekmiyor | veri_yok."""

    durum: str
    gerekli: bool
    cumle: str
    doluluk: float | None  # mevsim normaline göre kök bölgesi doluluğu %
    donem: str | None  # «Ekim»
    ihtiyac_mm: float | None  # gerekliyse: tarla kapasitesine dönmek için su açığı (mm), yoksa None


def irrigation_decision(fill: float | None, ref_day: date | None, forecast: list[DayBalance], now: DayBalance | None, taw_mm: float | None, rule: SuKurali) -> IrrigationDecision:
    """Sulama kararı (ön değer · mühendis onayı bekliyor): mevsim normaline göre doluluk ve su dengesi AÇIĞI birlikte aranır.

    «Sulama planlayın» yalnız ikisi birlikte varsa çıkar: doluluk mevsim normaline göre düşük (≤ kuru eşiği) VE kova stres eşiğinde ya da 7 gün içinde ona iniyor.
    Tek göstergenin düşük olması «izleyin» der; mutlak «kuru» sözü normale göre düşük olmayan yerde kurulmaz.
    """
    state = classify_fill(fill, rule)
    if state == "bilinmiyor" or fill is None or ref_day is None:
        return IrrigationDecision("veri_yok", False, "Kök bölgesi nemi için yeterli veri yok; durum değerlendirilemiyor.", None, None, None)
    donem = TR_AYLAR[ref_day.month - 1]
    pct = f"%{round(fill)}"
    base = f"{donem} normaline göre"
    usable = [d for d in forecast if not d.veri_eksik]
    if taw_mm is None or taw_mm <= 0 or not usable:
        return IrrigationDecision("izle", False, f"Kök bölgesi {base} {pct} dolu; su dengesi hesaplanamadığından sulama kararı verilemiyor, durumu izleyin.", fill, donem, None)
    raw = rule.tukenme_orani * taw_mm
    worst = max(d.tukenme_mm for d in usable)
    days = len(forecast)
    deficit_now = now is not None and not now.veri_eksik and now.tukenme_mm >= raw
    deficit_soon = worst >= raw
    refill = round(max(worst, now.tukenme_mm if now is not None and not now.veri_eksik else 0.0), 1)
    if state == "kuru" and deficit_now:
        return IrrigationDecision("sulama", True, f"Kök bölgesi {base} kuru ({pct}) ve kullanılabilir su stres eşiğinin altında: sulama planlayın.", fill, donem, refill)
    if state == "kuru" and deficit_soon:
        return IrrigationDecision("sulama", True, f"Kök bölgesi {base} kuru ({pct}) ve önümüzdeki {days} gün içinde kullanılabilir su stres eşiğine iniyor: sulama planlayın.", fill, donem, refill)
    if state == "kuru":
        return IrrigationDecision("izle", False, f"Kök bölgesi {base} düşük ({pct}); su dengesi açık vermiyor, şimdilik sulama gerekmiyor, durumu izleyin.", fill, donem, None)
    if deficit_now or deficit_soon:
        return IrrigationDecision("izle", False, f"Su dengesi açığa {'indi' if deficit_now else 'yaklaşıyor'} ama kök bölgesi {base} {pct} dolu: sulama gerekmiyor, durumu izleyin.", fill, donem, None)
    if state == "nemli":
        return IrrigationDecision("gerekmiyor", False, f"Kök bölgesi {base} nemli ({pct}); önümüzdeki {days} gün sulama gerekmiyor.", fill, donem, None)
    return IrrigationDecision("gerekmiyor", False, f"Kök bölgesi {base} orta nemde ({pct}); önümüzdeki {days} gün sulama gerekmiyor, durumu izleyin.", fill, donem, None)


def reconcile_with_plan(decision: IrrigationDecision, next_irrigation: date | None, today: date, days: int) -> IrrigationDecision:
    """Sulama planı kurulu bir bahçede TEK hakem plandır (Su sekmesi, Hava ve Durum aynı cümleyi verir; ikisi çelişemez).

    Plan `days` gün içinde sulama öneriyorsa karar «sulama», önermiyorsa «sulama» olamaz (en fazla «izle»). Kova ikisinde de AYNI hesaptır;
    fark yalnız eşiktedir (plan: sistem tetiği, durum cümlesi: RAW + mevsim normu).
    """
    if decision.durum == "veri_yok":
        return decision
    soon = next_irrigation is not None and 0 <= (next_irrigation - today).days <= days
    base = f"{decision.donem} normaline göre" if decision.donem else "Normale göre"
    pct = "" if decision.doluluk is None else f" %{round(decision.doluluk)} dolu"
    if soon and decision.durum != "sulama":
        return IrrigationDecision("sulama", True, f"Kök bölgesi {base}{pct}; kullanılabilir su sulama eşiğine yaklaştı, sulama planı {next_irrigation.day}.{next_irrigation.month:02d} için sulama öneriyor.", decision.doluluk, decision.donem, decision.ihtiyac_mm)  # type: ignore[union-attr]
    if not soon and decision.durum == "sulama":
        return IrrigationDecision("izle", False, f"Kök bölgesi {base}{pct}; sulama planı önümüzdeki {days} gün sulama önermiyor, durumu izleyin.", decision.doluluk, decision.donem, None)
    return decision


@dataclass(frozen=True)
class ThermalNormal:
    """Bahçenin AYNI AY Landsat geçmişinde yüzey − hava farkının p25 / ortanca / p75 değeri."""

    alt: float
    ortanca: float
    ust: float
    sahne: int
    p10: float = 0.0
    p90: float = 0.0


def thermal_normal(history: list[tuple[date, float]], day: date, rule: SuKurali) -> ThermalNormal | None:
    """`history`: (tarih, yüzey − hava). Aynı takvim ayındaki, bu sahne HARİÇ geçmiş sahnelerden bant; en az `sicaklik_min_sahne` sahne yoksa None (yetersiz geçmiş)."""
    diffs = [d for t, d in history if t.month == day.month and t != day]
    if len(diffs) < rule.sicaklik_min_sahne:
        return None
    p10, lo, mid, hi, p90 = np.percentile(diffs, [rule.sicaklik_belirgin_alt, rule.sicaklik_normal_alt, 50.0, rule.sicaklik_normal_ust, rule.sicaklik_belirgin_ust])
    return ThermalNormal(float(lo), float(mid), float(hi), len(diffs), float(p10), float(p90))


@dataclass(frozen=True)
class ThermalPoint:
    tarih: date
    yuzey_bahce_c: float
    yuzey_tampon_c: float | None
    hava_c: float | None
    fark_c: float | None  # yüzey (bahçe) − hava
    bahce_tampon_fark_c: float | None
    karisik_piksel: bool | None
    normal: ThermalNormal | None
    sapma_c: float | None  # fark − dönem ortancası
    durum: str  # ustunde | icinde | altinda | yetersiz_gecmis | bilinmiyor
    stres: bool | None  # YALNIZ bandın üstünde VE karışık piksel değilken; tampon bilinmiyorsa None
    ay: str


def thermal_point(day: date, garden_c: float, buffer_c: float | None, air_c: float | None, normal: ThermalNormal | None, rule: SuKurali) -> ThermalPoint:
    """Yüzey–hava farkı, bahçenin aynı ay bandına göre durumu ve stres/karışık işaretleri. Sabit eşik yoktur."""
    diff = None if air_c is None else garden_c - air_c
    gap = None if buffer_c is None else garden_c - buffer_c
    mixed = None if gap is None else abs(gap) >= rule.karisik_piksel_c
    month = TR_AYLAR[day.month - 1]
    if diff is None:
        return ThermalPoint(day, garden_c, buffer_c, air_c, None, gap, mixed, normal, None, "bilinmiyor", None, month)
    if normal is None:
        return ThermalPoint(day, garden_c, buffer_c, air_c, diff, gap, mixed, None, None, "yetersiz_gecmis", None, month)
    status = "ustunde" if diff > normal.ust else "altinda" if diff < normal.alt else "icinde"
    stress = None if mixed is None else (status == "ustunde" and not mixed)
    return ThermalPoint(day, garden_c, buffer_c, air_c, diff, gap, mixed, normal, diff - normal.ortanca, status, stress, month)


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


def monthly_rain(era5: dict[date, float], imerg: dict[date, float], min_rain_mm: float = 0.0) -> list[MonthlyRain]:
    """Her iki kaynağın da değeri olan günlerden aylık toplamlar (en az 25 ortak gün olan aylar). `min_rain_mm`: etkili yağış eşiği (günlük değer altında 0 sayılır)."""
    by_month: dict[tuple[int, int], list[date]] = {}
    for d in sorted(set(era5) & set(imerg)):
        by_month.setdefault((d.year, d.month), []).append(d)
    return [
        MonthlyRain(y, m, sum(effective_rain(era5[d], min_rain_mm) for d in days), sum(effective_rain(imerg[d], min_rain_mm) for d in days), len(days))
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
