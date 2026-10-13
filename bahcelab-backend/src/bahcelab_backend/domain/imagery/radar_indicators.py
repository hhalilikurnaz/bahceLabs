"""Radar göstergeleri (SAF): görüntü ızgaraları (Lee filtreli) ve istatistikler (ham doğrusal değerlerden)."""

from __future__ import annotations

import numpy as np

from bahcelab_backend.domain.acquisitions.store import PixelStats
from bahcelab_backend.domain.imagery import radar_math as rm


def radar_grids(vh: np.ndarray, vv: np.ndarray, valid: np.ndarray, *, size: int = 5, looks: float = 4.4) -> dict[str, np.ndarray]:
    """Lee filtreli doğrusal VH/VV'den: {vh_db, vv_db, oran_db, rvi} ızgaraları (geçersiz piksel NaN). Yalnız görüntü içindir."""
    fvh = rm.lee_filter(vh, valid, size=size, looks=looks)
    fvv = rm.lee_filter(vv, valid, size=size, looks=looks)
    return {"vh_db": rm.to_db(fvh).astype(np.float32), "vv_db": rm.to_db(fvv).astype(np.float32), "oran_db": rm.ratio_db(fvh, fvv).astype(np.float32), "rvi": rm.rvi(fvh, fvv).astype(np.float32)}


def _percentiles(values: np.ndarray) -> tuple[float, float, float, float, float]:
    p10, p25, p50, p75, p90 = (float(np.percentile(values, q)) for q in (10, 25, 50, 75, 90))
    return p10, p25, p50, p75, p90


def radar_stats(vh: np.ndarray, vv: np.ndarray, valid: np.ndarray, garden: np.ndarray) -> dict[str, PixelStats]:
    """Bahçe içi geçerli piksellerin istatistikleri; HAM (filtresiz) doğrusal değerlerden.

    dB göstergelerde ortalama = 10·log10(doğrusal ortalama) (dB değerlerin ortalaması DEĞİL); yüzdelikler doğrusal değerlerden hesaplanıp
    dB'ye çevrilir (monoton dönüşüm yüzdelikleri korur). Oran: ortalamalar oranı; RVI: 4·m_VH/(m_VV+m_VH). Geçerli piksel yoksa boş sözlük.
    """
    sel = garden & valid & np.isfinite(vh) & np.isfinite(vv)
    n = int(sel.sum())
    if n == 0:
        return {}
    h, v = vh[sel].astype(np.float64), vv[sel].astype(np.float64)
    m_h, m_v = float(h.mean()), float(v.mean())
    out: dict[str, PixelStats] = {}
    for name, values, mean_db in (("vh_db", h, float(rm.to_db(m_h))), ("vv_db", v, float(rm.to_db(m_v)))):
        p10, p25, p50, p75, p90 = (float(rm.to_db(p)) for p in _percentiles(values))
        out[name] = PixelStats(mean_db, p50, p10, p25, p75, p90, float(rm.to_db(values.min())), float(rm.to_db(values.max())), n)
    ratio = rm.ratio_db(h, v)  # piksel başına dB farkı (yüzdelik için)
    p10, p25, p50, p75, p90 = _percentiles(ratio)
    out["oran_db"] = PixelStats(float(rm.to_db(m_h / m_v)), p50, p10, p25, p75, p90, float(ratio.min()), float(ratio.max()), n)
    pixel_rvi = rm.rvi(h, v)
    p10, p25, p50, p75, p90 = _percentiles(pixel_rvi)
    out["rvi"] = PixelStats(float(rm.rvi(np.array([m_h]), np.array([m_v]))[0]), p50, p10, p25, p75, p90, float(pixel_rvi.min()), float(pixel_rvi.max()), n)
    return out
