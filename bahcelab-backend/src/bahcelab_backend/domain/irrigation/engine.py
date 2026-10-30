"""Sulama planı motoru (ADR 0023): FAO-56 günlük su dengesi, SAF fonksiyonlar. Hiçbir katsayı kodda değil: hepsi katalogda (`sulama_plani`, ön değer · mühendis onayı bekliyor).

ETc = ET0 × Kc(ay, taç örtüsü); Dr_t = clamp(Dr_{t−1} − P_etkili − Sulama_net + ETc, 0, TAW); Dr ≥ RAW ise sulama (net = Dr × oran, brüt = net / sistem verimi).
Eksik veri (yağış/ET0 None) uydurulmaz: kova o gün değişmez, `veri_eksik=True`.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, timedelta

import numpy as np

from bahcelab_backend.domain.agro.catalog import KisitliSulamaDonemi, SulamaPlaniKurali


# ----------------------------------------------------------------------------- Kc ve taç örtüsü
def canopy_cover_from_ndvi(ndvi: float | None, rule: SulamaPlaniKurali) -> float | None:
    """Taç örtüsü fc (%): ((NDVI − alt)/(üst − alt))^üs, [0, 100]'e kırpılır (Carlson & Ripley 1997). NDVI yoksa None."""
    if ndvi is None or not np.isfinite(ndvi):
        return None
    t = min(1.0, max(0.0, (ndvi - rule.orten_ndvi_alt) / (rule.orten_ndvi_ust - rule.orten_ndvi_alt)))
    return float(100.0 * t**rule.orten_ndvi_us)


def _stage_kc(cover_pct: float, rule: SulamaPlaniKurali) -> tuple[float, float, float]:
    """Taç örtüsü sınıfları (20/50/70) arasında doğrusal; sınıfların dışında en yakın sınıf (aşırı genişletme yok)."""
    xs = rule.kc_orten_siniflari
    cover = min(max(cover_pct, xs[0]), xs[-1])
    cols = [[rule.kc_tablo[str(int(c))][i] for c in xs] for i in range(3)]
    return (float(np.interp(cover, xs, cols[0])), float(np.interp(cover, xs, cols[1])), float(np.interp(cover, xs, cols[2])))


def kc_monthly(month: int, cover_pct: float, rule: SulamaPlaniKurali) -> float:
    """Aylık Kc = Σ evre ağırlığı × Kc[evre] (başlangıç/orta/son)."""
    w = rule.kc_ay_agirliklari[month - 1]
    kc = _stage_kc(cover_pct, rule)
    return float(sum(wi * ki for wi, ki in zip(w, kc, strict=True)))


# ----------------------------------------------------------------------------- toprak kovası
def taw_raw_mm(fc: float, wp: float, root_cm: float, p: float) -> tuple[float, float]:
    """TAW = 1000 (θFC − θWP) Zr (FAO-56 Denk. 82), RAW = p × TAW (Denk. 83). Zr metre."""
    taw = 1000.0 * (fc - wp) * (root_cm / 100.0)
    return taw, p * taw


def effective_rain_mm(rain_mm: float, rule: SulamaPlaniKurali) -> float:
    """Etkili yağış: günlük eşiğin altı sayılmaz; üstünün katalogdaki oranı kök bölgesine girer."""
    if rain_mm < rule.etkili_yagis_esik_mm:
        return 0.0
    return rain_mm * rule.etkili_yagis_oran


# ----------------------------------------------------------------------------- günlük kova ve plan
@dataclass(frozen=True)
class DayIn:
    tarih: date
    yagis_mm: float | None
    et0_mm: float | None
    tahmin: bool = False


@dataclass(frozen=True)
class DayOut:
    tarih: date
    yagis_mm: float
    etkili_yagis_mm: float
    et0_mm: float
    kc: float
    etc_mm: float
    uygulanan_net_mm: float  # kayıtlardan (uygulandı)
    planli_net_mm: float  # motorun önerdiği
    planli_brut_mm: float
    tukenme_mm: float  # gün sonu Dr
    stres: bool  # Dr > RAW
    tahmin: bool
    veri_eksik: bool


@dataclass(frozen=True)
class Policy:
    """Plan kuralı. `from_date` öncesinde motor sulama ÖNERMEZ (geçmiş yalnız uygulananlarla yürür). `oran` < 1 kısıntıdır: tüketimin yalnız o payı geri verilir, kalan stres kabul edilir."""

    from_date: date
    oran: Callable[[date], float] = lambda d: 1.0  # kısıntı: net = Dr × oran
    min_net_mm: float = 10.0


