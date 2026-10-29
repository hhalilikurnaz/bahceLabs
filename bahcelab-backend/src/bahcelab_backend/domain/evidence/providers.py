"""İstasyon gözlemi sağlayıcıları (soyut): Meteostat (NOAA ISD tabanlı, toplu veri) ve elle temin edilen CSV (MGM vb.). Aynı arayüz.

Yalnız gerçek gözlem satırları `gozlem` işaretlenir: Meteostat toplu günlük dosyası istasyonun gözlem envanteri dışındaki günler için model/dolgu değeri içerir; bunlar `model`
işaretlenir ve kanıt olarak KULLANILMAZ (veritabanına yazılmaz).
"""

from __future__ import annotations

import csv
import gzip
import importlib
import io
import json
import math
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Protocol

import httpx

from bahcelab_backend.config import get_settings
from bahcelab_backend.domain.evidence.types import Station, StationDay

BULK = "https://bulk.meteostat.net/v2"


class StationProvider(Protocol):
    name: str

    async def nearest(self, lat: float, lng: float, *, max_km: float, limit: int) -> list[Station]: ...

    async def daily(self, station: Station, start: date, end: date) -> list[StationDay]: ...


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    p = math.radians
    h = math.sin(p(lat2 - lat1) / 2) ** 2 + math.cos(p(lat1)) * math.cos(p(lat2)) * math.sin(p(lng2 - lng1) / 2) ** 2
    return 2 * 6371.0 * math.asin(math.sqrt(h))


def _day(raw: str | None) -> date | None:
    return date.fromisoformat(raw) if raw else None


def _num(raw: str) -> float | None:
    try:
        return float(raw) if raw not in ("", None) else None
    except ValueError:
        return None


class MeteostatProvider:
    """Meteostat toplu veri (bulk.meteostat.net v2): istasyon listesi (lite) + istasyon günlük CSV. Anahtar gerekmez."""

    name = "meteostat"

    def __init__(self, client: httpx.AsyncClient | None = None) -> None:
        self._client = client
        self._stations: list[dict] | None = None
        self._loaded: datetime | None = None

    async def _get(self, path: str) -> bytes:
        async def run(client: httpx.AsyncClient) -> bytes:
            r = await client.get(f"{BULK}/{path}", timeout=60)
            r.raise_for_status()
            return r.content

        if self._client is not None:
            return await run(self._client)
        async with httpx.AsyncClient() as client:
            return await run(client)

    async def _catalog(self) -> list[dict]:
        if self._stations is None or self._loaded is None or datetime.now(UTC) - self._loaded > timedelta(days=1):
            self._stations = json.loads(gzip.decompress(await self._get("stations/lite.json.gz")))
            self._loaded = datetime.now(UTC)
        return self._stations

    async def nearest(self, lat: float, lng: float, *, max_km: float, limit: int) -> list[Station]:
        found: list[Station] = []
        for s in await self._catalog():
            inv = (s.get("inventory") or {}).get("daily") or {}
            loc = s.get("location") or {}
            if not inv.get("start") or not inv.get("end") or loc.get("latitude") is None:
                continue  # günlük gözlemi olmayan istasyon kanıt vermez
            km = haversine_km(lat, lng, float(loc["latitude"]), float(loc["longitude"]))
            if km <= max_km:
                found.append(Station(str(s["id"]), (s.get("name") or {}).get("en") or str(s["id"]), float(loc["latitude"]), float(loc["longitude"]), loc.get("elevation"), _day(inv["start"]), _day(inv["end"]), round(km, 1), self.name))
        return sorted(found, key=lambda x: x.mesafe_km)[:limit]

    async def daily(self, station: Station, start: date, end: date) -> list[StationDay]:
        text = gzip.decompress(await self._get(f"daily/{station.id}.csv.gz")).decode()
        out: list[StationDay] = []
        for row in csv.reader(io.StringIO(text)):  # tarih, tavg, tmin, tmax, prcp, snow, wdir, wspd, wpgt, pres, tsun
            if len(row) < 5:
                continue
            day = date.fromisoformat(row[0])
            if not start <= day <= end:
                continue
            observed = station.gozlem_baslangic is not None and station.gozlem_bitis is not None and station.gozlem_baslangic <= day <= station.gozlem_bitis
            out.append(StationDay(station.id, day, _num(row[2]), _num(row[4]), "gozlem" if observed else "model"))
        return out


class CsvStationProvider:
    """Elle temin edilen gözlem (ör. MGM): `<klasör>/istasyonlar.json` = [{id, ad, lat, lng, yukseklik, gozlem_baslangic, gozlem_bitis}] ve `<klasör>/<id>.csv` (başlık: tarih,tmin,prcp[,kaynak])."""

    name = "csv"

    def __init__(self, folder: str | Path) -> None:
        self._folder = Path(folder)

    async def nearest(self, lat: float, lng: float, *, max_km: float, limit: int) -> list[Station]:
        meta = json.loads((self._folder / "istasyonlar.json").read_text(encoding="utf-8"))
        found = []
        for s in meta:
            km = haversine_km(lat, lng, float(s["lat"]), float(s["lng"]))
            if km <= max_km:
                found.append(Station(str(s["id"]), s["ad"], float(s["lat"]), float(s["lng"]), s.get("yukseklik"), _day(s.get("gozlem_baslangic")), _day(s.get("gozlem_bitis")), round(km, 1), self.name))
        return sorted(found, key=lambda x: x.mesafe_km)[:limit]

    async def daily(self, station: Station, start: date, end: date) -> list[StationDay]:
        out: list[StationDay] = []
        with (self._folder / f"{station.id}.csv").open(encoding="utf-8", newline="") as fh:
            for row in csv.DictReader(fh):
                day = date.fromisoformat(row["tarih"])
                if start <= day <= end:
                    out.append(StationDay(station.id, day, _num(row.get("tmin", "")), _num(row.get("prcp", "")), "model" if (row.get("kaynak") or "").strip().casefold() == "model" else "gozlem"))
        return out


def get_station_provider() -> StationProvider:
    settings = get_settings()
    if settings.station_client:
        if not settings.api_debug:
            raise RuntimeError("STATION_CLIENT yalnızca API_DEBUG=true ortamında kullanılabilir.")
        module, _, name = settings.station_client.partition(":")
        return getattr(importlib.import_module(module), name)()
    if settings.station_provider == "csv":
        return CsvStationProvider(settings.station_csv_dir)
    return MeteostatProvider()
