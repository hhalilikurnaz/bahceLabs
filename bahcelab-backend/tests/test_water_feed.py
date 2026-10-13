"""ERA5 besleme işi (ADR 0018): ilk geçmiş doldurma (2015→), artımlı çekim, hücre paylaşımı, idempotans, bahçe eklenince kendiliğinden başlama. Ağsız (sahte ERA5 istemcisi)."""

import asyncio
import uuid
from datetime import date, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from bahcelab_backend.config import get_settings
from bahcelab_backend.domain.water import feed
from bahcelab_backend.domain.water.era5_sync import garden_cell
from bahcelab_backend.jobs import feed as job_feed

from .conftest import register
from .support.fake_era5 import FakeEra5Client
from .test_gardens_api import LAT, LNG, garden_body, square


@pytest.fixture
def factory(test_engine):
    return async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture
async def user_client(client: AsyncClient, cleanup_users):
    await register(client)
    return client


async def new_garden(client: AsyncClient, lng: float, lat: float) -> uuid.UUID:
    response = await client.post("/gardens", json=garden_body(geometry=square(150, lng, lat)))
    assert response.status_code == 201, response.text
    return uuid.UUID(response.json()["id"])


async def clear_cell(factory, garden_id: uuid.UUID) -> uuid.UUID:
    async with factory() as session:
        cell, _, _ = await garden_cell(session, garden_id)
        await session.execute(text("DELETE FROM era5_daily WHERE cell_id = :c"), {"c": cell})
        await session.commit()
    return cell


async def count_days(factory, cell: uuid.UUID) -> tuple[int, date, date]:
    async with factory() as session:
        row = (await session.execute(text("SELECT count(*), min(tarih), max(tarih) FROM era5_daily WHERE cell_id = :c"), {"c": cell})).one()
    return int(row[0]), row[1], row[2]


async def test_first_feed_backfills_from_2015_then_incremental_feed_reads_only_the_recent_days_and_is_idempotent(user_client, factory):
    gid = await new_garden(user_client, LNG + 0.31, LAT + 0.21)
    cell = await clear_cell(factory, gid)
    client = FakeEra5Client()
    FakeEra5Client.calls.clear()
    first = await feed.feed_garden(factory, gid, client)
    count, first_day, last_day = await count_days(factory, cell)
    assert first["kip"] == "ilk" and first_day == date(2015, 1, 1) and last_day >= client.today + timedelta(days=5)
    archive_calls_first = FakeEra5Client.calls.count("land")
    assert archive_calls_first >= 11  # 2015'ten bugüne yıllık parçalar

    FakeEra5Client.calls.clear()
    second = await feed.feed_garden(factory, gid, client)
    assert second["kip"] == "artimli" and FakeEra5Client.calls.count("land") == 1  # tek parça: son günler
    assert (await count_days(factory, cell))[0] == count  # idempotent: aynı satırlar, çoğalma yok


async def test_gardens_in_the_same_weather_cell_share_one_feed(user_client, factory):
    a = await new_garden(user_client, LNG + 0.32, LAT + 0.22)
    b = await new_garden(user_client, LNG + 0.3201, LAT + 0.2201)  # aynı 0,05° hücre
    async with factory() as session:
        assert (await garden_cell(session, a))[0] == (await garden_cell(session, b))[0]
        await session.commit()
    await clear_cell(factory, a)
    FakeEra5Client.calls.clear()
    out = await feed.feed_all(factory, FakeEra5Client())
    assert out["hata"] == 0 and out["hucre"] >= 1
    async with factory() as session:  # her hücre bir kez: bu ikili için tek çekim
        cell = (await garden_cell(session, a))[0]
        await session.commit()
    assert (await count_days(factory, cell))[0] > 4000


async def test_one_failing_cell_does_not_stop_the_others(user_client, factory):
    await new_garden(user_client, LNG + 0.33, LAT + 0.23)

    class Broken(FakeEra5Client):
        async def land(self, lat, lng, start, end):  # noqa: ANN001, ANN201
            raise RuntimeError("ağ yok")

    out = await feed.feed_all(factory, Broken())
    assert out["hata"] >= 1  # hata sayılır ve günlüğe yazılır; döngü çökmez


async def test_creating_a_garden_starts_the_feed_by_itself_and_su_fills(user_client, factory, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "era5_auto_feed", True)
    monkeypatch.setattr(settings, "api_debug", True)
    monkeypatch.setattr(settings, "era5_client", "tests.support.fake_era5:FakeEra5Client")
    monkeypatch.setattr(settings, "earthdata_token", "")  # doğrulama doldurması atlanır (ağ yok)
    monkeypatch.setattr(settings, "ndvi_enabled", True)
    monkeypatch.setattr(settings, "acq_auto_backfill", False)
    # NDVI hattı kapalı olsa da besleme çalışmalı: bahçe eklenince start_initial içinden başlar
    response = await user_client.post("/gardens", json=garden_body(geometry=square(150, LNG + 0.34, LAT + 0.24)))
    assert response.status_code == 201
    gid = uuid.UUID(response.json()["id"])
    cell = None
    for _ in range(100):
        await asyncio.gather(*list(job_feed._TASKS))
        async with factory() as session:
            cell = (await garden_cell(session, gid))[0]
            await session.commit()
        if (await count_days(factory, cell))[0] > 4000:
            break
        await asyncio.sleep(0.1)
    assert cell is not None and (await count_days(factory, cell))[0] > 4000
    body = (await user_client.get(f"/gardens/{gid}/su")).json()
    assert body["profil"]["katmanlar"] and body["profil"]["kok_bolgesi_doluluk"] is not None  # Su sekmesi kendiliğinden doldu


async def test_validation_feed_is_skipped_openly_without_the_earthdata_token(factory, monkeypatch):
    monkeypatch.setattr(get_settings(), "earthdata_token", "")
    out = await feed.feed_validation(factory, uuid.uuid4())
    assert out["durum"].startswith("atlandi")


async def test_custom_era5_client_is_refused_outside_debug(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "api_debug", False)
    monkeypatch.setattr(settings, "era5_client", "tests.support.fake_era5:FakeEra5Client")
    with pytest.raises(RuntimeError, match="API_DEBUG"):
        feed.get_era5_client()
