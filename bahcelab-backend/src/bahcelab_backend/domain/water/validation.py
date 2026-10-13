"""Doğrulama kaynakları (ADR 0017): SMAP L3 9 km yüzey nemi, GPM IMERG günlük yağış, CHIRPS günlük yağış. ARAYÜZDE GÖSTERİLMEZ.

Yalnız ERA5(-Land) ile karşılaştırma ve yağış notu doğrulaması içindir. Granüller (SMAP ~680 MB) indirilmez: HTTP Range ile yalnız bahçe pikseli
ve 5×5 komşuluğu okunur. Earthdata belirteci `earthaccess` üzerinden ortamdan alınır; bu modül belirteci görmez, loglamaz, saklamaz.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)

# EASE-Grid 2.0 Global (EPSG:6933) 9 km: SMAP L3 (SPL3SMP_E) ızgarası
EASE2_CELL_M = 9008.055210146
EASE2_X0 = -17367530.44516138
EASE2_Y0 = 7314540.79258289
SMAP_FILL = -9999.0
SMAP_SHAPE = (1624, 3856)


def ease2_rowcol(lat: float, lng: float) -> tuple[int, int]:
    """Enlem/boylam → SMAP 9 km EASE-Grid 2.0 satır, sütun."""
    from pyproj import Transformer

    x, y = Transformer.from_crs(4326, 6933, always_xy=True).transform(lng, lat)
    return int((EASE2_Y0 - y) / EASE2_CELL_M), int((x - EASE2_X0) / EASE2_CELL_M)


@dataclass(frozen=True)
class Observation:
    indeks: str
    deger: float | None
    ayrinti: dict[str, Any]


def neighbourhood(block: np.ndarray, quality: np.ndarray | None = None) -> dict[str, Any]:
    """Merkez piksel ve komşuluk ortalaması (5×5): doldurma değeri ve kalitesiz (bit0 ≠ 0) pikseller dışarıda."""
    valid = np.isfinite(block) & (block > -1000)
    if quality is not None:
        valid &= (quality.astype(np.uint16) & 1) == 0
    cy, cx = block.shape[0] // 2, block.shape[1] // 2
    centre = float(block[cy, cx]) if valid[cy, cx] else None
    mean = float(block[valid].mean()) if valid.any() else None
    return {"nokta": centre, "komsu_ortalama": mean, "komsu_gecerli": int(valid.sum()), "komsu_toplam": int(block.size)}


def pick_value(summary: dict[str, Any]) -> tuple[float | None, str]:
    """Bahçe pikseli geçerliyse o; kıyıda/örtüde geçersizse komşuluk ortalaması (kaynak etiketiyle)."""
    if summary["nokta"] is not None:
        return summary["nokta"], "nokta"
    if summary["komsu_ortalama"] is not None:
        return summary["komsu_ortalama"], "komsu"
    return None, "yok"


def granule_day(name: str) -> date | None:
    match = re.search(r"(\d{4})(\d{2})(\d{2})", name.rsplit("/", 1)[-1])
    return date(int(match[1]), int(match[2]), int(match[3])) if match else None


def smap_block(handle: Any, row: int, col: int, half: int = 2) -> list[Observation]:
    """Açık bir SMAP L3 HDF5'inden AM (06:00) ve PM (18:00) yüzey nemi (m³/m³) — 5×5 komşuluk."""
    out: list[Observation] = []
    for suffix, group_name, var in (("am", "Soil_Moisture_Retrieval_Data_AM", "soil_moisture"), ("pm", "Soil_Moisture_Retrieval_Data_PM", "soil_moisture_pm")):
        if group_name not in handle:
            continue
        group = handle[group_name]
        r0, r1, c0, c1 = max(0, row - half), min(SMAP_SHAPE[0], row + half + 1), max(0, col - half), min(SMAP_SHAPE[1], col + half + 1)
        block = np.asarray(group[var][r0:r1, c0:c1], dtype=np.float64)
        quality = np.asarray(group["retrieval_qual_flag" if suffix == "am" else "retrieval_qual_flag_pm"][r0:r1, c0:c1])
        block[block == SMAP_FILL] = np.nan
        summary = neighbourhood(block, quality)
        value, source = pick_value(summary)
        out.append(Observation(f"sm_yuzey_{suffix}", value, {**summary, "deger_kaynagi": source, "satir": row, "sutun": col}))
    return out


def imerg_value(handle: Any, lat: float, lng: float) -> Observation:
    """GPM IMERG günlük (0,1°) hücre değeri (mm/gün)."""
    grid = handle["Grid"]
    lons, lats = grid["lon"][:], grid["lat"][:]
    i, j = int(np.argmin(np.abs(lons - lng))), int(np.argmin(np.abs(lats - lat)))
    raw = grid["precipitation"][0, i, j]
    value = float(raw) if np.isfinite(raw) and raw >= 0 else None
    return Observation("yagis_mm", value, {"lon": float(lons[i]), "lat": float(lats[j])})


CHIRPS_URL = "https://data.chc.ucsb.edu/products/CHIRPS-2.0/global_daily/cogs/p05/{y}/chirps-v2.0.{y}.{m:02d}.{d:02d}.cog"


def chirps_value(day: date, lat: float, lng: float) -> Observation | None:
    """CHIRPS v2 günlük 0,05° (COG): hücre ve 3×3 komşuluk; dosya henüz yoksa None."""
    import rasterio

    url = CHIRPS_URL.format(y=day.year, m=day.month, d=day.day)
    try:
        with rasterio.Env(GDAL_HTTP_MAX_RETRY="3", GDAL_HTTP_RETRY_DELAY="1", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".cog"), rasterio.open(url) as ds:
            r, c = ds.index(lng, lat)
            block = ds.read(1, window=((max(0, r - 1), r + 2), (max(0, c - 1), c + 2))).astype(np.float64)
    except rasterio.errors.RasterioIOError:
        return None
    block[block < 0] = np.nan
    centre = block[block.shape[0] // 2, block.shape[1] // 2]
    value = float(centre) if np.isfinite(centre) else (float(np.nanmean(block)) if np.isfinite(block).any() else None)
    return Observation("yagis_mm", value, {"komsu_ortalama": float(np.nanmean(block)) if np.isfinite(block).any() else None, "nokta": float(centre) if np.isfinite(centre) else None})


def days_between(start: date, end: date) -> list[date]:
    return [start + timedelta(days=i) for i in range((end - start).days + 1)]


def pearson(a: list[float], b: list[float]) -> float | None:
    """İki serinin Pearson korelasyonu (≥ 10 ortak nokta, sabit olmayan seri) — doğrulama raporu için."""
    if len(a) < 10 or len(a) != len(b):
        return None
    x, y = np.asarray(a, dtype=np.float64), np.asarray(b, dtype=np.float64)
    if x.std() == 0 or y.std() == 0:
        return None
    return float(np.corrcoef(x, y)[0, 1])
