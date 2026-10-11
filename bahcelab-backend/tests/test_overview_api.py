import io
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from PIL import Image
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from bahcelab_backend.api.deps import get_weather_provider
from bahcelab_backend.domain.ndvi.thumbnail import make_thumbnail
from bahcelab_backend.domain.overview.status import derive_status
from bahcelab_backend.shared.storage import get_storage

from .conftest import make_client, register
from .support.weather_sample import build_sample_forecast
from .test_gardens_api import square
from .test_ndvi_api import ALL_MEANS, add_scene, new_garden
from .test_weather_api import (  # noqa: F401  (autouse hava hücresi temizliği)
    FakeProvider,
    clean_cells,
)

TODAY = datetime.now(UTC).date()


@pytest.fixture
def factory(test_engine):
    return async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture
async def user_client(client: AsyncClient, cleanup_users):
    await register(client)
    return client


# Hava önbelleği temizlenen bölge (enlem 38–39, boylam 27–28): geliştirme verisiyle karışmaz
CLEAN_LNG, CLEAN_LAT = 27.15, 38.45


async def garden_at(client: AsyncClient, lng: float = CLEAN_LNG, lat: float = CLEAN_LAT, ad: str = "Deneme") -> dict:
    return await new_garden(client, ad=ad, geometry=square(161, lng, lat))


