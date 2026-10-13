"""Sulama önerisi (SAF): ETc = ET₀ × Kc − etkili yağış. Çıktı yaklaşık öneridir, sulama reçetesi değildir."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from bahcelab_backend.domain.agro.catalog import stage_window
from bahcelab_backend.domain.agro.rulebook import EtkiliYagis, SulamaKurallari


@dataclass(frozen=True)
class DayInput:
    tarih: date
    et0_mm: float | None
    yagis_mm: float | None


@dataclass(frozen=True)
class StageKc:
    """Bahçenin (düzeltmeler dahil) etkin evre penceresi: AA-GG aralığı ve Kc."""

    kod: str
    baslangic: str
    bitis: str
    kc: float


def effective_rain(rain_mm: float | None, rule: EtkiliYagis) -> float:
    """Küçük yağışlar sayılmaz, kalanın bir oranı etkilidir, günlük üst sınır uygulanır."""
    if rain_mm is None or rain_mm < rule.kucuk_yagis_esigi_mm:
        return 0.0
    return min(rain_mm * rule.oran, rule.gunluk_ust_sinir_mm)


def kc_for_date(stages: list[StageKc], day: date, season_start: str = "10-01") -> float | None:
    sm, sd = (int(p) for p in season_start.split("-"))
    season_year = day.year if (day.month, day.day) >= (sm, sd) else day.year - 1
    for stage in stages:
        start, end = stage_window(stage.baslangic, stage.bitis, season_year, season_start)
        if start <= day <= end:
            return stage.kc
    return None


@dataclass(frozen=True)
class Window:
    gun: int
    etc_mm: float
    etkili_yagis_mm: float
    net_mm: float  # ETc − etkili yağış (pozitif = su açığı / ihtiyaç)
    eksik_gun: int


def window(days: list[DayInput], stages: list[StageKc], rule_rain: EtkiliYagis) -> Window | None:
    """Verisi olan günlerin ETc ve etkili yağış toplamı; ET₀ ya da Kc olmayan gün sayılmaz (eksik_gun)."""
    etc = rain = 0.0
    used = missing = 0
    for d in days:
        kc = kc_for_date(stages, d.tarih)
        if d.et0_mm is None or kc is None:
            missing += 1
            continue
        etc += d.et0_mm * kc
        rain += effective_rain(d.yagis_mm, rule_rain)
        used += 1
    if used == 0:
        return None
    return Window(used, round(etc, 1), round(rain, 1), round(etc - rain, 1), missing)


@dataclass(frozen=True)
class IrrigationResult:
    gecmis: Window | None
    gelecek: Window | None
    ihtiyac_mm: float | None  # önümüzdeki günlerin net ihtiyacı (≥ 0)
    brut_ihtiyac_mm: float | None  # sistem verimliliğine bölünmüş; sistem yoksa None
    ton_dekar: float | None
    toplam_ton: float | None
    sistem: str | None
    verimlilik: float | None
    gerekli: bool
    cumle: str
    kaynak: str = "hava"  # hava: yalnız hava verisiyle yaklaşık hesap · su: Su sekmesindeki TEK karar (toprak nemi + su dengesi)


def recommend(
    past: list[DayInput],
    future: list[DayInput],
    stages: list[StageKc],
    rules: SulamaKurallari,
    *,
    dekar: float,
    system: str | None,
) -> IrrigationResult:
    p = window(past, stages, rules.etkili_yagis)
    f = window(future, stages, rules.etkili_yagis)
    info = rules.sulama_sistemleri.sistemler.get(system or "")
    efficiency = info.verimlilik if info else None
    need = max(0.0, f.net_mm) if f else None
    gross = round(need / efficiency, 1) if need is not None and efficiency else None
    per = rules.hesap.mm_basina_ton_dekar
    ton_da = round((gross if gross is not None else need) * per, 1) if need is not None else None
    total = round(ton_da * dekar, 1) if ton_da is not None else None
    required = need is not None and need >= rules.hesap.ihtiyac_esigi_mm
    if f is None:
        sentence = "Su ihtiyacı için yeterli hava ya da evre verisi yok."
    elif not required:
        sentence = "Önümüzdeki günler için ek sulama ihtiyacı görünmüyor (yaklaşık öneri)."
    else:
        shown = gross if gross is not None else need
        suffix = "" if gross is not None else " (sulama sistemi seçilmediğinden verimlilik uygulanmadı)"
        sentence = (
            f"Önümüzdeki {f.gun} gün için yaklaşık {shown:g} mm (≈ {ton_da:g} ton/dekar) su ihtiyacı görünüyor{suffix}; yaklaşık öneridir."
        )
    return IrrigationResult(p, f, need, gross, ton_da, total, system, efficiency, required, sentence)
