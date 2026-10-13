"""Bildirim merkezi, zamanlanmış işler (idempotent), sulama ve risk uçları (yetki dahil)."""

import uuid
from datetime import date, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from bahcelab_backend.api.deps import get_weather_provider
from bahcelab_backend.config import Settings
from bahcelab_backend.domain.notifications.channels import registry
from bahcelab_backend.jobs import arq_worker, queue
from bahcelab_backend.jobs import registry as job_registry
from bahcelab_backend.jobs.tasks import generate_notifications, refresh_weather

from .conftest import make_client, register
from .test_agro_api import istanbul_today, new_garden, seed_scenes
from .test_gardens_api import garden_body, square
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


async def workspace_of(client: AsyncClient) -> uuid.UUID:
    return uuid.UUID((await client.get("/auth/me")).json()["workspace_id"])


async def run_job(factory, provider, client: AsyncClient):
    return await generate_notifications(factory, provider, workspace_id=await workspace_of(client))


async def listing(client: AsyncClient, **params) -> dict:
    return (await client.get("/notifications", params=params)).json()


# ----------------------------------------------------------------------------- yetki
async def test_notifications_require_login(client: AsyncClient):
    for method, path in [("GET", "/notifications"), ("POST", "/notifications/okundu"), ("GET", "/notifications/tercihler"),
                         ("PUT", "/notifications/tercihler/hava_don"), ("POST", f"/notifications/{uuid.uuid4()}/okundu"),
                         ("GET", f"/gardens/{uuid.uuid4()}/sulama"), ("GET", f"/gardens/{uuid.uuid4()}/riskler")]:
        assert (await client.request(method, path, json={"acik": True} if method == "PUT" else None)).status_code == 401, path


async def test_other_users_notifications_are_invisible_and_unreadable(user_client: AsyncClient, factory, provider, app):
    provider.frost = True
    await new_garden(user_client)
    await run_job(factory, provider, user_client)
    mine = (await listing(user_client))["ogeler"]
    assert mine
    async with make_client(app) as other:
        await register(other)
        assert (await listing(other))["toplam"] == 0
        assert (await other.post(f"/notifications/{mine[0]['id']}/okundu")).status_code == 404
        assert (await other.get("/notifications", params={"bahce": mine[0]["bahce_id"]})).json()["toplam"] == 0
    assert (await listing(user_client))["okunmamis_sayisi"] == len(mine)  # başkası okundu işaretleyemedi


# ----------------------------------------------------------------------------- iş ve tekrar önleme
async def test_job_creates_notifications_and_a_second_run_creates_none(user_client: AsyncClient, factory, provider):
    provider.frost = True
    garden = await new_garden(user_client, ad="Bahçem")
    first = await run_job(factory, provider, user_client)
    assert first.hata == 0 and first.uretilen >= 1
    data = await listing(user_client)
    frost = next(n for n in data["ogeler"] if n["tur"] == "hava_don")
    assert frost["oncelik"] in ("kritik", "uyari") and frost["baglanti"] == f"/bahceler/{garden['id']}/hava"
    assert frost["baslik"].startswith("Bahçem:") and frost["tur_adi"] == "Don uyarısı" and frost["okundu"] is False

    second = await run_job(factory, provider, user_client)
    assert second.uretilen == 0  # aynı olay için tek bildirim (idempotent)
    assert (await listing(user_client))["toplam"] == data["toplam"]


async def test_job_is_isolated_per_garden_and_saves_risk_snapshot(user_client: AsyncClient, factory, provider, test_engine):
    garden = await new_garden(user_client)
    result = await run_job(factory, provider, user_client)
    assert result.isler >= 1 and result.hata == 0
    async with test_engine.begin() as conn:
        snap = (await conn.execute(text("SELECT yuksek_sayisi FROM garden_risk_snapshots WHERE garden_id = :g"), {"g": uuid.UUID(garden["id"])})).first()
    assert snap is not None
    await run_job(factory, provider, user_client)  # üzerine yazılır, çoğalmaz
    async with test_engine.begin() as conn:
        count = (await conn.execute(text("SELECT count(*) FROM garden_risk_snapshots WHERE garden_id = :g"), {"g": uuid.UUID(garden["id"])})).scalar_one()
    assert count == 1