def real_png(size: tuple[int, int] = (400, 300)) -> bytes:
    """Çevresi saydam, ortası boyalı gerçek bir PNG."""
    image = Image.new("RGBA", size, (0, 0, 0, 0))
    image.paste((200, 120, 40, 255), (size[0] // 4, size[1] // 4, size[0] * 3 // 4, size[1] * 3 // 4))
    out = io.BytesIO()
    image.save(out, format="PNG")
    return out.getvalue()


# --- durum etiketi (tek fonksiyon)
def test_status_rules():
    """Tek durum fonksiyonu: skor etiketi + uyarılar (kırmızı en fazla «dikkat», sarı en fazla «izle» bırakır)."""
    assert derive_status(has_data=True, severities=[], score=90) == "iyi"
    assert derive_status(has_data=True, severities=[], score=75) == "iyi"  # sınır dahil
    assert derive_status(has_data=True, severities=[], score=74) == "izle"
    assert derive_status(has_data=True, severities=[], score=50) == "izle"
    assert derive_status(has_data=True, severities=[], score=49) == "dikkat"
    assert derive_status(has_data=True, severities=["sari"], score=95) == "izle"  # sarı uyarı «iyi»yi engeller
    assert derive_status(has_data=True, severities=["sari", "kirmizi"], score=95) == "dikkat"
    assert derive_status(has_data=True, severities=[], score=None) == "iyi"  # skor yok (geçmiş yetersiz), uyarı da yok
    assert derive_status(has_data=True, severities=["sari"], score=None) == "izle"
    assert derive_status(has_data=False, severities=[], score=None) == "veri_yok"
    assert derive_status(has_data=False, severities=["kirmizi"], score=None) == "dikkat"  # kırmızı hava uyarısı veri yokken de görünür


def test_thumbnail_crops_transparent_margin_and_limits_size():
    thumb = Image.open(io.BytesIO(make_thumbnail(real_png((800, 400)), 160)))
    assert max(thumb.size) == 160
    assert thumb.size == (160, 80)  # kırpılan alan orijinalin yarısı: oran korunur
    assert thumb.getchannel("A").getbbox() == (0, 0, 160, 80)  # saydam kenar kalmadı


# --- API
async def test_overview_requires_login(client: AsyncClient):
    assert (await client.get("/gardens/overview")).status_code == 401


async def test_overview_empty_account(user_client: AsyncClient):
    data = (await user_client.get("/gardens/overview")).json()
    assert data["bahceler"] == []
    assert data["toplamlar"] == {"bahce_sayisi": 0, "toplam_dekar": 0, "dikkat_sayisi": 0, "izle_sayisi": 0}


async def test_overview_garden_without_images_is_honest(user_client: AsyncClient):
    garden = await garden_at(user_client)
    (item,) = (await user_client.get("/gardens/overview")).json()["bahceler"]
    assert item["id"] == garden["id"]
    assert item["durum"] == "veri_yok" and item["son_goruntu"] is None and item["seri"] == []
    assert item["hava"] is None and item["uyarilar"] == []
    assert {"ad", "urun", "dekar", "il", "ilce"} <= set(item)


async def test_overview_with_images_series_and_thumbnail(user_client: AsyncClient, factory):
    garden = await garden_at(user_client)
    gid = garden["id"]
    for days_ago, mean in ((40, 0.4), (20, 0.5), (3, 0.6)):
        await add_scene(factory, gid, TODAY - timedelta(days=days_ago), {**ALL_MEANS, "ndvi": mean})
    latest = TODAY - timedelta(days=3)
    get_storage().save(f"indeks/{gid}/{latest}/ndvi.png", real_png())

    body = (await user_client.get("/gardens/overview")).json()
    (item,) = body["bahceler"]
    assert item["durum"] == "iyi" and item["indeks"] == "ndvi"
    # Yalnızca son 30 gün: 40 gün önceki nokta dışarıda
    assert [p["deger"] for p in item["seri"]] == [0.5, 0.6]
    assert item["son_goruntu"]["tarih"] == latest.isoformat()
    assert body["toplamlar"]["bahce_sayisi"] == 1 and body["toplamlar"]["toplam_dekar"] > 0

    thumb = await user_client.get(item["son_goruntu"]["kucuk_resim_url"])
    assert thumb.status_code == 200 and thumb.headers["content-type"] == "image/png"
    assert max(Image.open(io.BytesIO(thumb.content)).size) <= 160
    # İkinci istek depolanmış küçük resimden gelir
    assert get_storage().exists(f"indeks/{gid}/{latest}/ndvi-kucuk.png")
    assert (await user_client.get(item["son_goruntu"]["kucuk_resim_url"])).content == thumb.content


async def test_overview_status_follows_alerts(user_client: AsyncClient, factory):
    garden = await garden_at(user_client)
    gid = garden["id"]
    await add_scene(factory, gid, TODAY - timedelta(days=18), {**ALL_MEANS, "ndvi": 0.7})
    await add_scene(factory, gid, TODAY - timedelta(days=2), {**ALL_MEANS, "ndvi": 0.5})
    (item,) = (await user_client.get("/gardens/overview")).json()["bahceler"]
    assert item["durum"] == "izle"
    assert [(u["kaynak"], u["seviye"]) for u in item["uyarilar"]] == [("uydu", "sari")]
    assert item["durum_nedeni"] == item["uyarilar"][0]["baslik"]


async def test_overview_reads_cached_weather_without_network(app, user_client: AsyncClient):
    provider = FakeProvider()
    provider.frost = True
    app.dependency_overrides[get_weather_provider] = lambda: provider
    garden = await garden_at(user_client)
    assert (await user_client.get(f"/gardens/{garden['id']}/weather")).status_code == 200  # önbelleği doldurur
    calls = provider.forecast_calls

    (item,) = (await user_client.get("/gardens/overview")).json()["bahceler"]
    assert provider.forecast_calls == calls  # özet ağa çıkmaz
    assert item["hava"]["bayat"] is False and item["hava"]["ikon"]
    assert item["durum"] == "dikkat"  # kırmızı don uyarısı
    assert ("hava", "kirmizi") in [(u["kaynak"], u["seviye"]) for u in item["uyarilar"]]
    assert item["uyarilar"][0]["seviye"] == "kirmizi"  # kırmızılar önce


async def test_overview_unknown_parameter_is_rejected(user_client: AsyncClient):
    assert (await user_client.get("/gardens/overview", params={"indeks": "xyz"})).status_code == 422


async def test_overview_never_leaks_other_users_gardens(app, cleanup_users, factory):
    async with make_client(app) as owner, make_client(app) as other:
        await register(owner)
        await register(other)
        garden = await garden_at(owner)
        await add_scene(factory, garden["id"], TODAY - timedelta(days=2), ALL_MEANS)
        get_storage().save(f"indeks/{garden['id']}/{TODAY - timedelta(days=2)}/ndvi.png", real_png())
        assert (await other.get("/gardens/overview")).json()["bahceler"] == []
        url = f"/gardens/{garden['id']}/indeks/ndvi/{TODAY - timedelta(days=2)}/thumb.png"
        assert (await other.get(url)).status_code == 404
        assert (await owner.get(url)).status_code == 200


async def test_overview_query_count_does_not_grow_with_gardens(user_client: AsyncClient, factory, test_engine):
    statements: list[str] = []

    def record(conn, cursor, statement, parameters, context, executemany):  # noqa: ANN001
        statements.append(statement)

    async def count() -> int:
        statements.clear()
        assert (await user_client.get("/gardens/overview")).status_code == 200
        return len([s for s in statements if "gardens" in s or "scene_observations" in s or "index_observations" in s or "weather_cells" in s])

    first = await garden_at(user_client, ad="A")
    await add_scene(factory, first["id"], TODAY - timedelta(days=2), ALL_MEANS)
    event.listen(test_engine.sync_engine, "before_cursor_execute", record)
    try:
        one = await count()
        for i in range(5):
            garden = await garden_at(user_client, lng=CLEAN_LNG + 0.1 + i * 0.1, ad=f"B{i}")
            await add_scene(factory, garden["id"], TODAY - timedelta(days=2), ALL_MEANS)
        six = await count()
    finally:
        event.remove(test_engine.sync_engine, "before_cursor_execute", record)
    assert one == six, f"sorgu sayısı bahçe sayısına bağlı: 1 bahçe={one}, 6 bahçe={six}"
    assert six <= 8
    assert build_sample_forecast  # fixture import'u kullanımda
