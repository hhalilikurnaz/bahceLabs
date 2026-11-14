"""Dilim 0: istasyon gözlemleri (Meteostat, yalnız ÖLÇÜM kaynaklı tmin) + ERA5-Land/ERA5 saatlik (Open-Meteo arşivi) + istasyon topografya profili → npz/json (önbellek).
Kullanım: python -m scripts.don_dilim0.veri_topla <çıktı-klasörü>"""

import asyncio
import json
import sys
import time
from datetime import date
from pathlib import Path

import httpx

from bahcelab_backend.domain.evidence.providers import MeteostatProvider
from scripts.don_dilim0 import arazi

BAS, BIT = date(2019, 11, 1), date(2025, 3, 31)
OM = "https://archive-api.open-meteo.com/v1/archive"


def saatlik(lat: float, lon: float, model: str, degisken: str) -> dict:
    for deneme in range(4):
        r = httpx.get(OM, params={"latitude": lat, "longitude": lon, "start_date": BAS.isoformat(), "end_date": BIT.isoformat(), "hourly": degisken, "models": model, "timezone": "auto", "wind_speed_unit": "ms"}, timeout=180)
        if r.status_code == 429:
            time.sleep(20 * (deneme + 1))
            continue
        r.raise_for_status()
        return r.json()
    raise RuntimeError("Open-Meteo hız sınırı")


async def istasyonlar() -> list:
    p = MeteostatProvider()
    tum = await p.nearest(39.0, 35.0, max_km=1100, limit=400)
    return [s for s in tum if 35.9 <= s.lat <= 42.2 and 26.0 <= s.lng <= 44.8 and s.id.isdigit() and s.id.startswith("17")]  # Türkiye WMO istasyonları (17xxx)


async def main(cikti: Path) -> None:
    cikti.mkdir(parents=True, exist_ok=True)
    prov = MeteostatProvider()
    for s in await istasyonlar():
        dosya = cikti / f"{s.id}.json"
        if dosya.exists():
            continue
        try:
            gun = await prov.daily(s, BAS, BIT)
            tmin = {g.tarih.isoformat(): g.tmin for g in gun if g.tmin is not None}
            if len(tmin) < 300:
                print("atla (az gözlem)", s.id, s.ad, len(tmin))
                continue
            t2 = saatlik(s.lat, s.lng, "era5_land", "temperature_2m")
            kb = saatlik(s.lat, s.lng, "era5", "cloud_cover,wind_speed_10m,temperature_2m")
            prof = arazi.profil(s.lat, s.lng, 4.0)
            dosya.write_text(json.dumps({"id": s.id, "ad": s.ad, "lat": s.lat, "lng": s.lng, "yukseklik": s.yukseklik, "om_yukseklik_land": t2.get("elevation"), "om_yukseklik_era5": kb.get("elevation"), "tmin_obs": tmin,
                                         "land": {"time": t2["hourly"]["time"], "t2m": t2["hourly"]["temperature_2m"]}, "era5": {"time": kb["hourly"]["time"], "bulut": kb["hourly"]["cloud_cover"], "ruzgar": kb["hourly"]["wind_speed_10m"], "t2m": kb["hourly"]["temperature_2m"]}, "profil": prof}))
            print("tamam", s.id, s.ad, len(tmin), {k: round(v, 1) for k, v in prof.items()})
        except Exception as e:  # noqa: BLE001
            print("HATA", s.id, s.ad, type(e).__name__, str(e)[:100])
        time.sleep(1.5)


if __name__ == "__main__":
    asyncio.run(main(Path(sys.argv[1])))