async def test_weather_refresh_job_fills_the_cache_idempotently(user_client: AsyncClient, factory, provider):
    await new_garden(user_client)
    workspace = await workspace_of(user_client)
    await refresh_weather(factory, provider, workspace_id=workspace)
    calls = provider.forecast_calls
    assert calls >= 1
    await refresh_weather(factory, provider, workspace_id=workspace)
    assert provider.forecast_calls == calls  # 1 saatlik önbellek: tekrar çalıştırma sağlayıcıya gitmez


async def test_satellite_alert_becomes_one_notification_per_event(user_client: AsyncClient, factory, provider):
    garden = await new_garden(user_client)
    await seed_scenes(factory, garden["id"], last_ndvi=0.36, count=24)
    await run_job(factory, provider, user_client)
    sat = [n for n in (await listing(user_client, tur="indeks_dususu"))["ogeler"]]
    assert all(n["baglanti"] == f'/bahceler/{n["bahce_id"]}' for n in sat)
    again = await run_job(factory, provider, user_client)
    assert again.uretilen == 0 and len((await listing(user_client, tur="indeks_dususu"))["ogeler"]) == len(sat)


# ----------------------------------------------------------------------------- liste, okundu, filtre
async def test_listing_filters_paging_and_read_state(user_client: AsyncClient, factory, provider):
    provider.frost = True
    a = await new_garden(user_client, ad="A Bahçesi")
    await new_garden(user_client, ad="B Bahçesi")
    await run_job(factory, provider, user_client)
    everything = await listing(user_client)
    assert everything["toplam"] >= 2 and everything["okunmamis_sayisi"] == everything["toplam"]

    only_a = await listing(user_client, bahce=a["id"])
    assert only_a["toplam"] >= 1 and all(n["bahce_id"] == a["id"] for n in only_a["ogeler"])
    assert (await listing(user_client, tur="hava_don"))["toplam"] >= 1
    assert (await user_client.get("/notifications", params={"tur": "yok"})).status_code == 422

    page1 = await listing(user_client, boyut=1, sayfa=1)
    page2 = await listing(user_client, boyut=1, sayfa=2)
    assert len(page1["ogeler"]) == 1 and page1["sayfa_sayisi"] == everything["toplam"]
    assert page1["ogeler"][0]["id"] != page2["ogeler"][0]["id"]

    first = everything["ogeler"][0]
    read = (await user_client.post(f"/notifications/{first['id']}/okundu")).json()
    assert read["okundu"] is True
    after = await listing(user_client)
    assert after["okunmamis_sayisi"] == everything["toplam"] - 1
    assert (await listing(user_client, okunmamis=True))["toplam"] == everything["toplam"] - 1
    assert (await user_client.post(f"/notifications/{uuid.uuid4()}/okundu")).status_code == 404

    bulk = (await user_client.post("/notifications/okundu", params={"bahce": a["id"]})).json()
    assert bulk["guncellenen"] >= 0 and bulk["okunmamis_sayisi"] < after["okunmamis_sayisi"] or only_a["toplam"] == 1
    everything_read = (await user_client.post("/notifications/okundu")).json()
    assert everything_read["okunmamis_sayisi"] == 0


# ----------------------------------------------------------------------------- tercihler ve kanallar
async def test_preferences_disable_a_notification_type(user_client: AsyncClient, factory, provider):
    provider.frost = True
    await new_garden(user_client)
    prefs = (await user_client.get("/notifications/tercihler")).json()
    assert {p["tur"] for p in prefs} >= {"hava_don", "hava_sicak", "zararli_riski", "indeks_dususu", "sulama"} and all(p["acik"] for p in prefs)
    changed = (await user_client.put("/notifications/tercihler/hava_don", json={"acik": False})).json()
    assert next(p for p in changed if p["tur"] == "hava_don")["acik"] is False
    await run_job(factory, provider, user_client)
    assert (await listing(user_client, tur="hava_don"))["toplam"] == 0  # kapalı tür üretilmez
    assert (await user_client.put("/notifications/tercihler/yok", json={"acik": True})).status_code == 404


class FakeChannel:
    name = "sahte"

    def __init__(self) -> None:
        self.delivered: list[str] = []

    async def deliver(self, workspace_id, notification) -> None:
        self.delivered.append(notification.dedupe_key)


