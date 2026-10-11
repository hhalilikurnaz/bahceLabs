"""Open-Meteo uygulaması (anahtarsız ücretsiz uç noktalar; ticari kullanımda `OPEN_METEO_API_KEY` ile ücretli plan)."""

from __future__ import annotations

from datetime import date
from typing import Any

import httpx

from bahcelab_backend.config import get_settings
from bahcelab_backend.domain.weather.provider import (
    TIMEZONE,
    Current,
    DailyPoint,
    Forecast,
    HourlyPoint,
    WeatherSourceError,
)

FREE_FORECAST = "https://api.open-meteo.com/v1/forecast"
FREE_ARCHIVE = "https://archive-api.open-meteo.com/v1/archive"
PAID_FORECAST = "https://customer-api.open-meteo.com/v1/forecast"
PAID_ARCHIVE = "https://customer-archive-api.open-meteo.com/v1/archive"

_CURRENT = (
    "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,"
    "wind_speed_10m,wind_gusts_10m,wind_direction_10m,is_day"
)
_HOURLY = (
    "temperature_2m,relative_humidity_2m,precipitation,precipitation_probability,wind_speed_10m,"
    "wind_gusts_10m,et0_fao_evapotranspiration,weather_code"
)
_DAILY = (
    "temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration,weather_code,"
    "precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,sunrise,sunset"
)
_ARCHIVE_DAILY = "temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration"


def _num(value: Any, default: float | None = None) -> float | None:
    return float(value) if isinstance(value, int | float) else default


def _clock(values: Any, index: int) -> str | None:
    """Open-Meteo 'YYYY-MM-DDTHH:MM' → 'HH:MM' (yoksa None: sabit gündüz saatlerine dönülür)."""
    try:
        text = values[index]
    except (TypeError, IndexError):
        return None
    return text[11:16] if isinstance(text, str) and len(text) >= 16 else None


class OpenMeteoProvider:
    name = "open-meteo"
    attribution = "Hava verisi: Open-Meteo.com (CC BY 4.0)"

    def __init__(self, client: httpx.AsyncClient | None = None) -> None:
        settings = get_settings()
        self._client = client
        self._key = settings.open_meteo_api_key
        self._timeout = settings.weather_timeout_seconds
        self._forecast_url = PAID_FORECAST if self._key else FREE_FORECAST
        self._archive_url = PAID_ARCHIVE if self._key else FREE_ARCHIVE

    async def _get(self, url: str, params: dict[str, Any]) -> dict[str, Any]:
        params = {**params, "timezone": TIMEZONE}
        if self._key:
            params["apikey"] = self._key
        try:
            if self._client is not None:
                response = await self._client.get(url, params=params, timeout=self._timeout)
            else:
                async with httpx.AsyncClient() as client:
                    response = await client.get(url, params=params, timeout=self._timeout)
            response.raise_for_status()
            return response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise WeatherSourceError(
                "Hava durumu servisine şu an ulaşılamıyor. Birazdan tekrar deneyin."
            ) from exc

    async def forecast(self, lat: float, lng: float, past_days: int = 7) -> Forecast:
        data = await self._get(
            self._forecast_url,
            {
                "latitude": lat,
                "longitude": lng,
                "current": _CURRENT,
                "hourly": _HOURLY,
                "daily": _DAILY,
                "wind_speed_unit": "kmh",
                "forecast_days": 7,
                "past_days": past_days,
            },
        )
        try:
            return self._parse_forecast(data)
        except (KeyError, TypeError, ValueError) as exc:
            raise WeatherSourceError("Hava durumu yanıtı okunamadı.") from exc

    @staticmethod
    def _parse_forecast(data: dict[str, Any]) -> Forecast:
        cur = data["current"]
        current = Current(
            zaman=cur["time"],
            sicaklik=float(cur["temperature_2m"]),
            hissedilen=_num(cur.get("apparent_temperature")),
            nem=_num(cur.get("relative_humidity_2m")),
            yagis=_num(cur.get("precipitation"), 0.0) or 0.0,
            ruzgar=_num(cur.get("wind_speed_10m"), 0.0) or 0.0,
            hamle=_num(cur.get("wind_gusts_10m")),
            yon=_num(cur.get("wind_direction_10m")),
            kod=int(cur.get("weather_code") or 0),
            gunduz=bool(cur.get("is_day", 1)),
        )

        daily_raw = data["daily"]
        daily = [
            DailyPoint(
                tarih=date.fromisoformat(day),
                min=_num(daily_raw["temperature_2m_min"][i]),
                max=_num(daily_raw["temperature_2m_max"][i]),
                yagis=_num(daily_raw["precipitation_sum"][i]),
                et0=_num(daily_raw["et0_fao_evapotranspiration"][i]),
                kod=int(daily_raw["weather_code"][i]) if daily_raw["weather_code"][i] is not None else None,
                yagis_olasiligi=_num(daily_raw["precipitation_probability_max"][i]),
                ruzgar_max=_num(daily_raw["wind_speed_10m_max"][i]),
                hamle_max=_num(daily_raw["wind_gusts_10m_max"][i]),
                gun_dogumu=_clock(daily_raw.get("sunrise"), i),
                gun_batimi=_clock(daily_raw.get("sunset"), i),
            )
            for i, day in enumerate(daily_raw["time"])
        ]

        # Saatlik seri geçmiş günleri de içerir; yalnızca bugünden (yerel) itibaren tutulur
        today = current.zaman[:10]
        hourly_raw = data["hourly"]
        hourly: list[HourlyPoint] = []
        for i, moment in enumerate(hourly_raw["time"]):
            temperature = _num(hourly_raw["temperature_2m"][i])
            if moment[:10] < today or temperature is None:
                continue
            hourly.append(
                HourlyPoint(
                    zaman=moment,
                    sicaklik=temperature,
                    nem=_num(hourly_raw["relative_humidity_2m"][i]),
                    yagis=_num(hourly_raw["precipitation"][i], 0.0) or 0.0,
                    yagis_olasiligi=_num(hourly_raw["precipitation_probability"][i]),
                    ruzgar=_num(hourly_raw["wind_speed_10m"][i], 0.0) or 0.0,
                    hamle=_num(hourly_raw["wind_gusts_10m"][i], 0.0) or 0.0,
                    et0=_num(hourly_raw["et0_fao_evapotranspiration"][i]),
                    kod=int(hourly_raw["weather_code"][i] or 0),
                )
            )
        if not hourly:
            raise ValueError("saatlik veri yok")
        return Forecast(current=current, hourly=hourly, daily=daily)

    async def history(self, lat: float, lng: float, start: date, end: date) -> list[DailyPoint]:
        data = await self._get(
            self._archive_url,
            {
                "latitude": lat,
                "longitude": lng,
                "start_date": start.isoformat(),
                "end_date": end.isoformat(),
                "daily": _ARCHIVE_DAILY,
            },
        )
        try:
            raw = data["daily"]
            points = [
                DailyPoint(
                    tarih=date.fromisoformat(day),
                    min=_num(raw["temperature_2m_min"][i]),
                    max=_num(raw["temperature_2m_max"][i]),
                    yagis=_num(raw["precipitation_sum"][i]),
                    et0=_num(raw["et0_fao_evapotranspiration"][i]),
                )
                for i, day in enumerate(raw["time"])
            ]
        except (KeyError, TypeError, ValueError) as exc:
            raise WeatherSourceError("Geçmiş hava verisi okunamadı.") from exc
        # Henüz yayımlanmamış günlerde değerler null gelir
        return [p for p in points if p.min is not None and p.max is not None]
