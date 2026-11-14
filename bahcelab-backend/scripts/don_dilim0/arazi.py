"""ADIM 10 · Dilim 0 (spike): Copernicus DEM GLO-30 (AWS açık veri, kimlik doğrulamasız) → eğim, bakı, TPI (2 ölçek), soğuk hava akış birikimi, çanak derinliği, gökyüzü görüş faktörü.
Yalnız numpy/scipy/rasterio. Ürün kodu DEĞİL: Dilim 1'de `domain/don/` altına taşınacak biçimde saf fonksiyonlar. Kaynak/yöntem notları belgede: docs/agro/don-dogrulama.md."""

from __future__ import annotations

import heapq
import math
from dataclasses import dataclass

import numpy as np
import rasterio
from rasterio.transform import from_origin
from rasterio.warp import Resampling, reproject
from rasterio.windows import from_bounds
from scipy import ndimage

PIKSEL_M = 30.0
AWS = "https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_{ns}{lat:02d}_00_{ew}{lon:03d}_00_DEM/Copernicus_DSM_COG_10_{ns}{lat:02d}_00_{ew}{lon:03d}_00_DEM.tif"


def karo_url(lat: float, lon: float) -> str:
    la, lo = math.floor(lat), math.floor(lon)
    return AWS.format(ns="N" if la >= 0 else "S", lat=abs(la), ew="E" if lo >= 0 else "W", lon=abs(lo))


@dataclass(frozen=True)
class Izgara:
    z: np.ndarray  # 30 m, UTM, metre
    x0: float  # sol-üst köşe (UTM)
    y0: float
    epsg: int

    def rc(self, x: float, y: float) -> tuple[int, int]:
        return int((self.y0 - y) / PIKSEL_M), int((x - self.x0) / PIKSEL_M)


def utm_epsg(lat: float, lon: float) -> int:
    return (32600 if lat >= 0 else 32700) + int((lon + 180) // 6) + 1


def dem_oku(lat: float, lon: float, yaricap_km: float) -> tuple[Izgara, tuple[int, int]]:
    """Merkez (lat, lon) çevresinde ±yaricap_km, UTM 30 m ızgara (bilineer). Dönüş: ızgara ve merkez (satır, sütun). Birden çok 1° karo gerekirse birleştirilir."""
    from pyproj import Transformer

    epsg = utm_epsg(lat, lon)
    to_utm = Transformer.from_crs(4326, epsg, always_xy=True)
    cx, cy = to_utm.transform(lon, lat)
    n = int(yaricap_km * 1000 / PIKSEL_M)
    x0, y0 = cx - n * PIKSEL_M, cy + n * PIKSEL_M
    dst = np.full((2 * n + 1, 2 * n + 1), np.nan, dtype="float32")
    dst_tr = from_origin(x0, y0, PIKSEL_M, PIKSEL_M)
    derece = yaricap_km / 111.0 * 1.6 + 0.01
    karolar = {(math.floor(la), math.floor(lo)) for la in (lat - derece, lat + derece) for lo in (lon - derece, lon + derece)}
    for la, lo in sorted(karolar):
        try:
            with rasterio.open(karo_url(la + 0.5, lo + 0.5)) as ds:
                w = from_bounds(lon - derece, lat - derece, lon + derece, lat + derece, ds.transform).intersection(rasterio.windows.Window(0, 0, ds.width, ds.height))
                a = ds.read(1, window=w).astype("float32")
                tr = ds.window_transform(w)
                tmp = np.full_like(dst, np.nan)
                reproject(a, tmp, src_transform=tr, src_crs=ds.crs, dst_transform=dst_tr, dst_crs=f"EPSG:{epsg}", resampling=Resampling.bilinear, dst_nodata=np.nan)
                dst = np.where(np.isnan(dst), tmp, dst)
        except Exception:  # karo yok (deniz): atla
            continue
    # deniz/boş = 0 m
    dst = np.where(np.isnan(dst), 0.0, dst)
    return Izgara(dst, x0, y0, epsg), (n, n)


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


def profil(lat: float, lon: float, yaricap_km: float = 5.0) -> dict[str, float]:
    """Bir nokta için topografya profili (30 m piksel + 1 km çevre; akış birikimi için 5 km pencere)."""
    g, (r, c) = dem_oku(lat, lon, yaricap_km)
    z = g.z
    egim, baki = egim_baki(z)
    t3, t10 = tpi(z, 300.0), tpi(z, 1000.0)
    zf = doldur(z)
    acc = akis_birikimi(zf)
    svf = gokyuzu_gorus(z)
    return {
        "yukseklik_m": float(z[r, c]), "egim_der": float(egim[r, c]), "baki_der": float(baki[r, c]),
        "tpi300_m": float(t3[r, c]), "tpi1000_m": float(t10[r, c]),
        "akis_birikimi_ha": float(acc[r, c] * PIKSEL_M * PIKSEL_M / 1e4), "cukur_derinligi_m": float(zf[r, c] - z[r, c]),
        "svf": float(svf[r, c]),
    }
