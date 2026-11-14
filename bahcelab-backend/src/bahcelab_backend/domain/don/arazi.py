"""Arazi ölçüleri (SAF numpy/scipy; ağ yok): eğim, bakı (Horn 1981), TPI (Weiss 2001), priority-flood doldurma (Barnes vd. 2014), D8 akış birikimi, gökyüzü görüş faktörü (Zakšek vd. 2011).
Girdi: 30 m UTC ızgara (metre). Betimleyicidir (°C vermez); doğrulama ve kaynaklar: docs/agro/don-dogrulama.md §1."""

from __future__ import annotations

import heapq
import math

import numpy as np
from scipy import ndimage

PIKSEL_M = 30.0


def egim_baki(z: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Horn yöntemi: eğim (°), bakı (° kuzeyden saat yönünde; düz = -1)."""
    p = np.pad(z, 1, mode="edge")
    a, b, c = p[:-2, :-2], p[:-2, 1:-1], p[:-2, 2:]
    d, f = p[1:-1, :-2], p[1:-1, 2:]
    g, h, i = p[2:, :-2], p[2:, 1:-1], p[2:, 2:]
    dzdx = ((c + 2 * f + i) - (a + 2 * d + g)) / (8 * PIKSEL_M)
    dzdy = ((g + 2 * h + i) - (a + 2 * b + c)) / (8 * PIKSEL_M)  # satır artışı = güneye
    egim = np.degrees(np.arctan(np.hypot(dzdx, dzdy)))
    baki = (np.degrees(np.arctan2(-dzdx, dzdy)) + 360.0) % 360.0
    return egim, np.where(egim < 0.5, -1.0, baki)


def _disk(r_px: int) -> np.ndarray:
    y, x = np.ogrid[-r_px : r_px + 1, -r_px : r_px + 1]
    k = (x * x + y * y <= r_px * r_px).astype("float32")
    k[r_px, r_px] = 0.0
    return k


def tpi(z: np.ndarray, yaricap_m: float) -> np.ndarray:
    """Topografik konum indeksi: z − (disk ortalaması, merkez hariç); negatif = çukur/vadi tabanı, pozitif = sırt."""
    k = _disk(int(round(yaricap_m / PIKSEL_M)))
    return z - ndimage.convolve(z, k / k.sum(), mode="nearest")


def doldur(z: np.ndarray, eps: float = 1e-3) -> np.ndarray:
    """Priority-flood çukur doldurma (Barnes 2014): her çukur taşma noktasına kadar doldurulur; düzlüklerde eps eğimle tek yönlü akış."""
    h, w = z.shape
    out = z.astype("float64").copy()
    kapali = np.zeros((h, w), dtype=bool)
    heap: list[tuple[float, int, int]] = []
    for r in range(h):
        for c in (0, w - 1):
            heapq.heappush(heap, (out[r, c], r, c))
            kapali[r, c] = True
    for c in range(1, w - 1):
        for r in (0, h - 1):
            heapq.heappush(heap, (out[r, c], r, c))
            kapali[r, c] = True
    komsu = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
    while heap:
        v, r, c = heapq.heappop(heap)
        for dr, dc in komsu:
            rr, cc = r + dr, c + dc
            if 0 <= rr < h and 0 <= cc < w and not kapali[rr, cc]:
                kapali[rr, cc] = True
                if out[rr, cc] <= v:
                    out[rr, cc] = v + eps
                heapq.heappush(heap, (out[rr, cc], rr, cc))
    return out


def akis_birikimi(zf: np.ndarray) -> np.ndarray:
    """D8 akış birikimi (yukarı havza alanı, piksel sayısı; kendisi dahil) — soğuk hava drenajı/birikimi için «yukarıdan gelen hava hacmi» göstergesi."""
    h, w = zf.shape
    sira = np.argsort(-zf, axis=None)  # yüksekten alçağa
    acc = np.ones((h, w), dtype="float64")
    komsu = [(-1, -1, math.sqrt(2)), (-1, 0, 1.0), (-1, 1, math.sqrt(2)), (0, -1, 1.0), (0, 1, 1.0), (1, -1, math.sqrt(2)), (1, 0, 1.0), (1, 1, math.sqrt(2))]
    for idx in sira:
        r, c = divmod(int(idx), w)
        en, hedef = 0.0, None
        for dr, dc, d in komsu:
            rr, cc = r + dr, c + dc
            if 0 <= rr < h and 0 <= cc < w:
                s = (zf[r, c] - zf[rr, cc]) / d
                if s > en:
                    en, hedef = s, (rr, cc)
        if hedef is not None:
            acc[hedef] += acc[r, c]
    return acc


def gokyuzu_gorus(z: np.ndarray, yaricap_m: float = 1000.0, yon: int = 16) -> np.ndarray:
    """Gökyüzü görüş faktörü (Zakšek vd. 2011): SVF = 1 − ortalama(sin ufuk açısı), `yon` yönde `yaricap_m`'ye kadar. 1 = açık ufuk, küçük = çanak/vadi."""
    h, w = z.shape
    n = int(yaricap_m / PIKSEL_M)
    p = np.pad(z, n, mode="edge")
    toplam = np.zeros((h, w), dtype="float64")
    for k in range(yon):
        a = 2 * math.pi * k / yon
        dx, dy = math.sin(a), -math.cos(a)  # kuzey = yukarı
        en = np.zeros((h, w), dtype="float64")
        for s in range(1, n + 1):
            ox, oy = int(round(dx * s)), int(round(dy * s))
            komsu = p[n + oy : n + oy + h, n + ox : n + ox + w]
            aci = np.arctan2(np.maximum(komsu - z, 0.0), s * PIKSEL_M)
            en = np.maximum(en, aci)
        toplam += np.sin(en)
    return 1.0 - toplam / yon


def profil_nokta(z: np.ndarray, r: int, c: int) -> dict[str, float]:
    """(r, c) pikseli için topografya profili: 1 km çevre ölçekleri; akış birikimi için tüm pencere (havza kesilmesin)."""
    egim, baki = egim_baki(z)
    t3, t10 = tpi(z, 300.0), tpi(z, 1000.0)
    zf = doldur(z)
    acc = akis_birikimi(zf)
    svf = gokyuzu_gorus(z)
    return {
        "yukseklik_m": float(z[r, c]), "egim_der": float(egim[r, c]), "baki_der": float(baki[r, c]), "tpi300_m": float(t3[r, c]), "tpi1000_m": float(t10[r, c]),
        "akis_birikimi_ha": float(acc[r, c] * PIKSEL_M * PIKSEL_M / 1e4), "cukur_derinligi_m": float(zf[r, c] - z[r, c]), "svf": float(svf[r, c]),
    }
