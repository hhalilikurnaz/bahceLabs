"""Doğrulama gözlemlerini (SMAP, IMERG, CHIRPS) bahçe noktası için çeker ve `dogrulama_gozlem` tablosuna yazar (idempotent: var olan gün atlanır)."""

from __future__ import annotations

import logging
import os
import uuid
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from typing import Any

from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.config import get_settings
from bahcelab_backend.domain.water.models import ValidationObservationModel
from bahcelab_backend.domain.water.validation import (
    Observation,
    chirps_value,
    days_between,
    ease2_rowcol,
    granule_day,
    imerg_value,
    smap_block,
)
from bahcelab_backend.shared.http_range import open_remote

logger = logging.getLogger(__name__)
SMAP, IMERG, CHIRPS = "smap-l3", "imerg-daily", "chirps-daily"
WORKERS = 8
CHIRPS_WORKERS = 2  # data.chc.ucsb.edu hız sınırı uygular (403): az eşzamanlı, aralıklı istek


def _earthaccess() -> Any:
    """earthaccess'e ortamdaki belirteçle giriş yapar (belirteç yalnız ortam değişkeninden; loglanmaz)."""
    import earthaccess

    token = get_settings().earthdata_token
    if not token:
        raise RuntimeError("EARTHDATA_TOKEN tanımlı değil (bahcelab-backend/.env.local).")
    os.environ["EARTHDATA_TOKEN"] = token
    auth = earthaccess.login(strategy="environment")
    if not getattr(auth, "authenticated", False):
        raise RuntimeError("Earthdata girişi başarısız (belirteç geçersiz ya da süresi dolmuş).")
    return earthaccess


async def existing_days(session: AsyncSession, garden_id: uuid.UUID, source_id: str) -> set[date]:
    rows = await session.execute(text("SELECT DISTINCT tarih FROM dogrulama_gozlem WHERE garden_id = :g AND source_id = :s"), {"g": garden_id, "s": source_id})
    return {r[0] for r in rows.all()}


async def store(session: AsyncSession, garden_id: uuid.UUID, source_id: str, results: dict[date, list[Observation]]) -> int:
    values = [
        {"garden_id": garden_id, "source_id": source_id, "tarih": day, "indeks": o.indeks, "deger": o.deger, "ayrinti": o.ayrinti}
        for day, observations in results.items()
        for o in observations
    ]
    for i in range(0, len(values), 400):
        stmt = insert(ValidationObservationModel).values(values[i : i + 400])
        await session.execute(stmt.on_conflict_do_update(index_elements=["garden_id", "source_id", "tarih", "indeks"], set_={"deger": stmt.excluded.deger, "ayrinti": stmt.excluded.ayrinti}))
    return len(values)


def fetch_smap(lat: float, lng: float, days: list[date]) -> dict[date, list[Observation]]:
    import h5py

    ea = _earthaccess()
    granules = {}
    for g in ea.search_data(short_name="SPL3SMP_E", temporal=(days[0].isoformat(), days[-1].isoformat()), bounding_box=(lng - 0.3, lat - 0.3, lng + 0.3, lat + 0.3)):
        link = next((link for link in g.data_links() if link.endswith(".h5")), None)
        if link and (day := granule_day(link)) in set(days):
            granules[day] = link
    row, col = ease2_rowcol(lat, lng)

    def one(item: tuple[date, str]) -> tuple[date, list[Observation]]:
        day, url = item
        try:
            with h5py.File(open_remote(url, ea.get_requests_https_session()), "r") as handle:
                return day, smap_block(handle, row, col)
        except Exception as exc:  # noqa: BLE001 - tek granül hatası diğerlerini durdurmaz
            logger.warning("SMAP okunamadı %s: %s", day, type(exc).__name__)
            return day, []

    with ThreadPoolExecutor(WORKERS) as pool:
        return {day: obs for day, obs in pool.map(one, granules.items()) if obs}


def fetch_chirps(lat: float, lng: float, days: list[date]) -> dict[date, list[Observation]]:
    def one(day: date) -> tuple[date, list[Observation]]:
        try:
            obs = chirps_value(day, lat, lng)
        except Exception as exc:  # noqa: BLE001
            logger.warning("CHIRPS okunamadı %s: %s", day, type(exc).__name__)
            obs = None
        return day, [obs] if obs is not None else []

    with ThreadPoolExecutor(CHIRPS_WORKERS) as pool:
        return {day: obs for day, obs in pool.map(one, days) if obs}


def fetch_imerg(lat: float, lng: float, days: list[date]) -> dict[date, list[Observation]]:
    import h5py

    ea = _earthaccess()
    urls: dict[date, str] = {}
    for short in ("GPM_3IMERGDF", "GPM_3IMERGDL"):  # önce Final, olmayan son günler için Late
        for g in ea.search_data(short_name=short, temporal=(days[0].isoformat(), days[-1].isoformat())):
            link = next((link for link in g.data_links() if link.endswith(".nc4")), None)
            if link and (day := granule_day(link)) in set(days) and day not in urls:
                urls[day] = link

    if urls:  # EULA onayı yoksa GES DISC 403 verir: günlerce boş sonuç yerine hemen açık hata
        probe = ea.get_requests_https_session().get(next(iter(urls.values())), headers={"Range": "bytes=0-0"}, timeout=60)
        if probe.status_code == 403:
            raise RuntimeError("GES DISC erişimi reddedildi (403): Earthdata profilinde «NASA GESDISC DATA ARCHIVE» uygulaması onaylanmalı: https://urs.earthdata.nasa.gov/approve_app?client_id=e2WVk8Pw6weeLUKZYOxvTQ")

    def one(item: tuple[date, str]) -> tuple[date, list[Observation]]:
        day, url = item
        try:
            with h5py.File(open_remote(url, ea.get_requests_https_session()), "r") as handle:
                return day, [imerg_value(handle, lat, lng)]
        except Exception as exc:  # noqa: BLE001
            logger.warning("IMERG okunamadı %s: %s", day, type(exc).__name__)
            return day, []

    with ThreadPoolExecutor(WORKERS) as pool:
        return {day: obs for day, obs in pool.map(one, urls.items()) if obs}


FETCHERS: dict[str, Callable[[float, float, list[date]], dict[date, list[Observation]]]] = {SMAP: fetch_smap, CHIRPS: fetch_chirps, IMERG: fetch_imerg}


async def sync_validation(session: AsyncSession, garden_id: uuid.UUID, source_id: str, start: date, end: date, *, chunk_days: int = 30) -> dict[str, int]:
    """[start, end] eksik günleri parça parça çeker ve yazar. Dönüş: aranan gün, yazılan gözlem."""
    import asyncio

    row = (await session.execute(text("SELECT ST_Y(ST_Centroid(geom)), ST_X(ST_Centroid(geom)) FROM gardens WHERE id = :g"), {"g": garden_id})).one()
    lat, lng = float(row[0]), float(row[1])
    have = await existing_days(session, garden_id, source_id)
    todo = [d for d in days_between(start, end) if d not in have]
    written = 0
    chunks = [todo[i : i + chunk_days] for i in range(0, len(todo), chunk_days)]
    for chunk in reversed(chunks):  # en yeni parça önce: süre dolarsa en güncel dönem hazır olur (ağ hızı SMAP için sınırlayıcı)
        results = await asyncio.to_thread(FETCHERS[source_id], lat, lng, chunk)
        written += await store(session, garden_id, source_id, results)
        await session.commit()
    return {"aranan_gun": len(todo), "yazilan": written}