async def test_extra_channels_receive_only_new_notifications(user_client: AsyncClient, factory, provider):
    provider.frost = True
    await new_garden(user_client)
    channel = FakeChannel()
    registry.register(channel)
    try:
        first = await run_job(factory, provider, user_client)
        assert 1 <= len(channel.delivered) <= first.uretilen  # yalnız KRİTİK anında iletilir; önemli/bilgi özeti bekler
        delivered = len(channel.delivered)
        await run_job(factory, provider, user_client)
        assert len(channel.delivered) == delivered  # tekrar yok
    finally:
        registry._extra.clear()


# ----------------------------------------------------------------------------- iş altyapısı
def test_job_registry_runs_weather_before_notifications_and_arq_cron_matches():
    settings = Settings(job_weather_interval_minutes=30, job_notifications_interval_minutes=60)
    specs = job_registry.job_specs(settings)
    assert [s.name for s in specs] == ["refresh_weather", "refresh_era5", "refresh_hls", "refresh_events", "generate_notifications", "refresh_acquisitions", "send_digest", "refresh_validation"]
    assert arq_worker.minute_slots(30) == {0, 30} and arq_worker.minute_slots(60) == {0} and arq_worker.minute_slots(15) == {0, 15, 30, 45}
    built = arq_worker.build_settings(settings)
    assert len(built["cron_jobs"]) == 8 and {f.__name__ for f in built["functions"]} == {"refresh_weather", "refresh_era5", "refresh_hls", "refresh_events", "generate_notifications", "refresh_acquisitions", "send_digest", "refresh_validation"}


async def test_inline_queue_runs_jobs_synchronously_and_arq_queue_enqueues_with_a_stable_id(user_client: AsyncClient, factory, provider):
    settings = Settings()
    result = await queue.InlineQueue(settings, factory, provider).enqueue("refresh_weather")
    assert result is not None and result.hata == 0

    class FakePool:
        def __init__(self) -> None:
            self.calls: list[tuple[str, dict]] = []

        async def enqueue_job(self, name, **kwargs):
            self.calls.append((name, kwargs))

    pool = FakePool()
    await queue.ArqQueue(pool).enqueue("generate_notifications")
    await queue.ArqQueue(pool).enqueue("generate_notifications")
    assert pool.calls == [("generate_notifications", {"_job_id": "job-generate_notifications"})] * 2  # aynı kimlik: arq tekrarı eler
    with pytest.raises(KeyError):
        await queue.InlineQueue(settings, factory, provider).enqueue("yok")


# ----------------------------------------------------------------------------- sulama ve riskler
async def test_irrigation_endpoint_shape_system_and_note(user_client: AsyncClient, provider):
    garden = await new_garden(user_client, sulama_sistemi="damla", cesit_kodu="lamas")
    data = (await user_client.get(f"/gardens/{garden['id']}/sulama")).json()
    assert data["veri_yeterli"] is True and data["sistem"] == {"kod": "damla", "ad": "Damla sulama", "verimlilik": 0.9}
    assert "reçetesi değildir" in data["not_"] and data["etkili_yagis_kural"]["durum"] == "dogrulanmadi" and data["kc_kural"]["durum"] == "dogrulanmadi"
    assert data["onumuzdeki_gunler"]["gun"] >= 1 and data["son_gunler"] is not None
    if data["gerekli"]:
        assert data["ton_dekar"] == data["brut_ihtiyac_mm"] and data["toplam_ton"] > 0 and "ton/dekar" in data["cumle"]
    else:
        assert "görünmüyor" in data["cumle"]


async def test_irrigation_rejects_unknown_system_and_other_users_garden(user_client: AsyncClient, provider, app):
    response = await user_client.post("/gardens", json={**garden_body(), "sulama_sistemi": "buharlaştırma"})
    assert response.status_code == 422
    garden = await new_garden(user_client)
    patched = await user_client.patch(f"/gardens/{garden['id']}", json={"sulama_sistemi": "salma"})
    assert patched.json()["sulama_sistemi"] == "salma"
    async with make_client(app) as other:
        await register(other)
        assert (await other.get(f"/gardens/{garden['id']}/sulama")).status_code == 404
        assert (await other.get(f"/gardens/{garden['id']}/riskler")).status_code == 404


