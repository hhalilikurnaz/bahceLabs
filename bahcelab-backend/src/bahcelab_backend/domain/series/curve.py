"""Kesintisiz canlılık eğrisi (SAF, ADR 0018): gözlemlerden (Sentinel-2 + HLS bahçe NDVI ortancası) günlük seri.

· Ağırlıklı Whittaker yumuşatma (ikinci fark cezası): gözlem günleri kalite ağırlığıyla, gözlemsiz günler ağırlık 0 ile eğriye girer.
· Belirsizlik bandı: artık dağılımından (1,4826·MAD) türetilen %90 yaklaşık bant, en yakın gözleme uzaklıkla genişler (sezgisel; istatistiksel aralık değil).
· Gözlemden uzak günler «tahmini» işaretlenir; son gözlemden sonra yalnız sınırlı gün uzatılır.
· Radar NDVI üretmez: yalnız optik gözlemin olmadığı BOŞLUKLARDA geçişin «değişim var / yok» işareti verilir.
Kademe bu seriye değil gerçek gözleme dayanır.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

import numpy as np
from scipy.sparse import diags, identity
from scipy.sparse.linalg import spsolve

from bahcelab_backend.domain.agro.catalog import EgriKurali


@dataclass(frozen=True)
class Obs:
    tarih: date
    deger: float
    agirlik: float  # kaynak ağırlığı × geçerli piksel oranı (0–1)
    kaynak: str  # s2 | hls


@dataclass(frozen=True)
class CurvePoint:
    tarih: date
    deger: float
    alt: float
    ust: float
    tahmini: bool  # en yakın gözlem `gozlem_yakin_gun`'den uzak


@dataclass(frozen=True)
class RadarMark:
    tarih: date
    degisim: bool  # True: anlamlı ani değişim adayı var; False: yok


def combine_by_day(observations: list[Obs]) -> dict[date, tuple[float, float]]:
    """Aynı günün gözlemlerini ağırlıklı ortalamayla birleştirir: gün → (değer, toplam ağırlık ≤ 1). Ağırlığı sıfır olan atlanır."""
    acc: dict[date, list[float]] = {}
    for o in observations:
        if o.agirlik > 0 and np.isfinite(o.deger):
            cell = acc.setdefault(o.tarih, [0.0, 0.0])
            cell[0] += o.deger * o.agirlik
            cell[1] += o.agirlik
    return {d: (v / w, min(1.0, w)) for d, (v, w) in acc.items()}


def whittaker(y: np.ndarray, w: np.ndarray, lam: float) -> np.ndarray:
    """Ağırlıklı Whittaker yumuşatıcı (d = 2): (W + λ DᵀD) z = W y. Ağırlığı 0 olan günler komşulardan doğrusal-benzeri doldurulur."""
    n = len(y)
    if n < 3:
        return y.copy()
    d = diags([1.0, -2.0, 1.0], [0, 1, 2], shape=(n - 2, n))
    system = diags(w) + lam * (d.T @ d) + 1e-9 * identity(n)
    return np.asarray(spsolve(system.tocsc(), w * y))


def build_curve(observations: list[Obs], start: date, end: date, rule: EgriKurali) -> tuple[list[CurvePoint], float]:
    """[start, end] için günlük eğri. Gözlem 3'ten azsa eğri yoktur (uydurma yok). Dönüş: (noktalar, artık sigması)."""
    by_day = combine_by_day(observations)
    if len(by_day) < 3:
        return [], 0.0
    days_sorted = sorted(by_day)
    first, last = days_sorted[0], days_sorted[-1]
    lo = max(start, first)
    hi = min(end, last + timedelta(days=rule.ekstrapolasyon_azami_gun))
    if hi < lo:
        return [], 0.0
    # Yumuşatma gözlemlerin tüm aralığında yapılır; çıktı [lo, hi] ile sınırlanır (kenar etkisi için tam seri)
    grid_start, grid_end = first, max(hi, last)
    n = (grid_end - grid_start).days + 1
    y, w = np.zeros(n), np.zeros(n)
    obs_idx = []
    for d, (value, weight) in by_day.items():
        i = (d - grid_start).days
        y[i], w[i] = value, weight
        obs_idx.append(i)
    z = whittaker(y, w, rule.lambda_)
    idx = np.array(sorted(obs_idx))
    resid = y[idx] - z[idx]
    sigma = max(1.4826 * float(np.median(np.abs(resid - np.median(resid)))), rule.sigma_taban)
    distance = np.min(np.abs(np.arange(n)[:, None] - idx[None, :]), axis=1)
    half = rule.belirsizlik_z * sigma * np.sqrt(1.0 + (distance / rule.belirsizlik_tau_gun) ** 2)
    points: list[CurvePoint] = []
    for i in range((lo - grid_start).days, (hi - grid_start).days + 1):
        value = float(np.clip(z[i], -0.2, 1.0))
        points.append(CurvePoint(grid_start + timedelta(days=i), value, float(np.clip(value - half[i], -0.2, 1.0)), float(np.clip(value + half[i], -0.2, 1.0)), bool(distance[i] > rule.gozlem_yakin_gun)))
    return points, sigma


def radar_marks(radar_days: list[date], change_days: set[date], optical_days: list[date], end: date, rule: EgriKurali) -> list[RadarMark]:
    """Optik gözlem boşluklarında (ardışık iki optik gözlem ya da son gözlem–bugün arası > `radar_bosluk_gun`) radar geçişi başına değişim var/yok işareti."""
    optical = sorted(set(optical_days))
    gaps: list[tuple[date, date]] = []
    for a, b in zip(optical, optical[1:], strict=False):
        if (b - a).days > rule.radar_bosluk_gun:
            gaps.append((a, b))
    if optical and (end - optical[-1]).days > rule.radar_bosluk_gun:
        gaps.append((optical[-1], end + timedelta(days=1)))
    marks = [RadarMark(d, d in change_days) for d in sorted(set(radar_days)) if any(a < d < b for a, b in gaps)]
    return marks
