"""Agro API: katalog, çeşit eşlemesi, fenoloji düzeltmeleri, seriler, durum skoru ve «Bugün» (yetki dahil)."""

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from bahcelab_backend.api.deps import get_weather_provider

from .conftest import make_client, register
from .support.weather_sample import build_sample_history  # noqa: F401
from .test_gardens_api import garden_body, square
from .test_ndvi_api import ALL_MEANS, add_scene
from .test_weather_api import LAT, LNG, FakeProvider


@pytest.fixture
def factory(test_engine):
    return async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture
def provider(app):
    fake = FakeProvider()
    app.dependency_overrides[get_weather_provider] = lambda: fake
    return fake


@pytest.fixture(autouse=True)
async def clean_cells(test_engine):
    async def wipe():
        async with test_engine.begin() as conn:
            await conn.execute(text("DELETE FROM weather_cells WHERE enlem > 38 AND enlem < 39 AND boylam > 27 AND boylam < 28"))

    await wipe()
    yield
    await wipe()


@pytest.fixture
async def user_client(client: AsyncClient, cleanup_users):
    await register(client)
    return client


async def new_garden(client: AsyncClient, **extra) -> dict:
    response = await client.post("/gardens", json=garden_body(geometry=square(161, LNG, LAT), **extra))
    assert response.status_code == 201, response.text
    return response.json()


def istanbul_today() -> date:
    return datetime.now(ZoneInfo("Europe/Istanbul")).date()


async def seed_scenes(factory, garden_id: str, last_ndvi: float = 0.62, count: int = 20) -> None:
    """5 günde bir `count` bulutsuz sahne; sonuncusu 2 gün önce. Önceki değerler 0,62 civarında."""
    last = istanbul_today() - timedelta(days=2)
    for i in range(count):
        day = last - timedelta(days=5 * (count - 1 - i))
        ndvi = last_ndvi if i == count - 1 else 0.62 + (0.005 if i % 2 else -0.005)
        await add_scene(factory, garden_id, day, {**ALL_MEANS, "ndvi": ndvi, "ndmi": 0.2}, cloud=1.0)


# ----------------------------------------------------------------------------- yetki
async def test_agro_endpoints_require_login(client: AsyncClient):
    gid = "00000000-0000-0000-0000-000000000001"
    for path in ["/agro/katalog", f"/gardens/{gid}/agro/seriler", f"/gardens/{gid}/agro/fenoloji", f"/gardens/{gid}/durum", f"/gardens/{gid}/bugun"]:
        assert (await client.get(path)).status_code == 401, path
    assert (await client.put(f"/gardens/{gid}/agro/fenoloji/ciceklenme", json={"baslangic": "03-01", "bitis": "04-01"})).status_code == 401


async def test_other_users_garden_is_not_reachable_through_agro(user_client: AsyncClient, app, provider):
    garden = await new_garden(user_client)
    gid = garden["id"]
    async with make_client(app) as other:
        await register(other)
        for path in [f"/gardens/{gid}/agro/seriler", f"/gardens/{gid}/agro/fenoloji", f"/gardens/{gid}/durum", f"/gardens/{gid}/bugun"]:
            assert (await other.get(path)).status_code == 404, path
        assert (await other.put(f"/gardens/{gid}/agro/fenoloji/ciceklenme", json={"baslangic": "03-01", "bitis": "04-01"})).status_code == 404
        assert (await other.delete(f"/gardens/{gid}/agro/fenoloji/ciceklenme")).status_code == 404


# ----------------------------------------------------------------------------- katalog ve çeşit
async def test_catalog_lists_products_varieties_and_unverified_rules(user_client: AsyncClient):
    data = (await user_client.get("/agro/katalog")).json()
    lemon = next(p for p in data["urunler"] if p["kod"] == "limon")
    assert {"enterdonat", "kutdiken", "lamas", "meyer", "yediveren", "diger"} <= {c["kod"] for c in lemon["cesitler"]}
    assert lemon["fenoloji"]["durum"] == "dogrulanmadi" and lemon["fenoloji"]["kaynak"]
    assert lemon["kc"]["durum"] == "dogrulanmadi" and lemon["gdd_taban_c"] > 0
    other = next(p for p in data["urunler"] if p["kod"] == "diger")
    assert other["fenoloji"] is None and other["gdd_taban_c"] is None


