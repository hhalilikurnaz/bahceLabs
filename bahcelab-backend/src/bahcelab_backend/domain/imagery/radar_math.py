"""Radar (Sentinel-1 RTC γ⁰) matematiği (SAF, ağ yok): doğrusal ↔ dB, VH/VV, RVI, log-oran, geçerlilik maskesi, Lee filtresi.

Tüm dB↔doğrusal dönüşümleri YALNIZCA burada yapılır. Kural: görüntü (ızgara) Lee filtreli doğrusal değerlerden türetilir;
istatistikler ham (filtresiz) doğrusal değerlerin bahçe ortalamasıyla hesaplanır ve en son dB'ye çevrilir (filtre istatistiği bozmasın).
"""

from __future__ import annotations

import numpy as np
from scipy.ndimage import uniform_filter

RADAR_NODATA = -32768.0
INDICATORS = ("vh_db", "vv_db", "oran_db", "rvi")
FORMULA_VERSION = "s1rtc-gamma0-v1+lee5"


def to_db(linear: np.ndarray | float) -> np.ndarray:
    """Doğrusal güç → dB (10·log10). Sıfır ve negatif değerler NaN olur (log tanımsız)."""
    arr = np.asarray(linear, dtype=np.float64)
    with np.errstate(divide="ignore", invalid="ignore"):
        out = np.where(arr > 0, 10.0 * np.log10(np.where(arr > 0, arr, 1.0)), np.nan)
    return out


def from_db(db: np.ndarray | float) -> np.ndarray:
    """dB → doğrusal güç."""
    return np.power(10.0, np.asarray(db, dtype=np.float64) / 10.0)


def rvi(vh: np.ndarray, vv: np.ndarray) -> np.ndarray:
    """Radar bitki indeksi (doğrusal ölçekte): 4·VH / (VV + VH)."""
    vh, vv = np.asarray(vh, dtype=np.float64), np.asarray(vv, dtype=np.float64)
    with np.errstate(divide="ignore", invalid="ignore"):
        return np.where((vv + vh) > 0, 4.0 * vh / (vv + vh), np.nan)


def ratio_db(vh: np.ndarray, vv: np.ndarray) -> np.ndarray:
    """VH/VV oranı dB farkı olarak: 10·log10(VH) − 10·log10(VV) = 10·log10(VH/VV)."""
    return to_db(vh) - to_db(vv)


def log_ratio_db(current: np.ndarray | float, previous: np.ndarray | float) -> np.ndarray:
    """Değişim: 10·log10(şimdiki / önceki) (doğrusal girdiler). Pozitif = güçlü yansıma arttı."""
    cur, prev = np.asarray(current, dtype=np.float64), np.asarray(previous, dtype=np.float64)
    with np.errstate(divide="ignore", invalid="ignore"):
        ok = (cur > 0) & (prev > 0)
        return np.where(ok, 10.0 * np.log10(np.where(ok, cur, 1.0) / np.where(ok, prev, 1.0)), np.nan)


def valid_mask(vh: np.ndarray, vv: np.ndarray, *, shadow_vh_db: float, overlay_vv_db: float) -> np.ndarray:
    """Geçerli piksel: sonlu, > 0, nodata değil; VH çok düşük (gölge vekili) ya da VV çok yüksek (üst üste binme/doygunluk vekili) değil.

    RTC varlıklarında gölge/üst üste binme bandı yoktur; bu iki eşik katalogdaki ön değerlerle bunların vekilidir.
    """
    finite = np.isfinite(vh) & np.isfinite(vv) & (vh != RADAR_NODATA) & (vv != RADAR_NODATA) & (vh > 0) & (vv > 0)
    with np.errstate(divide="ignore", invalid="ignore"):
        vh_db, vv_db = to_db(np.where(finite, vh, np.nan)), to_db(np.where(finite, vv, np.nan))
    return finite & (vh_db >= shadow_vh_db) & (vv_db <= overlay_vv_db)


def lee_filter(linear: np.ndarray, valid: np.ndarray, *, size: int = 5, looks: float = 4.4) -> np.ndarray:
    """Lee kumlanma (speckle) filtresi, doğrusal yoğunluk üzerinde, geçersiz piksellere duyarlı (yalnız geçerli komşular sayılır).

    w = 1 − Cu²/Ci²  (Cu² = 1/ENL, Ci² = yerel varyans/ortalama²; 0'a kırpılır); çıktı = ortalama + w·(x − ortalama).
    Geçersiz pikseller NaN kalır.
    """
    x = np.where(valid, np.asarray(linear, dtype=np.float64), 0.0)
    w = valid.astype(np.float64)
    count = uniform_filter(w, size=size, mode="nearest")
    safe = np.where(count > 0, count, 1.0)
    mean = uniform_filter(x, size=size, mode="nearest") / safe
    mean_sq = uniform_filter(x * x, size=size, mode="nearest") / safe
    variance = np.maximum(mean_sq - mean * mean, 0.0)
    cu2 = 1.0 / looks
    with np.errstate(divide="ignore", invalid="ignore"):
        ci2 = np.where(mean > 0, variance / (mean * mean), 0.0)
        weight = np.where(ci2 > 0, np.clip(1.0 - cu2 / ci2, 0.0, 1.0), 0.0)
    out = mean + weight * (x - mean)
    return np.where(valid & (count > 0), out, np.nan)
