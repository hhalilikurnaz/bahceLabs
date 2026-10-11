from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import httpx
import pytest
from httpx import AsyncClient
from sqlalchemy import text

from bahcelab_backend.api.deps import get_weather_provider
from bahcelab_backend.domain.weather.open_meteo import OpenMeteoProvider
from bahcelab_backend.domain.weather.provider import DailyPoint, Forecast, WeatherSourceError

from .conftest import make_client, register
from .support.weather_sample import build_sample_forecast, build_sample_history
from .test_gardens_api import garden_body, square

# Diğer testlerin (ve geliştirme verisinin) hücrelerinden ayrı bir konum
LNG, LAT = 27.15, 38.45


class FakeProvider:
    name = "test-saglayici"
    attribution = "Hava verisi: Test (CC BY 4.0)"

    def __init__(self) -> None:
        self.forecast_calls = 0
        self.history_calls: list[tuple[date, date]] = []
        self.offline = False
        self.frost = False

    def build(self) -> Forecast:
        forecast = build_sample_forecast(datetime.now(ZoneInfo("Europe/Istanbul")))
        if self.frost:
            tomorrow = (datetime.now(ZoneInfo("Europe/Istanbul")) + timedelta(days=1)).date()
            for hour in forecast.hourly:
                if hour.zaman[:10] == tomorrow.isoformat() and int(hour.zaman[11:13]) in (3, 4, 5, 6):
                    hour.sicaklik = -1.5
        return forecast

    async def forecast(self, lat, lng, past_days=7):
        self.forecast_calls += 1
        if self.offline:
            raise WeatherSourceError("ağ yok")
        return self.build()

    async def history(self, lat, lng, start, end):
        self.history_calls.append((start, end))
        if self.offline:
            raise WeatherSourceError("ağ yok")
        today = datetime.now(ZoneInfo("Europe/Istanbul")).date()
        return [p for p in build_sample_history(today, 830) if start <= p.tarih <= end]


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


async def new_garden(client: AsyncClient, lng: float = LNG, lat: float = LAT, **extra) -> dict:
    response = await client.post("/gardens", json=garden_body(geometry=square(161, lng, lat), **extra))
    assert response.status_code == 201, response.text
    return response.json()


async def test_weather_requires_login(client: AsyncClient, provider):
    assert (await client.get("/weather/ozet")).status_code == 401
    assert (await client.get("/gardens/00000000-0000-0000-0000-000000000001/weather")).status_code == 401


async def test_weather_response_shape(user_client: AsyncClient, provider):
    garden = await new_garden(user_client)
    response = await user_client.get(f"/gardens/{garden['id']}/weather")
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["kaynak"] == "test-saglayici" and "CC BY 4.0" in data["atif"]
    assert data["onbellekten"] is False
    assert len(data["gunler"]) == 7 and len(data["saatlik"]) == 168
    assert data["simdi"]["aciklama"] and data["simdi"]["ikon"]
    day = data["gunler"][0]
    assert {"uygun_saat", "sinirda_saat", "uygun_degil_saat"} <= set(day["ilaclama"])
    assert day["ilaclama"]["uygun_saat"] + day["ilaclama"]["sinirda_saat"] + day["ilaclama"]["uygun_degil_saat"] == 24
    assert {"uygun", "sinirda", "uygun_degil"} >= {h["ilaclama"] for h in data["saatlik"]}
    assert data["su_dengesi"][0]["aciklama"]
    assert [t["etiket"] for t in data["yagis_toplamlari"]] == ["Son 7 gün", "Son 30 gün", "Sezon başından beri"]
    assert data["yagis_toplamlari"][0]["mm"] is not None
    assert data["yagis_toplamlari"][0]["gecen_yil_mm"] is not None  # geçmiş 425 gün tamamlandı


async def test_forecast_is_cached_for_an_hour(user_client: AsyncClient, provider, test_engine):
    garden = await new_garden(user_client)
    url = f"/gardens/{garden['id']}/weather"
    await user_client.get(url)
    await user_client.get(url)
    assert provider.forecast_calls == 1

    async with test_engine.begin() as conn:
        await conn.execute(
            text("UPDATE weather_cells SET tahmin_zamani = now() - interval '61 minutes' WHERE enlem > 38 AND enlem < 39")
        )
    await user_client.get(url)
    assert provider.forecast_calls == 2