def run_bucket(
    days: list[DayIn], *, taw: float, raw: float, cover_pct: float, rule: SulamaPlaniKurali, efficiency: float, initial_dr: float,
    applied_net_mm: dict[date, float] | None = None, policy: Policy | None = None,
) -> list[DayOut]:
    applied_net_mm = applied_net_mm or {}
    dr = min(max(initial_dr, 0.0), taw)
    base = 0.0  # kısıntı: son sulamadan hemen sonraki Dr; bundan beri tüketilen (Dr − base) RAW'a ulaşınca sulanır, tüketimin yalnız `oran`ı geri verilir
    out: list[DayOut] = []
    for d in days:
        kc = kc_monthly(d.tarih.month, cover_pct, rule)
        applied = applied_net_mm.get(d.tarih, 0.0)
        if d.yagis_mm is None or d.et0_mm is None:
            out.append(DayOut(d.tarih, 0.0, 0.0, 0.0, kc, 0.0, applied, 0.0, 0.0, dr, dr > raw, d.tahmin, True))
            continue
        eff = effective_rain_mm(d.yagis_mm, rule)
        etc = d.et0_mm * kc
        dr = min(taw, max(0.0, dr - eff - applied + etc))
        planned_net = 0.0
        if policy is not None and d.tarih >= policy.from_date and applied == 0.0:
            ratio = policy.oran(d.tarih)
            if ratio >= 1.0:
                base = 0.0
                net = dr
            else:
                net = ratio * (dr - base)
            if dr - base >= raw and net >= policy.min_net_mm:
                planned_net = net
                dr -= net
                base = dr if ratio < 1.0 else 0.0
        out.append(DayOut(d.tarih, d.yagis_mm, eff, d.et0_mm, kc, etc, applied, planned_net, planned_net / efficiency, dr, dr > raw, d.tahmin, False))
    return out


# ----------------------------------------------------------------------------- ağaç başına litre ve süre
@dataclass(frozen=True)
class TreeWater:
    litre_agac: float
    emitor_dakika: int  # damlatıcıyı açık tutma süresi (dakika)


def per_tree(gross_mm: float, area_m2: float, trees: int | None, emitters_per_tree: int | None, emitter_lh: float | None) -> TreeWater | None:
    """Brüt mm (= L/m²) × ağaç başına düşen alan = ağaç başına litre. Ağaç sayısı ya da damlatıcı bilgisi eksikse None (uydurulmaz)."""
    if not trees or trees <= 0 or not emitters_per_tree or not emitter_lh or area_m2 <= 0:
        return None
    litres = gross_mm * area_m2 / trees
    return TreeWater(litres, round(litres / (emitters_per_tree * emitter_lh) * 60.0))


def tree_count_check(declared: int | None, area_m2: float, row_m: float | None, tree_m: float | None, tol: float) -> tuple[int | None, bool | None]:
    """(beklenen sayı, tutarlı mı). Aralık ya da beyan yoksa (None, None); tutarsızlık: |beyan − beklenen| / beklenen > tol."""
    if not row_m or not tree_m or area_m2 <= 0:
        return None, None
    expected = round(area_m2 / (row_m * tree_m))
    if not declared or expected <= 0:
        return expected, None
    return expected, abs(declared - expected) / expected <= tol


def soil_check(dr_bucket: float, dr_observed: float | None, threshold_mm: float) -> bool | None:
    """Kova ile uydu/ERA5-Land nemi arasındaki fark eşiği aşıyorsa True (uyarı); gözlem yoksa None."""
    return None if dr_observed is None else abs(dr_bucket - dr_observed) > threshold_mm


# ----------------------------------------------------------------------------- maliyet
@dataclass(frozen=True)
class CostInput:
    pompa_kw: float | None
    pompa_debi_m3h: float | None
    enerji: str  # sebeke | gunes | dizel
    kullanici_kwh_fiyat: float | None  # TL/kWh (şebeke)
    katalog_kwh_fiyat: float | None  # EPDK; None = doğrulanmamış
    kullanici_m3_maliyet: float | None  # dizel/güneş: TL/m³ (kullanıcı girer)
    su_ucreti_m3: float | None  # sulama birliği, isteğe bağlı


@dataclass(frozen=True)
class Cost:
    m3: float
    pompa_saat: float | None
    kwh: float | None
    enerji_tl: float | None
    su_ucreti_tl: float | None
    toplam_tl: float | None
    fiyat_kaynagi: str  # kullanici | katalog | yok
    eksik: str | None  # neden TL yok


