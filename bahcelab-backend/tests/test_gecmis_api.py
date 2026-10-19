"""Geçmiş özeti uç noktası: yıl etiketi diğer yıllara göre, hasat «kayıt yok», yeşerme yalnız güvenilirse (uydurma yok)."""

import uuid
from datetime import date

from .test_agro_api import new_garden
from .test_status_v2_api import add_acquisition, factory, user_client  # noqa: F401, F811
from .test_weather_api import clean_cells  # noqa: F401


async def seed_summers(factory, gid: str) -> None:  # noqa: ANN001, F811
    for year in range(2015, 2025):
        for month in (6, 7, 8, 9):
            ndvi = 0.40 if year == 2021 else 0.60 + 0.002 * (year % 5)
            await add_acquisition(factory, gid, date(year, month, 15), ndvi, 0.2, 0.3)


async def test_history_summary_labels_each_year_against_the_others_and_never_invents(user_client, factory):  # noqa: F811
    garden = await new_garden(user_client)
    await seed_summers(factory, garden["id"])
    data = (await user_client.get(f"/gardens/{garden['id']}/gecmis-ozeti")).json()
    by = {y["yil"]: y for y in data["yillar"]}
    assert data["ilk_yil"] == 2015 and [y["yil"] for y in data["yillar"]][:3] == [2015, 2016, 2017]
    assert by[2021]["canlilik"] == "belirgin_dusuk" and by[2018]["canlilik"] == "normal"
    assert all(y["hasat"]["durum"] == "kayit_yok" for y in data["yillar"])  # hasat uydurulmaz
    assert by[2025]["canlilik"] is None and by[2025]["canlilik_nedeni"] == "yaz verisi yetersiz"
    assert by[2021]["uyumsuz"] is None and by[2021]["olay_sayisi"] == 0
    assert data["yesillenme"] == [] and "ön değer" in data["esik_durumu"]  # gözlem yok: yeşerme gösterilmez


async def test_history_summary_of_a_garden_without_images_is_empty_not_an_error(user_client):  # noqa: F811
    garden = await new_garden(user_client)
    data = (await user_client.get(f"/gardens/{garden['id']}/gecmis-ozeti")).json()
    assert data["ilk_yil"] is None and data["yillar"] == [] and data["yesillenme"] == []


async def test_history_summary_of_an_unknown_garden_is_404(user_client):  # noqa: F811
    assert (await user_client.get(f"/gardens/{uuid.uuid4()}/gecmis-ozeti")).status_code == 404
