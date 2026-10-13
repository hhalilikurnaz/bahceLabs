"""ERA5-Land (Open-Meteo arşiv) toprak nemi + ERA5 yağış/ET0 + model tahmini (ADR 0017).

- Toprak nemi 4 katman (0–7, 7–28, 28–100, 100–255 cm) ve sıcaklık: `models=era5_land`. Open-Meteo ERA5-Land için yağış ve ET0 SUNMAZ;
  bunlar `models=era5` (ERA5 yeniden analizi) çağrısından gelir. İki kaynak ayrı çağrılır, günlük satırda birleşir.
- ERA5(-Land) ~5 gün gecikmelidir: son günler ve önümüzdeki 7 gün için Open-Meteo TAHMİN modelinin toprak katmanları (0–1, 1–3, 3–9, 9–27, 27–81 cm)
  derinlik ağırlığıyla ERA5-Land katmanlarına eşlenir ve `model` olarak işaretlenir (arayüzde kesikli). 100–255 cm modelde yoktur → boş (uydurma yok).
Saf fonksiyonlar (eşleme, günlük toplulaştırma) ağsızdır ve testlidir.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any, Protocol

import httpx

from bahcelab_backend.config import get_settings
from bahcelab_backend.domain.weather.open_meteo import (
    FREE_ARCHIVE,
    FREE_FORECAST,
    PAID_ARCHIVE,
    PAID_FORECAST,
)
from bahcelab_backend.domain.weather.provider import TIMEZONE, WeatherSourceError

ERA5_LAYERS_CM = ((0, 7), (7, 28), (28, 100), (100, 255))
MODEL_LAYERS_CM = ((0, 1), (1, 3), (3, 9), (9, 27), (27, 81))
SOIL_VARS = ("soil_moisture_0_to_7cm", "soil_moisture_7_to_28cm", "soil_moisture_28_to_100cm", "soil_moisture_100_to_255cm")
MODEL_SOIL_VARS = ("soil_moisture_0_to_1cm", "soil_moisture_1_to_3cm", "soil_moisture_3_to_9cm", "soil_moisture_9_to_27cm", "soil_moisture_27_to_81cm")
MIN_COVERAGE = 0.7  # hedef katmanın en az bu kadarı (28–100 cm için modelin 28–81 cm'si = %74 örter) model katmanlarıyla örtülmeli, aksi hâlde boş


def overlap_mean(values: list[float | None], layers: tuple[tuple[int, int], ...], top: int, bottom: int) -> float | None:
    """[top, bottom] cm aralığının derinlik ağırlıklı ortalaması; örtülen kısım `MIN_COVERAGE`'dan azsa None."""
    total = covered = 0.0
    for value, (a, b) in zip(values, layers, strict=True):
        width = max(0, min(bottom, b) - max(top, a))
        if width == 0 or value is None:
            continue
        total += value * width
        covered += width
    return total / covered if covered / (bottom - top) >= MIN_COVERAGE else None


def model_to_era5_layers(model_values: list[float | None]) -> list[float | None]:
    """Tahmin modelinin 5 katmanı → ERA5-Land'in 4 katmanı (derinlik ağırlıklı; 100–255 cm modelde yok → None)."""
    return [overlap_mean(model_values, MODEL_LAYERS_CM, top, bottom) for top, bottom in ERA5_LAYERS_CM]


@dataclass
class DayAgg:
    sm: list[float | None] = field(default_factory=lambda: [None] * 4)
    et0_mm: float | None = None
    yagis_mm: float | None = None
    t_ort: float | None = None
    t_min: float | None = None
    t_max: float | None = None
    saatlik: dict[str, list[float | None]] = field(default_factory=dict)


def _mean(values: list[float | None], minimum: int = 18) -> float | None:
    known = [v for v in values if v is not None]
    return sum(known) / len(known) if len(known) >= minimum else None


def _sum(values: list[float | None], minimum: int = 18) -> float | None:
    known = [v for v in values if v is not None]
    return sum(known) if len(known) >= minimum else None


def group_by_day(times: list[str], series: dict[str, list[float | None]]) -> dict[date, dict[str, list[float | None]]]:
    """Saatlik diziler → gün → {değişken: [24 saat]} (yerel saat dilimi; eksik saat None)."""
    out: dict[date, dict[str, list[float | None]]] = {}
    for i, stamp in enumerate(times):
        day = date.fromisoformat(stamp[:10])
        hour = int(stamp[11:13])
        bucket = out.setdefault(day, {k: [None] * 24 for k in series})
        for key, values in series.items():
            bucket[key][hour] = values[i] if i < len(values) else None
    return out


def aggregate_day(hours: dict[str, list[float | None]]) -> DayAgg:
    """Bir günün saatlik dizilerinden günlük özet: nem ve sıcaklık ortalama, yağış ve ET0 toplam (gün için ≥ 18 saat veri şartı)."""
    agg = DayAgg()
    agg.sm = [_mean(hours.get(f"sm{i}", [])) for i in range(4)]
    agg.et0_mm = _sum(hours.get("et0", []))
    agg.yagis_mm = _sum(hours.get("yagis", []))
    temps = hours.get("t2m", [])
    agg.t_ort = _mean(temps)
    known = [v for v in temps if v is not None]
    agg.t_min, agg.t_max = (min(known), max(known)) if len(known) >= 18 else (None, None)
    agg.saatlik = {k: [None if v is None else round(v, 4) for v in vals] for k, vals in hours.items() if any(v is not None for v in vals)}
    return agg


