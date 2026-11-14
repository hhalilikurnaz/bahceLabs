"""Gece don için tahmin sağlayıcı: Open-Meteo tahmin API'si, çok model (IFS, ICON, GFS), saatlik sıcaklık/bulut/rüzgâr. Ağ yalnız burada; testler `Sahte` ile.
Önemli: Open-Meteo sıcaklığı noktanın 90 m DEM yüksekliğine ölçekler; ek sapma düzeltmesi YAPILMAZ (don-dogrulama.md §6)."""

from __future__ import annotations

from typing import Protocol

import httpx

from bahcelab_backend.domain.don.risk import SaatlikModel

URL = "https://api.open-meteo.com/v1/forecast"


class TahminSaglayici(Protocol):
    async def saatlik(self, lat: float, lng: float, modeller: list[str]) -> list[SaatlikModel]: ...


class OpenMeteoDon:
    async def saatlik(self, lat: float, lng: float, modeller: list[str]) -> list[SaatlikModel]:
        async with httpx.AsyncClient(timeout=60) as c:
            r = await c.get(URL, params={"latitude": lat, "longitude": lng, "hourly": "temperature_2m,cloud_cover,wind_speed_10m", "models": ",".join(modeller), "forecast_days": 4, "timezone": "auto", "wind_speed_unit": "ms"})
            r.raise_for_status()
        h = r.json()["hourly"]
        return [SaatlikModel(m, h["time"], h.get(f"temperature_2m_{m}", []), h.get(f"cloud_cover_{m}", []), h.get(f"wind_speed_10m_{m}", [])) for m in modeller if f"temperature_2m_{m}" in h]


class Sahte:
    """Test/altın bahçe: önceden verilmiş saatlik modeller (ağ yok)."""

    def __init__(self, modeller: list[SaatlikModel]) -> None:
        self.modeller = modeller

    async def saatlik(self, lat: float, lng: float, modeller: list[str]) -> list[SaatlikModel]:  # noqa: ARG002
        return self.modeller


def varsayilan() -> TahminSaglayici:
    return OpenMeteoDon()