async def test_catalog_exposes_visual_stretch_thresholds_as_unverified_defaults(user_client: AsyncClient):
    """Harita gerilmiş skalasının fiziksel gürültü eşiği katalogdadır (ön değer · mühendis onayı bekliyor), kodda değil."""
    gorsel = (await user_client.get("/agro/katalog")).json()["gorsel"]
    assert gorsel["meta"]["durum"] == "dogrulanmadi" and gorsel["meta"]["kaynak"]
    esik = gorsel["gerilme_min_aralik"]
    assert {"ndvi", "ndre", "ndmi", "msavi", "lai", "yuzey_sicakligi", "radar_vh", "radar_degisim", "degisim"} <= set(esik)
    assert esik["yuzey_sicakligi"] == 1.5 and all(v > 0 for v in esik.values())


async def test_variety_selection_sets_name_and_free_text_is_mapped(user_client: AsyncClient):
    chosen = await new_garden(user_client, cesit_kodu="kutdiken")
    assert (chosen["cesit_kodu"], chosen["cesit"]) == ("kutdiken", "Kütdiken")

    legacy = await new_garden(user_client, cesit="Interdonato")  # eski biçim: serbest metin
    assert (legacy["cesit_kodu"], legacy["cesit"]) == ("enterdonat", "Interdonato")

    other = await new_garden(user_client, cesit_kodu="diger", cesit="Yerel bir çeşit")
    assert (other["cesit_kodu"], other["cesit"]) == ("diger", "Yerel bir çeşit")

    assert (await new_garden(user_client))["cesit_kodu"] is None


async def test_variety_must_belong_to_the_product(user_client: AsyncClient):
    response = await user_client.post("/gardens", json=garden_body(geometry=square(161, LNG, LAT), urun="portakal", cesit_kodu="lamas"))
    assert response.status_code == 422 and "çeşit" in response.text.lower()
    garden = await new_garden(user_client, cesit_kodu="lamas")
    patched = await user_client.patch(f"/gardens/{garden['id']}", json={"urun": "portakal"})
    assert patched.status_code == 200
    assert patched.json()["cesit_kodu"] == "diger"  # eski kod yeni ürüne uymuyor: metinden yeniden eşlendi


# ----------------------------------------------------------------------------- fenoloji
async def test_phenology_defaults_override_and_reset(user_client: AsyncClient):
    garden = await new_garden(user_client, cesit_kodu="meyer")
    url = f"/gardens/{garden['id']}/agro/fenoloji"
    data = (await user_client.get(url)).json()
    assert data["kural"]["durum"] == "dogrulanmadi" and data["kural_yok"] is False
    assert len(data["evreler"]) == 18  # 3 sezon × 6 evre
    bloom = [e for e in data["evreler"] if e["kod"] == "ciceklenme" and e["sezon"] == data["sezon"]][0]
    assert bloom["ozel"] is False and bloom["kc"] is not None

    changed = (await user_client.put(f"{url}/ciceklenme", json={"baslangic": "03-20", "bitis": "05-05"})).json()
    bloom = [e for e in changed["evreler"] if e["kod"] == "ciceklenme" and e["sezon"] == changed["sezon"]][0]
    assert bloom["ozel"] is True and bloom["baslangic_aagg"] == "03-20" and bloom["bitis"].endswith("-05-05")

    reset = (await user_client.delete(f"{url}/ciceklenme")).json()
    assert [e for e in reset["evreler"] if e["kod"] == "ciceklenme" and e["ozel"]] == []


async def test_phenology_validation_and_unknown_stage(user_client: AsyncClient):
    garden = await new_garden(user_client)
    url = f"/gardens/{garden['id']}/agro/fenoloji"
    assert (await user_client.put(f"{url}/ciceklenme", json={"baslangic": "13-40", "bitis": "04-01"})).status_code == 422
    assert (await user_client.put(f"{url}/ciceklenme", json={"baslangic": "02-29", "bitis": "04-01"})).status_code == 422
    assert (await user_client.put(f"{url}/yok-boyle-evre", json={"baslangic": "03-01", "bitis": "04-01"})).status_code == 404


