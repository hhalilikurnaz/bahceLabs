"""Radar değişim değerlendirmesi (SAF, ADR 0016): ani değişim + kalıcı sapma → olay adayı ya da gürültü.

Ani değişim: bir sahnenin VH dB ızgarası, AYNI yörüngedeki önceki N sahnenin piksel ortancasıyla karşılaştırılır (log-oran = dB farkı);
fark ızgarası küçük bir pencerede ortalanır (kumlanma gürültüsü eşiği yanlışlıkla aşmasın).
Alan payı = |Δ| eşiğini aşan, baskın yöndeki piksellerin geçerli piksellere oranı; büyüklük = o piksellerin Δ ortancası.
Kalıcı sapma: sahnenin bahçe ortalaması (dB) o ayın normal bandına (birincil yörünge) göre konumlanır.
Olay adayı = anlamlı ani değişim VE (kalıcı sapma bant DIŞINDA ve aynı yönde  YA DA aynı yönde art arda ≥ K sahne). Aksi hâlde «gürültü».
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

import numpy as np
from scipy.ndimage import uniform_filter

PIXEL_M2 = 100.0  # 10 m piksel
AZALIS, ARTIS = "azalis", "artis"
ADAY, GURULTU = "aday", "gurultu"
BANT_ALTI, BANT_USTU, BANT_ICI, BANT_YOK = "alt", "ust", "bant_ici", "bant_yok"


@dataclass(frozen=True)
class ChangeRule:
    anlamli_degisim_db: float
    anlamli_alan_orani: float
    baseline_sahne: int
    art_arda_sahne: int
    yumusatma: int = 1  # piksel farkı bu boyutlu pencerede ortalanır (kumlanma gürültüsü eşiği yanlışlıkla aşmasın); 1 = kapalı
    alan_min_m2: float = 0.0  # 0 = yalnız pay kuralı; >0: eşiği aşan alan en az bu kadar m² (1 da = 1000 m²)
    birlesim: str = "veya"  # pay ile mutlak alan: veya | ve


@dataclass(frozen=True)
class BandLimits:
    """Normal bandın dış sınırı: p10–p90 (yeterliyse) ya da p25–p75."""

    alt: float
    ust: float


@dataclass(frozen=True)
class SceneSample:
    tarih: date
    scene_id: str
    vh_db: np.ndarray  # Lee filtreli VH dB ızgarası (bahçe dışı/geçersiz NaN)
    bahce_ortalama_db: float  # ham doğrusal ortalamadan dB
    bant: BandLimits | None  # sahnenin ayının normal bandı (yoksa None)


@dataclass(frozen=True)
class ChangeResult:
    tarih: date
    scene_id: str
    durum: str  # aday | gurultu
    isaret: str  # azalis | artis
    alan_orani: float
    buyukluk_db: float  # imzalı, aşan piksellerin ortancası
    bahce_delta_db: float  # bahçe ortalaması − baseline bahçe ortalaması (bilgi)
    kalici_sapma: str  # alt | ust | bant_ici | bant_yok
    art_arda: bool
    alan_pikseli: int



def smooth_delta(delta: np.ndarray, window: int) -> np.ndarray:
    """Fark ızgarasını geçerli komşu ortalamasıyla yumuşatır (NaN'lar sayılmaz, NaN kalır). `window ≤ 1`: değişmez."""
    if window <= 1:
        return delta
    valid = np.isfinite(delta)
    total = uniform_filter(np.where(valid, delta, 0.0), size=window, mode="nearest")
    count = uniform_filter(valid.astype(np.float64), size=window, mode="nearest")
    with np.errstate(divide="ignore", invalid="ignore"):
        out = np.where(count > 0, total / count, np.nan)
    return np.where(valid, out, np.nan)


def pixel_change(current: np.ndarray, baseline: np.ndarray, rule: ChangeRule) -> tuple[str, float, float, int] | None:
    """(yön, alan payı, büyüklük dB, piksel sayısı); anlamlı değilse None."""
    delta = smooth_delta(current - baseline, rule.yumusatma)
    valid = np.isfinite(delta)
    n = int(valid.sum())
    if n == 0:
        return None
    thr = rule.anlamli_degisim_db
    down, up = valid & (delta <= -thr), valid & (delta >= thr)
    sign, mask = (AZALIS, down) if down.sum() >= up.sum() else (ARTIS, up)
    share = float(mask.sum()) / n
    pay_tamam = share >= rule.anlamli_alan_orani
    alan_tamam = rule.alan_min_m2 > 0 and float(mask.sum()) * PIXEL_M2 >= rule.alan_min_m2
    if rule.alan_min_m2 <= 0:
        gecerli = pay_tamam
    else:
        gecerli = (pay_tamam and alan_tamam) if rule.birlesim == "ve" else (pay_tamam or alan_tamam)
    if not gecerli:
        return None
    return sign, share, float(np.median(delta[mask])), int(mask.sum())


def _position(mean_db: float, band: BandLimits | None) -> str:
    if band is None:
        return BANT_YOK
    return BANT_ALTI if mean_db < band.alt else BANT_USTU if mean_db > band.ust else BANT_ICI


def evaluate_series(samples: list[SceneSample], rule: ChangeRule) -> list[ChangeResult]:
    """Aynı yörüngenin tarih sıralı uygun sahneleri → anlamlı ani değişimi olan sahneler için aday/gürültü sonuçları."""
    ordered = sorted(samples, key=lambda s: s.tarih)
    results: list[ChangeResult] = []
    previous_signs: list[str | None] = []  # her sahne için anlamlı yön (yoksa None)
    for i, scene in enumerate(ordered):
        if i < rule.baseline_sahne:
            previous_signs.append(None)
            continue
        window = ordered[i - rule.baseline_sahne : i]
        baseline = np.nanmedian(np.stack([w.vh_db for w in window]), axis=0)
        change = pixel_change(scene.vh_db, baseline, rule)
        if change is None:
            previous_signs.append(None)
            continue
        sign, share, size, pixels = change
        previous_signs.append(sign)
        run = 1
        for back in range(i - 1, -1, -1):
            if previous_signs[back] == sign:
                run += 1
            else:
                break
        position = _position(scene.bahce_ortalama_db, scene.bant)
        outside = (sign == AZALIS and position == BANT_ALTI) or (sign == ARTIS and position == BANT_USTU)
        consecutive = run >= rule.art_arda_sahne
        base_mean = float(np.nanmean(baseline)) if np.isfinite(baseline).any() else float("nan")
        results.append(
            ChangeResult(
                tarih=scene.tarih, scene_id=scene.scene_id, durum=ADAY if (outside or consecutive) else GURULTU, isaret=sign, alan_orani=round(share, 4),
                buyukluk_db=round(size, 2), bahce_delta_db=round(scene.bahce_ortalama_db - base_mean, 2), kalici_sapma=position, art_arda=consecutive, alan_pikseli=pixels,
            )
        )
    return results


def wet_note(daily_rain_mm: list[float | None], threshold_mm: float) -> tuple[bool | None, float | None]:
    """Önceki ~48 saatin günlük yağışlarından «ıslaklık olabilir». Hiç veri yoksa (None, None): bilinmiyor, uydurma yok."""
    known = [v for v in daily_rain_mm if v is not None]
    if not known:
        return None, None
    total = round(sum(known), 1)
    return total >= threshold_mm, total


def event_confidence(durum: str, islaklik_olabilir: bool | None) -> str:
    """Olay adayının güveni: «ıslaklık olabilir» notlu aday düşük güvenlidir (9F bunu bildirime çevirmez); gürültü kaydında güven anlamsız (normal)."""
    return "dusuk" if durum == ADAY and islaklik_olabilir else "normal"
