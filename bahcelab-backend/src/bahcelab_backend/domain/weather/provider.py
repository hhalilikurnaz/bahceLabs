"""Hava verisi sağlayıcı arayüzü ve sağlayıcıdan bağımsız veri biçimleri.

Sağlayıcıyı değiştirmek (ücretli Open-Meteo planı, başka servis) için yalnızca `get_provider()` ve yeni bir
`WeatherProvider` uygulaması yeterlidir; kurallar, önbellek ve API bu modüldeki biçimlerle çalışır.
"""

from __future__ import annotations

from datetime import date
from typing import Protocol

from pydantic import BaseModel

TIMEZONE = "Europe/Istanbul"


class WeatherSourceError(Exception):
    """Hava servisine ulaşılamadı veya yanıt okunamadı (mesaj kullanıcıya gösterilebilir)."""


class Current(BaseModel):
    zaman: str  # yerel saat, ISO (YYYY-MM-DDTHH:MM)
    sicaklik: float
    hissedilen: float | None = None
    nem: float | None = None
    yagis: float = 0.0
    ruzgar: float = 0.0  # km/s
    hamle: float | None = None
    yon: float | None = None
    kod: int = 0  # WMO hava kodu
    gunduz: bool = True


class HourlyPoint(BaseModel):
    zaman: str  # yerel saat, ISO (YYYY-MM-DDTHH:00)
    sicaklik: float
    nem: float | None = None
    yagis: float = 0.0  # mm
    yagis_olasiligi: float | None = None  # %
    ruzgar: float = 0.0  # km/s
    hamle: float = 0.0  # km/s
    et0: float | None = None  # mm
    kod: int = 0


class DailyPoint(BaseModel):
    tarih: date
    min: float | None = None
    max: float | None = None
    yagis: float | None = None  # mm
    et0: float | None = None  # mm
    kod: int | None = None
    yagis_olasiligi: float | None = None
    ruzgar_max: float | None = None
    hamle_max: float | None = None


class Forecast(BaseModel):
    """Şu an + saatlik (bugünden itibaren) + günlük (son birkaç gün ve gelecek)."""

    current: Current
    hourly: list[HourlyPoint]
    daily: list[DailyPoint]


class WeatherProvider(Protocol):
    name: str
    attribution: str

    async def forecast(self, lat: float, lng: float, past_days: int = 7) -> Forecast: ...

    async def history(self, lat: float, lng: float, start: date, end: date) -> list[DailyPoint]:
        """Günlük geçmiş (arşiv). Henüz yayımlanmamış günler dönmez."""
        ...


def get_provider() -> WeatherProvider:
    from bahcelab_backend.domain.weather.open_meteo import OpenMeteoProvider

    return OpenMeteoProvider()