async def test_history_is_synced_once_a_day(user_client: AsyncClient, provider, test_engine):
    garden = await new_garden(user_client)
    url = f"/gardens/{garden['id']}/weather"
    await user_client.get(url)
    await user_client.get(f"{url}/history")
    assert len(provider.history_calls) == 1
    start, end = provider.history_calls[0]
    assert (end - start).days >= 420  # ilk senkron: tüm aralık

    # Ertesi gün yalnızca son günler yenilenir
    async with test_engine.begin() as conn:
        await conn.execute(text("UPDATE weather_cells SET gecmis_senkron = current_date - 1 WHERE enlem > 38 AND enlem < 39"))
    await user_client.get(url)
    assert len(provider.history_calls) == 2
    start2, end2 = provider.history_calls[1]
    assert (end2 - start2).days <= 11


async def test_nearby_gardens_share_one_provider_request(user_client: AsyncClient, provider):
    await new_garden(user_client, ad="A")
    await new_garden(user_client, lng=LNG + 0.004, lat=LAT + 0.003, ad="B")  # aynı 0,05° hücre
    response = await user_client.get("/weather/ozet")
    assert response.status_code == 200
    assert len(response.json()) == 2
    assert provider.forecast_calls == 1


async def test_distant_gardens_use_separate_cells(user_client: AsyncClient, provider):
    await new_garden(user_client, ad="A")
    await new_garden(user_client, lng=LNG + 0.3, lat=LAT, ad="B")
    await user_client.get("/weather/ozet")
    assert provider.forecast_calls == 2


async def test_offline_shows_last_cache_with_update_time(user_client: AsyncClient, provider, test_engine):
    garden = await new_garden(user_client)
    url = f"/gardens/{garden['id']}/weather"
    first = (await user_client.get(url)).json()
    async with test_engine.begin() as conn:
        await conn.execute(text("UPDATE weather_cells SET tahmin_zamani = now() - interval '3 hours' WHERE enlem > 38 AND enlem < 39"))
    provider.offline = True
    response = await user_client.get(url)
    assert response.status_code == 200
    data = response.json()
    assert data["onbellekten"] is True
    assert data["guncelleme"] != first["guncelleme"]  # son başarılı güncelleme zamanı
    assert len(data["gunler"]) == 7


async def test_offline_without_cache_is_a_clear_error(user_client: AsyncClient, provider):
    garden = await new_garden(user_client)
    provider.offline = True
    response = await user_client.get(f"/gardens/{garden['id']}/weather")
    assert response.status_code == 503
    assert "Hava durumu" in response.json()["error"]["message"]
    summary = (await user_client.get("/weather/ozet")).json()
    assert summary[0]["hata"] and summary[0]["simdi"] is None


async def test_frost_alert_in_response_and_summary(user_client: AsyncClient, provider):
    provider.frost = True
    garden = await new_garden(user_client)
    data = (await user_client.get(f"/gardens/{garden['id']}/weather")).json()
    (alert,) = [a for a in data["uyarilar"] if a["tur"] == "don"]
    assert alert["seviye"] == "kirmizi" and alert["sure_saat"] == 4 and alert["deger"] == -1.5
    summary = (await user_client.get("/weather/ozet")).json()
    assert summary[0]["uyarilar"][0]["baslik"] == "Don tehlikesi"
    assert summary[0]["simdi"]["sicaklik"] is not None


async def test_history_endpoint_range_and_validation(user_client: AsyncClient, provider):
    garden = await new_garden(user_client)
    today = datetime.now(ZoneInfo("Europe/Istanbul")).date()
    start, end = today - timedelta(days=10), today - timedelta(days=1)
    response = await user_client.get(
        f"/gardens/{garden['id']}/weather/history", params={"from": start.isoformat(), "to": end.isoformat()}
    )
    assert response.status_code == 200
    days = response.json()["gunler"]
    assert [d["tarih"] for d in days] == [(start + timedelta(days=i)).isoformat() for i in range(10)]
    assert {"min", "max", "yagis_mm", "et0_mm"} <= set(days[0])

    bad = await user_client.get(
        f"/gardens/{garden['id']}/weather/history", params={"from": end.isoformat(), "to": start.isoformat()}
    )
    assert bad.status_code == 422
    too_long = await user_client.get(
        f"/gardens/{garden['id']}/weather/history", params={"from": "2020-01-01", "to": end.isoformat()}
    )
    assert too_long.status_code == 422


