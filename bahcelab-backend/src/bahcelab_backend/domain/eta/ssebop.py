"""SSEBop saf matematiği (raster/ağ yok; birim testli). Senay ve ark. 2013 + FAO-56.

    ETf = (Th − Ts) / dT ,  Th = Tc + dT ,  Tc = c · Ta     (0 … etf_ust)
    dT  = (Rn − G) · rah / (ρ · cp)    sıcak (kuru, çıplak) koşul: Rn = Rs(1 − albedo) − Rnl, G = 0 (günlük)
    ETa = ETf × ET0

Tüm katsayılar katalogdan gelir (`eta_ic`, ön değer · mühendis onayı bekliyor).
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

GSC = 0.0820  # MJ/m²/dk güneş sabiti (FAO-56)
SIGMA = 4.903e-9  # MJ/K⁴/m²/gün


@dataclass(frozen=True)
class DtGirdi:
    """ERA5 günlük girdileri (Open-Meteo ERA5 arşivi)."""

    rs_mj: float  # shortwave_radiation_sum, MJ/m²/gün
    tmax_c: float
    tmin_c: float
    tmean_c: float
    cig_c: float  # çiy noktası ortalaması
    yil_gunu: int
    enlem: float
    yukseklik_m: float


@dataclass(frozen=True)
class DtSonuc:
    ra_mj: float
    rso_mj: float
    rs_rso: float
    rnl_mj: float
    rn_sicak_mj: float
    rn_sicak_wm2: float
    rho: float
    dt_k: float


def ra_gunluk(yil_gunu: int, enlem_derece: float) -> float:
    """Dünya dışı radyasyon (FAO-56 Denk. 21), MJ/m²/gün."""
    phi = math.radians(enlem_derece)
    dr = 1 + 0.033 * math.cos(2 * math.pi * yil_gunu / 365)
    dec = 0.409 * math.sin(2 * math.pi * yil_gunu / 365 - 1.39)
    ws = math.acos(max(-1.0, min(1.0, -math.tan(phi) * math.tan(dec))))
    return 24 * 60 / math.pi * GSC * dr * (ws * math.sin(phi) * math.sin(dec) + math.cos(phi) * math.cos(dec) * math.sin(ws))


def hava_yogunlugu(tmean_c: float, yukseklik_m: float) -> float:
    """ρ (kg/m³), FAO-56: P = 101,3((293 − 0,0065 z)/293)^5,26 ; ρ = P / (1,01 · T · 0,287)."""
    p = 101.3 * ((293 - 0.0065 * yukseklik_m) / 293) ** 5.26
    return p / (1.01 * (tmean_c + 273.16) * 0.287)


def dt_hesapla(g: DtGirdi, *, albedo: float, rah: float, cp: float) -> DtSonuc:
    ea = 0.6108 * math.exp(17.27 * g.cig_c / (g.cig_c + 237.3))
    ra = ra_gunluk(g.yil_gunu, g.enlem)
    rso = (0.75 + 2e-5 * g.yukseklik_m) * ra
    oran = float(min(1.0, max(0.3, g.rs_mj / rso))) if rso > 0 else 0.3
    rnl = SIGMA * (((g.tmax_c + 273.16) ** 4 + (g.tmin_c + 273.16) ** 4) / 2) * (0.34 - 0.14 * math.sqrt(max(ea, 0.0))) * (1.35 * oran - 0.35)
    rn = g.rs_mj * (1 - albedo) - rnl
    rn_w = rn / 0.0864
    rho = hava_yogunlugu(g.tmean_c, g.yukseklik_m)
    return DtSonuc(ra, rso, oran, rnl, rn, rn_w, rho, max(0.0, rn_w * rah / (rho * cp)))


def ta_rakim_duzelt(ta_k: float, hedef_m: float, kaynak_m: float, lapse_k_km: float) -> float:
    """Hava sıcaklığını kaynak hücre yüksekliğinden hedef yüksekliğe indirger (standart düşme oranı)."""
    return ta_k - lapse_k_km * (hedef_m - kaynak_m) / 1000.0


def c_faktoru(tc_soguk_k: float, ta_k: float) -> float:
    """Sahne soğuk referansından c = Tc / Ta (uzun dönem medyanı alınarak KALİBRE edilir; tek sahne değeri tanılamadır)."""
    return tc_soguk_k / ta_k


def tc_hesapla(c: float, ta_k: float) -> float:
    return c * ta_k


def etf_hesapla(ts_k: np.ndarray | float, tc_k: float, dt_k: float, etf_ust: float) -> np.ndarray:
    """ETf = 1 − (Ts − Tc)/dT, [0, etf_ust]. dT ≤ 0 (karanlık/kış) → NaN (ETf tanımsız)."""
    ts = np.asarray(ts_k, dtype="float64")
    if dt_k <= 0.5:
        return np.full(ts.shape, np.nan)
    return np.clip(1 - (ts - tc_k) / dt_k, 0.0, etf_ust)


def etf_belirsizlik(sigma_ts_k: float, sigma_tc_k: float, dt_k: float) -> float:
    """ETf standart sapması: √(σTs² + σTc²)/dT (bağımsız varsayım; dT küçükse büyür)."""
    if dt_k <= 0.5:
        return float("nan")
    return math.sqrt(sigma_ts_k**2 + sigma_tc_k**2) / dt_k


def ic_tampon_maske_orani(maske_ic: np.ndarray, maske_tum: np.ndarray) -> float:
    """İç tampon piksellerinin tüm bahçe piksellerine oranı (karışık piksel payı = 1 − oran)."""
    n = int(maske_tum.sum())
    return float(maske_ic.sum() / n) if n else 0.0
