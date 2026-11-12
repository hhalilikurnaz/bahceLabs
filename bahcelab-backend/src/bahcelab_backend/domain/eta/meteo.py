"""ERA5 günlük meteoroloji (Open-Meteo ERA5 arşivi) ve Meteostat gözlemi (17340 Mersin, bulk günlük CSV) + ERA5 Tmax sapması (aylık, saf)."""

from __future__ import annotations

import csv
import gzip
import io
import statistics
from dataclasses import dataclass
from datetime import date

import httpx

OPEN_METEO = "https://archive-api.open-meteo.com/v1/archive"
METEOSTAT_BULK = "https://bulk.meteostat.net/v2/daily/{kod}.csv.gz"
GUNLUK = "temperature_2m_max,temperature_2m_min,temperature_2m_mean,shortwave_radiation_sum,et0_fao_evapotranspiration,dew_point_2m_mean,precipitation_sum"


@dataclass(frozen=True)
class Era5Seri:
    yukseklik_m: float  # ERA5 hücresinin (Open-Meteo DEM) yüksekliği
    gun: dict[date, dict[str, float | None]]


def era5_gunluk(lat: float, lon: float, bas: date, bit: date, *, client: httpx.Client | None = None) -> Era5Seri:
    c = client or httpx.Client(timeout=90)
    r = c.get(OPEN_METEO, params={"latitude": lat, "longitude": lon, "start_date": bas.isoformat(), "end_date": bit.isoformat(), "timezone": "auto", "models": "era5", "daily": GUNLUK})
    r.raise_for_status()
    j = r.json()
    d = j["daily"]
    gun = {date.fromisoformat(t): {k: d[k][i] for k in d if k != "time"} for i, t in enumerate(d["time"])}
    return Era5Seri(float(j["elevation"]), gun)


def meteostat_gunluk(kod: str, *, client: httpx.Client | None = None) -> dict[date, dict[str, float | None]]:
    """Meteostat bulk günlük: sütunlar date,tavg,tmin,tmax,prcp,… (v2). Gözlemler ≈ 8 ay gecikmeli yayımlanır."""
    c = client or httpx.Client(timeout=90)
    r = c.get(METEOSTAT_BULK.format(kod=kod))
    r.raise_for_status()
    out: dict[date, dict[str, float | None]] = {}
    f = lambda s: float(s) if s not in ("", None) else None  # noqa: E731
    for row in csv.reader(io.StringIO(gzip.decompress(r.content).decode())):
        if len(row) < 5:
            continue
        out[date.fromisoformat(row[0])] = {"tavg": f(row[1]), "tmin": f(row[2]), "tmax": f(row[3]), "prcp": f(row[4])}
    return out


def aylik_ta_sapma(era5_tmax: dict[date, float | None], gozlem_tmax: dict[date, float | None], min_gun: int) -> dict[int, tuple[float, float, int]]:
    """Ay (1–12) → (ort. sapma °C = gözlem − ERA5, std, eşleşen gün). Yeterli (≥ min_gun) eşleşmesi olmayan ay yazılmaz (uydurma düzeltme yok)."""
    fark: dict[int, list[float]] = {}
    for t, e in era5_tmax.items():
        g = gozlem_tmax.get(t)
        if e is not None and g is not None:
            fark.setdefault(t.month, []).append(g - e)
    return {m: (statistics.fmean(v), statistics.pstdev(v), len(v)) for m, v in fark.items() if len(v) >= min_gun}