async def test_irrigation_without_kc_rules_and_offline_weather_is_honest(user_client: AsyncClient, provider):
    other = await new_garden(user_client, urun="diger")
    data = (await user_client.get(f"/gardens/{other['id']}/sulama")).json()
    assert data["veri_yeterli"] is False and "Kc" in data["veri_yetersiz_nedeni"] and data["ihtiyac_mm"] is None
    provider.offline = True
    # Önbelleği boş, başka bir hücredeki bahçe: sağlayıcı yokken tahmin olmadığı açıkça söylenir (uydurma değer yok)
    lemon = (await user_client.post("/gardens", json=garden_body(geometry=square(161, LNG + 0.3, LAT + 0.2)))).json()
    result = await user_client.get(f"/gardens/{lemon['id']}/sulama")
    assert result.status_code == 200 and result.json()["veri_yeterli"] is False


async def test_risks_endpoint_lists_applicable_rules_with_status_and_trap_placeholder(user_client: AsyncClient, provider):
    garden = await new_garden(user_client)
    data = (await user_client.get(f"/gardens/{garden['id']}/riskler")).json()
    assert {r["kod"] for r in data["riskler"]} == {"akdeniz_meyve_sinegi", "kirmizi_orumcek", "kuruma_hastaligi"}  # limon: üçü de
    for risk in data["riskler"]:
        assert risk["seviye"] in ("dusuk", "orta", "yuksek") and risk["gerekce"] and risk["kural"]["durum"] == "dogrulanmadi"
        assert risk["gecerlilik_baslangic"] <= risk["gecerlilik_bitis"]
    assert data["tuzak"] == {"desteklenir": False, "adim": "Adım 12", "aciklama": data["tuzak"]["aciklama"]} and "teşhis" in data["not_"]

    orange = await new_garden(user_client, urun="portakal")
    kinds = {r["kod"] for r in (await user_client.get(f"/gardens/{orange['id']}/riskler")).json()["riskler"]}
    assert kinds == {"akdeniz_meyve_sinegi", "kirmizi_orumcek"}  # kuruma hastalığı yalnızca limonda
    none = await new_garden(user_client, urun="diger")
    assert (await user_client.get(f"/gardens/{none['id']}/riskler")).json()["riskler"] == []


async def test_today_and_status_use_the_new_risk_and_irrigation_inputs(user_client: AsyncClient, factory, provider):
    garden = await new_garden(user_client)
    await seed_scenes(factory, garden["id"], last_ndvi=0.62, count=24)
    today = (await user_client.get(f"/gardens/{garden['id']}/bugun")).json()
    assert 1 <= len(today["maddeler"]) <= 3
    status = (await user_client.get(f"/gardens/{garden['id']}/durum")).json()
    assert "skor" not in status and status["durum"] in ("iyi", "izle", "dikkat", "sorun", "veri_yok")
    assert istanbul_today() - timedelta(days=0) == date.fromisoformat(today["tarih"])


# ----------------------------------------------------------------------------- yaşam döngüsü
async def test_notification_lifecycle_created_seen_resolved_or_snoozed(user_client: AsyncClient, factory, provider, test_engine):
    provider.frost = True
    await new_garden(user_client, ad="Döngü")
    await new_garden(user_client, ad="Döngü 2")
    await run_job(factory, provider, user_client)
    everything = await listing(user_client)
    first, second = everything["ogeler"][0], everything["ogeler"][1]
    assert first["durum"] == "olustu" and first["okundu"] is False

    seen = (await user_client.post(f"/notifications/{first['id']}/okundu")).json()
    assert seen["durum"] == "goruldu" and seen["okundu"] is True

    resolved = (await user_client.post(f"/notifications/{first['id']}/durum", json={"durum": "cozuldu"})).json()
    assert resolved["durum"] == "cozuldu" and resolved["okundu"] is True
    active = await listing(user_client)
    assert first["id"] not in [n["id"] for n in active["ogeler"]]  # çözülen aktif listeden çıkar
    assert first["id"] in [n["id"] for n in (await listing(user_client, durum="cozuldu"))["ogeler"]]
    assert active["okunmamis_sayisi"] == everything["okunmamis_sayisi"] - 1

    snoozed = (await user_client.post(f"/notifications/{second['id']}/durum", json={"durum": "ertelendi", "erteleme_gun": 2})).json()
    assert snoozed["durum"] == "ertelendi" and snoozed["ertelendi_bitis"]
    assert second["id"] not in [n["id"] for n in (await listing(user_client))["ogeler"]]
    assert second["id"] in [n["id"] for n in (await listing(user_client, durum="ertelendi"))["ogeler"]]

    # Erteleme süresi dolunca bildirim yeniden «oluştu» olarak görünür
    async with test_engine.begin() as conn:
        await conn.execute(text("UPDATE notifications SET ertelendi_bitis = now() - interval '1 minute' WHERE id = :i"), {"i": second["id"]})
    back = [n for n in (await listing(user_client))["ogeler"] if n["id"] == second["id"]]
    assert back and back[0]["durum"] == "olustu"

    # Aynı olay yeniden bildirilmez (dedupe): çözülen bildirim iş tekrarında geri gelmez
    again = await run_job(factory, provider, user_client)
    assert again.uretilen == 0
    assert first["id"] not in [n["id"] for n in (await listing(user_client))["ogeler"]]

    reopened = (await user_client.post(f"/notifications/{first['id']}/durum", json={"durum": "goruldu"})).json()
    assert reopened["durum"] == "goruldu"