def cost(m3: float, c: CostInput) -> Cost:
    fee = None if c.su_ucreti_m3 is None else m3 * c.su_ucreti_m3
    hours = kwh = None
    if c.pompa_kw and c.pompa_debi_m3h:
        hours = m3 / c.pompa_debi_m3h
        kwh = hours * c.pompa_kw
    if c.enerji == "sebeke":
        price, src = (c.kullanici_kwh_fiyat, "kullanici") if c.kullanici_kwh_fiyat is not None else (c.katalog_kwh_fiyat, "katalog" if c.katalog_kwh_fiyat is not None else "yok")
        if kwh is None:
            return Cost(m3, hours, None, None, fee, None, src, "Pompa gücü ve debisi girilmedi; kWh ve TL hesaplanamaz.")
        if price is None:
            return Cost(m3, hours, kwh, None, fee, None, "yok", "Tarife güncel değil; faturanızdaki birim fiyatı girin.")
        e = kwh * price
        return Cost(m3, hours, kwh, e, fee, e + (fee or 0.0), src, None)
    if c.kullanici_m3_maliyet is None:
        return Cost(m3, hours, kwh, None, fee, None, "yok", "Enerji maliyetinizi (TL/m³) girin.")
    e = m3 * c.kullanici_m3_maliyet
    return Cost(m3, hours, kwh, e, fee, e + (fee or 0.0), "kullanici", None)


# ----------------------------------------------------------------------------- sezon, projeksiyon, senaryolar
def in_season(d: date, rule: SulamaPlaniKurali) -> bool:
    s, e = rule.sezon_baslangic, rule.sezon_bitis
    key = f"{d.month:02d}-{d.day:02d}"
    return s <= key <= e if s <= e else key >= s or key <= e


def season_days(year: int, rule: SulamaPlaniKurali) -> list[date]:
    out, d = [], date(year, 1, 1)
    while d.year == year:
        if in_season(d, rule):
            out.append(d)
        d += timedelta(days=1)
    return out


def period_of(d: date, periods: list[KisitliSulamaDonemi]) -> KisitliSulamaDonemi | None:
    key = f"{d.month:02d}-{d.day:02d}"
    for p in periods:
        if (p.baslangic <= key <= p.bitis) if p.baslangic <= p.bitis else (key >= p.baslangic or key <= p.bitis):
            return p
    return None


def deficit_ratio_fn(rule: SulamaPlaniKurali) -> Callable[[date], float]:
    """Yalnız katalogda ONAYLI dönemde oran uygulanır; kilitli ya da dönem dışında 1,0 (tam plan)."""
    def f(d: date) -> float:
        p = period_of(d, rule.kisitli_donemler)
        return p.oran if p is not None and p.durum == "onayli" and p.oran else 1.0
    return f


def deficit_risk(rule: SulamaPlaniKurali, days: list[date]) -> str | None:
    """Kısıntının fiilen uygulandığı onaylı dönemlerin en yüksek verim riski; kısıntı uygulanacak gün yoksa None."""
    order = {"dusuk": 0, "orta": 1, "yuksek": 2}
    risks = [p.verim_riski for d in days if (p := period_of(d, rule.kisitli_donemler)) is not None and p.durum == "onayli"]
    return max(risks, key=lambda r: order[r]) if risks else None


@dataclass(frozen=True)
class SeasonTotal:
    brut_mm: float
    net_mm: float
    sulama_sayisi: int
    stres_gun: int


def season_total(rows: list[DayOut], rule: SulamaPlaniKurali, *, use_applied: bool = False) -> SeasonTotal:
    r = [x for x in rows if in_season(x.tarih, rule) and not x.veri_eksik]
    if use_applied:
        net = sum(x.uygulanan_net_mm for x in r)
        return SeasonTotal(0.0, net, sum(1 for x in r if x.uygulanan_net_mm > 0), sum(1 for x in r if x.stres))
    return SeasonTotal(sum(x.planli_brut_mm for x in r), sum(x.planli_net_mm for x in r), sum(1 for x in r if x.planli_net_mm > 0), sum(1 for x in r if x.stres))


def percentile_range(values: list[float], lo: float, hi: float) -> tuple[float, float, float] | None:
    """(p_alt, ortanca, p_üst); örnek yoksa None. Tek sayı değil ARALIK."""
    if len(values) < 3:
        return None
    a = np.percentile(values, [lo, 50, hi])
    return float(a[0]), float(a[1]), float(a[2])


def mm_to_m3(mm: float, area_m2: float) -> float:
    return mm * area_m2 / 1000.0


def habit_applied(days: list[date], weekdays: list[int], hours: float, trees: int, emitters: int, lh: float, area_m2: float, efficiency: float) -> dict[date, float]:
    """Alışkanlık: seçili hafta günlerinde `hours` saat. Brüt mm = saat × damlatıcı × L/sa × ağaç / alan; NET = brüt × verim (bucket'a net girer)."""
    gross_mm = hours * emitters * lh * trees / area_m2
    return {d: gross_mm * efficiency for d in days if d.weekday() in weekdays}


@dataclass(frozen=True)
class Payback:
    sezon: float | None  # yatırım / yıllık TL tasarrufu; tasarruf ≤ 0 ise None
    tasarruf_tl: float | None


def payback(install_cost_tl: float | None, saving_tl: float | None) -> Payback:
    if install_cost_tl is None or saving_tl is None or saving_tl <= 0:
        return Payback(None, saving_tl)
    return Payback(install_cost_tl / saving_tl, saving_tl)