def parse_era5_land(data: dict[str, Any]) -> dict[date, dict[str, list[float | None]]]:
    h = data["hourly"]
    series = {f"sm{i}": h[SOIL_VARS[i]] for i in range(4)} | {"t2m": h["temperature_2m"]}
    return group_by_day(h["time"], series)


def parse_era5(data: dict[str, Any]) -> dict[date, dict[str, list[float | None]]]:
    h = data["hourly"]
    return group_by_day(h["time"], {"yagis": h["precipitation"], "et0": h["et0_fao_evapotranspiration"], "hamle": h.get("wind_gusts_10m", [])})


def parse_model(data: dict[str, Any]) -> dict[date, dict[str, list[float | None]]]:
    """Tahmin modeli: 5 katman → 4 ERA5-Land katmanına eşlenmiş saatlik diziler (+ yağış, ET0, sıcaklık)."""
    h = data["hourly"]
    n = len(h["time"])
    layers: dict[str, list[float | None]] = {f"sm{i}": [] for i in range(4)}
    for t in range(n):
        mapped = model_to_era5_layers([h[v][t] for v in MODEL_SOIL_VARS])
        for i in range(4):
            layers[f"sm{i}"].append(mapped[i])
    series = layers | {"yagis": h["precipitation"], "et0": h["et0_fao_evapotranspiration"], "t2m": h["temperature_2m"], "hamle": h.get("wind_gusts_10m", [])}
    return group_by_day(h["time"], series)


class Era5Source(Protocol):
    """ERA5 istemcisi sözleşmesi: Open-Meteo (`Era5Client`) ya da test sahtesi."""

    async def land(self, lat: float, lng: float, start: date, end: date) -> dict[date, dict[str, list[float | None]]]: ...
    async def reanalysis(self, lat: float, lng: float, start: date, end: date) -> dict[date, dict[str, list[float | None]]]: ...
    async def model(self, lat: float, lng: float, past_days: int = 10, forecast_days: int = 8) -> dict[date, dict[str, list[float | None]]]: ...


@dataclass
class Era5Client:
    """Open-Meteo arşiv + tahmin istemcisi (anahtarsız ücretsiz; `OPEN_METEO_API_KEY` ile ücretli)."""

    client: httpx.AsyncClient | None = None

    async def _get(self, url: str, params: dict[str, Any]) -> dict[str, Any]:
        settings = get_settings()
        params = {**params, "timezone": TIMEZONE}
        if settings.open_meteo_api_key:
            params["apikey"] = settings.open_meteo_api_key
        try:
            if self.client is not None:
                response = await self.client.get(url, params=params, timeout=settings.weather_timeout_seconds * 3)
            else:
                async with httpx.AsyncClient() as client:
                    response = await client.get(url, params=params, timeout=settings.weather_timeout_seconds * 3)
            response.raise_for_status()
            return response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise WeatherSourceError("ERA5 arşivine şu an ulaşılamıyor. Birazdan tekrar deneyin.") from exc

    @property
    def _archive(self) -> str:
        return PAID_ARCHIVE if get_settings().open_meteo_api_key else FREE_ARCHIVE

    @property
    def _forecast(self) -> str:
        return PAID_FORECAST if get_settings().open_meteo_api_key else FREE_FORECAST

    async def land(self, lat: float, lng: float, start: date, end: date) -> dict[date, dict[str, list[float | None]]]:
        data = await self._get(self._archive, {"latitude": lat, "longitude": lng, "start_date": start.isoformat(), "end_date": end.isoformat(), "models": "era5_land", "hourly": ",".join((*SOIL_VARS, "temperature_2m"))})
        return parse_era5_land(data)

    async def reanalysis(self, lat: float, lng: float, start: date, end: date) -> dict[date, dict[str, list[float | None]]]:
        data = await self._get(self._archive, {"latitude": lat, "longitude": lng, "start_date": start.isoformat(), "end_date": end.isoformat(), "models": "era5", "hourly": "precipitation,et0_fao_evapotranspiration,wind_gusts_10m"})
        return parse_era5(data)

    async def model(self, lat: float, lng: float, past_days: int = 10, forecast_days: int = 8) -> dict[date, dict[str, list[float | None]]]:
        data = await self._get(self._forecast, {"latitude": lat, "longitude": lng, "past_days": past_days, "forecast_days": forecast_days, "hourly": ",".join((*MODEL_SOIL_VARS, "precipitation", "et0_fao_evapotranspiration", "temperature_2m", "wind_gusts_10m"))})
        return parse_model(data)


def year_chunks(start: date, end: date) -> list[tuple[date, date]]:
    """Arşiv çağrıları yıllık parçalara bölünür (yanıt boyutu ve hız sınırı)."""
    out, cursor = [], start
    while cursor <= end:
        chunk_end = min(end, date(cursor.year, 12, 31))
        out.append((cursor, chunk_end))
        cursor = chunk_end + timedelta(days=1)
    return out