async def test_lifecycle_rejects_invalid_requests(user_client: AsyncClient, factory, provider):
    provider.frost = True
    await new_garden(user_client)
    await run_job(factory, provider, user_client)
    item = (await listing(user_client))["ogeler"][0]
    url = f"/notifications/{item['id']}/durum"
    assert (await user_client.post(url, json={"durum": "olustu"})).status_code == 422
    assert (await user_client.post(url, json={"durum": "ertelendi"})).status_code == 422  # süre zorunlu
    assert (await user_client.post(url, json={"durum": "ertelendi", "erteleme_gun": 99})).status_code == 422
    assert (await user_client.post(f"/notifications/{uuid.uuid4()}/durum", json={"durum": "cozuldu"})).status_code == 404


# ----------------------------------------------------------------------------- risk bildirimi: seviye değişince güncellenir / çözülür
def _risk_stub(level: str):
    from datetime import timedelta

    from bahcelab_backend.domain.agro.risks import RiskSonucu

    async def compute(self, garden_row, history, weather, today):
        return [(RiskSonucu("akdeniz_meyve_sinegi", "Akdeniz meyve sineği", level, "gerekçe", today, today + timedelta(days=7), True), None, None)]  # type: ignore[arg-type]

    return compute


async def test_risk_notification_follows_the_risk_level_with_a_single_active_item(user_client: AsyncClient, factory, provider, monkeypatch):
    from bahcelab_backend.domain.agro.service import AgroService

    await new_garden(user_client, ad="Risk Bahçesi")

    async def run(level: str):
        monkeypatch.setattr(AgroService, "_compute_risks", _risk_stub(level))
        await run_job(factory, provider, user_client)
        return [n for n in (await listing(user_client, tur="zararli_riski", durum="hepsi"))["ogeler"]]

    high = await run("yuksek")
    assert len(high) == 1 and "yüksek risk" in high[0]["baslik"] and high[0]["durum"] == "olustu"
    assert len(await run("yuksek")) == 1  # iş tekrarı çoğaltmaz

    medium = await run("orta")  # yüksek → orta: aynı bildirim güncellenir, hâlâ aktif
    assert len(medium) == 1 and medium[0]["id"] == high[0]["id"] and "orta risk" in medium[0]["baslik"] and medium[0]["durum"] != "cozuldu"

    low = await run("dusuk")  # orta → düşük: otomatik çözüldü
    assert len(low) == 1 and low[0]["durum"] == "cozuldu"
    assert not (await listing(user_client, tur="zararli_riski"))["ogeler"]  # aktif listede yok

    back = await run("yuksek")  # risk geri döndü: otomatik çözülen bildirim yeniden açılır (yine tek)
    assert len(back) == 1 and back[0]["id"] == high[0]["id"] and back[0]["durum"] == "olustu"

    # Kullanıcı elle çözdüyse risk sürerken yeniden açılmaz
    await user_client.post(f"/notifications/{back[0]['id']}/durum", json={"durum": "cozuldu"})
    still = await run("yuksek")
    assert len(still) == 1 and still[0]["durum"] == "cozuldu"