async def test_product_without_rules_reports_no_phenology(user_client: AsyncClient):
    garden = await new_garden(user_client, urun="diger")
    data = (await user_client.get(f"/gardens/{garden['id']}/agro/fenoloji")).json()
    assert data["kural_yok"] is True and data["evreler"] == []


# ----------------------------------------------------------------------------- seriler
async def test_series_cumulates_rain_and_gdd_against_last_season(user_client: AsyncClient, provider):
    garden = await new_garden(user_client)
    data = (await user_client.get(f"/gardens/{garden['id']}/agro/seriler")).json()
    today = istanbul_today()
    year = today.year if today.month >= 10 else today.year - 1
    assert data["sezon"] == year and data["sezon_baslangici"] == f"{year}-10-01"
    days = data["gunler"]
    assert days[0]["tarih"] == f"{year}-10-01" and days[-1]["tarih"] == (today - timedelta(days=1)).isoformat()
    rain = [d["yagis_birikimli_mm"] for d in days]
    assert rain == sorted(rain)  # birikim azalmaz
    gdd = [d["gdd_birikimli"] for d in days]
    assert gdd == sorted(gdd)
    assert data["gdd_taban_c"] == 12.5 and data["gdd_kural"]["durum"] == "dogrulanmadi"
    assert data["onceki_sezon_var"] is True
    assert days[-1]["onceki_yagis_birikimli_mm"] is not None
    assert data["ozet"]["yagis_birikimli_mm"] == rain[-1] and data["ozet"]["onceki_ayni_gun_yagis_mm"] == days[-1]["onceki_yagis_birikimli_mm"]


async def test_series_for_a_product_without_gdd_base_says_so(user_client: AsyncClient, provider):
    garden = await new_garden(user_client, urun="diger")
    data = (await user_client.get(f"/gardens/{garden['id']}/agro/seriler")).json()
    assert data["gdd_taban_c"] is None and all(d["gdd_birikimli"] is None for d in data["gunler"])
    assert any("GDD tabanı" in n for n in data["notlar"])


async def test_series_rejects_future_season_and_handles_missing_weather(user_client: AsyncClient, provider):
    garden = await new_garden(user_client)
    future = istanbul_today().year + 3
    assert (await user_client.get(f"/gardens/{garden['id']}/agro/seriler", params={"sezon": future})).status_code == 422
    provider.offline = True  # ağ yok ve önbellek boş: hava servisi hatası anlaşılır döner
    response = await user_client.get(f"/gardens/{garden['id']}/agro/seriler")
    assert response.status_code in (200, 503)


# ----------------------------------------------------------------------------- durum skoru
# ----------------------------------------------------------------------------- bugün
async def test_today_defaults_to_all_clear_or_spray_window(user_client: AsyncClient, provider):
    garden = await new_garden(user_client)
    data = (await user_client.get(f"/gardens/{garden['id']}/bugun")).json()
    assert 1 <= len(data["maddeler"]) <= 3
    assert {m["tur"] for m in data["maddeler"]} <= {"her_sey_yolunda", "ilaclama", "hava_uyarisi", "indeks_dususu", "zararli_riski", "sulama"}
    for item in data["maddeler"]:
        assert item["baslik"] and item["metin"] and item["sekme"] in ("durum", "analiz", "hava", "gunluk", "rapor")


async def test_today_puts_frost_first(user_client: AsyncClient, provider):
    provider.frost = True
    garden = await new_garden(user_client)
    data = (await user_client.get(f"/gardens/{garden['id']}/bugun")).json()
    first = data["maddeler"][0]
    assert first["tur"] == "hava_uyarisi" and first["sekme"] == "hava" and first["oncelik"] in ("kritik", "uyari")


async def test_today_survives_weather_outage(user_client: AsyncClient, factory, provider):
    garden = await new_garden(user_client)
    await seed_scenes(factory, garden["id"], last_ndvi=0.36)
    provider.offline = True
    response = await user_client.get(f"/gardens/{garden['id']}/bugun")
    assert response.status_code == 200 and response.json()["maddeler"]