async def test_other_users_garden_is_not_found(app, provider, cleanup_users):
    async with make_client(app) as owner, make_client(app) as other:
        await register(owner)
        await register(other)
        garden = await new_garden(owner)
        assert (await other.get(f"/gardens/{garden['id']}/weather")).status_code == 404
        assert (await other.get(f"/gardens/{garden['id']}/weather/history")).status_code == 404
        assert (await other.get("/weather/ozet")).json() == []
        assert provider.forecast_calls == 0


# --- Open-Meteo biçim dönüşümü (HTTP sahte aktarımla)
OPEN_METEO_FORECAST = {
    "current": {
        "time": "2026-10-10T14:15",
        "temperature_2m": 24.5,
        "relative_humidity_2m": 50,
        "apparent_temperature": 23.1,
        "precipitation": 0.0,
        "weather_code": 2,
        "wind_speed_10m": 12.3,
        "wind_gusts_10m": 20.0,
        "wind_direction_10m": 200,
        "is_day": 1,
    },
    "hourly": {
        "time": ["2026-10-09T23:00", "2026-10-10T00:00", "2026-10-10T01:00"],
        "temperature_2m": [20.0, 19.0, 18.5],
        "relative_humidity_2m": [60, 62, 64],
        "precipitation": [0.0, 0.0, 0.3],
        "precipitation_probability": [0, 5, 40],
        "wind_speed_10m": [5.0, 6.0, 7.0],
        "wind_gusts_10m": [10.0, 11.0, 12.0],
        "et0_fao_evapotranspiration": [0.0, 0.0, 0.0],
        "weather_code": [0, 1, 61],
    },
    "daily": {
        "time": ["2026-10-09", "2026-10-10"],
        "temperature_2m_max": [26.0, 25.0],
        "temperature_2m_min": [15.0, None],
        "precipitation_sum": [0.0, 0.3],
        "et0_fao_evapotranspiration": [3.8, 3.5],
        "weather_code": [1, 61],
        "precipitation_probability_max": [10, 40],
        "wind_speed_10m_max": [15.0, 14.0],
        "wind_gusts_10m_max": [25.0, 22.0],
    },
}


async def test_open_meteo_parsing_and_request_params():
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        if "archive" in request.url.host:
            return httpx.Response(
                200,
                json={
                    "daily": {
                        "time": ["2026-10-08", "2026-10-09"],
                        "temperature_2m_max": [25.0, None],
                        "temperature_2m_min": [14.0, None],
                        "precipitation_sum": [1.2, None],
                        "et0_fao_evapotranspiration": [3.9, None],
                    }
                },
            )
        return httpx.Response(200, json=OPEN_METEO_FORECAST)

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    provider = OpenMeteoProvider(client)

    forecast = await provider.forecast(36.6, 34.2)
    params = seen[0].url.params
    assert params["timezone"] == "Europe/Istanbul" and params["wind_speed_unit"] == "kmh"
    assert params["forecast_days"] == "7" and "et0_fao_evapotranspiration" in params["hourly"]
    assert forecast.current.sicaklik == 24.5 and forecast.current.kod == 2
    # Geçmiş gün saatlik verisi atılır, eksik min sıcaklık None kalır
    assert [h.zaman for h in forecast.hourly] == ["2026-10-10T00:00", "2026-10-10T01:00"]
    assert forecast.daily[1].min is None and forecast.daily[0].yagis_olasiligi == 10

    history = await provider.history(36.6, 34.2, date(2026, 10, 8), date(2026, 10, 9))
    assert [(p.tarih.isoformat(), p.yagis) for p in history] == [("2026-10-08", 1.2)]  # yayımlanmamış gün yok
    assert seen[1].url.host == "archive-api.open-meteo.com"


async def test_open_meteo_http_errors_become_source_errors():
    client = httpx.AsyncClient(transport=httpx.MockTransport(lambda r: httpx.Response(500)))
    with pytest.raises(WeatherSourceError):
        await OpenMeteoProvider(client).forecast(36.6, 34.2)

    def broken(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"current": {}})

    with pytest.raises(WeatherSourceError):
        await OpenMeteoProvider(httpx.AsyncClient(transport=httpx.MockTransport(broken))).forecast(36.6, 34.2)


def test_daily_point_dataclass_roundtrip():
    forecast = build_sample_forecast(datetime.now(ZoneInfo("Europe/Istanbul")))
    assert Forecast.model_validate(forecast.model_dump(mode="json")) == forecast
    assert isinstance(forecast.daily[0], DailyPoint)
