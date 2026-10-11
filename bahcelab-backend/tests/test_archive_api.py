from datetime import date

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from .conftest import make_client, register
from .test_ndvi_api import ALL_MEANS, add_scene, new_garden


@pytest.fixture
def factory(test_engine):
    return async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture
async def user_client(client: AsyncClient, cleanup_users):
    await register(client)
    return client


async def seed(factory, gid: str) -> None:
    """2026: Eki'de iki net (bulut 3 ve 8), Eyl'de bir bulutlu ve bir net(%9); 2025: tek net."""
    await add_scene(factory, gid, date(2026, 10, 9), {**ALL_MEANS, "ndvi": 0.60}, cloud=3.0)
    await add_scene(factory, gid, date(2026, 10, 4), {**ALL_MEANS, "ndvi": 0.58}, cloud=8.0)
    await add_scene(factory, gid, date(2026, 9, 28), {}, durum="bulutlu", cloud=80.0)
    await add_scene(factory, gid, date(2026, 9, 20), {**ALL_MEANS, "ndvi": 0.55}, cloud=9.0)
    await add_scene(factory, gid, date(2025, 11, 3), {**ALL_MEANS, "ndvi": 0.50}, cloud=1.0)


async def test_archive_requires_login(client: AsyncClient):
    response = await client.get("/gardens/00000000-0000-0000-0000-000000000001/indeks/arsiv")
    assert response.status_code == 401


async def test_archive_lists_the_latest_season_newest_first(user_client: AsyncClient, factory):
    garden = await new_garden(user_client)
    await seed(factory, garden["id"])
    data = (await user_client.get(f"/gardens/{garden['id']}/indeks/arsiv")).json()
    assert data["sezon"] == 2026 and data["sezonlar"] == [2026, 2025]
    assert [s["tarih"] for s in data["sahneler"]] == ["2026-10-09", "2026-10-04", "2026-09-28", "2026-09-20"]
    assert (data["toplam"], data["net_sayisi"], data["bulutlu_sayisi"]) == (4, 3, 1)
    first = data["sahneler"][0]
    assert first["deger"] == 0.6 and first["bulut_orani"] == 3.0 and first["ham_veri_var"] is True
    assert first["kucuk_resim_url"].endswith("/indeks/ndvi/2026-10-09/thumb.png")


async def test_cloudy_scene_has_no_value_or_thumbnail_and_is_not_net(user_client: AsyncClient, factory):
    garden = await new_garden(user_client)
    await seed(factory, garden["id"])
    data = (await user_client.get(f"/gardens/{garden['id']}/indeks/arsiv")).json()
    cloudy = next(s for s in data["sahneler"] if s["tarih"] == "2026-09-28")
    assert cloudy["durum"] == "bulutlu" and cloudy["deger"] is None
    assert cloudy["kucuk_resim_url"] is None and cloudy["net"] is False and cloudy["en_net"] is False


async def test_best_scene_of_each_month_is_marked(user_client: AsyncClient, factory):
    garden = await new_garden(user_client)
    await seed(factory, garden["id"])
    data = (await user_client.get(f"/gardens/{garden['id']}/indeks/arsiv")).json()
    marked = {s["tarih"] for s in data["sahneler"] if s["en_net"]}
    # Ekim: bulut %3 olan; Eylül: tek net olan (%9)
    assert marked == {"2026-10-09", "2026-09-20"}


async def test_season_parameter_selects_another_year(user_client: AsyncClient, factory):
    garden = await new_garden(user_client)
    await seed(factory, garden["id"])
    data = (await user_client.get(f"/gardens/{garden['id']}/indeks/arsiv", params={"sezon": 2025})).json()
    assert data["sezon"] == 2025 and [s["tarih"] for s in data["sahneler"]] == ["2025-11-03"]
    empty = (await user_client.get(f"/gardens/{garden['id']}/indeks/arsiv", params={"sezon": 2020})).json()
    assert empty["toplam"] == 0 and empty["sahneler"] == []


async def test_other_parameters_and_true_color(user_client: AsyncClient, factory):
    garden = await new_garden(user_client)
    await seed(factory, garden["id"])
    ndre = (await user_client.get(f"/gardens/{garden['id']}/indeks/arsiv", params={"parametre": "ndre"})).json()
    assert ndre["sahneler"][0]["deger"] == 0.5
    color = (await user_client.get(f"/gardens/{garden['id']}/indeks/arsiv", params={"parametre": "gercek-renk"})).json()
    assert color["sahneler"][0]["deger"] is None
    assert color["sahneler"][0]["kucuk_resim_url"].endswith("/gercek-renk/2026-10-09/thumb.png")


async def test_pagination(user_client: AsyncClient, factory):
    garden = await new_garden(user_client)
    await seed(factory, garden["id"])
    page = (await user_client.get(f"/gardens/{garden['id']}/indeks/arsiv", params={"boyut": 3, "sayfa": 2})).json()
    assert (page["sayfa"], page["sayfa_sayisi"], page["toplam"]) == (2, 2, 4)
    assert [s["tarih"] for s in page["sahneler"]] == ["2026-09-20"]
    beyond = (await user_client.get(f"/gardens/{garden['id']}/indeks/arsiv", params={"boyut": 3, "sayfa": 9})).json()
    assert beyond["sayfa"] == 2  # aralık dışı sayfa son sayfaya sıkıştırılır


async def test_invalid_input_is_rejected(user_client: AsyncClient):
    garden = await new_garden(user_client)
    url = f"/gardens/{garden['id']}/indeks/arsiv"
    assert (await user_client.get(url, params={"parametre": "xyz"})).status_code == 404
    assert (await user_client.get(url, params={"sezon": 1999})).status_code == 422
    assert (await user_client.get(url, params={"sayfa": 0})).status_code == 422
    assert (await user_client.get(url, params={"boyut": 0})).status_code == 422


async def test_archive_of_garden_without_images_is_empty_not_error(user_client: AsyncClient):
    garden = await new_garden(user_client)
    data = (await user_client.get(f"/gardens/{garden['id']}/indeks/arsiv")).json()
    assert data["toplam"] == 0 and data["sezonlar"] == [] and data["sahneler"] == []


async def test_other_users_archive_is_not_found(app, cleanup_users, factory):
    async with make_client(app) as owner, make_client(app) as other:
        await register(owner)
        await register(other)
        garden = await new_garden(owner)
        await seed(factory, garden["id"])
        assert (await other.get(f"/gardens/{garden['id']}/indeks/arsiv")).status_code == 404
        assert (await owner.get(f"/gardens/{garden['id']}/indeks/arsiv")).status_code == 200
