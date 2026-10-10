import asyncio
import threading
import time
import uuid
from datetime import UTC, date, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from bahcelab_backend.domain.ndvi import runner
from bahcelab_backend.domain.ndvi import service as ndvi_service
from bahcelab_backend.domain.ndvi.models import NdviJobModel, NdviObservationModel
from bahcelab_backend.domain.ndvi.repository import NdviRepository
from bahcelab_backend.domain.ndvi.sample import build_sample_series, grid_for, make_scene
from bahcelab_backend.domain.ndvi.stac import NdviSourceError, Scene
from bahcelab_backend.shared.storage import LocalStorage, get_storage

from .conftest import make_client, register
from .test_gardens_api import LAT, LNG, garden_body, square

TODAY = date(2026, 10, 10)


@pytest.fixture
def factory(test_engine):
    return async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture
async def user_client(client: AsyncClient, cleanup_users):
    await register(client)
    return client


async def new_garden(client: AsyncClient, **overrides) -> dict:
    response = await client.post("/gardens", json=garden_body(**overrides))
    assert response.status_code == 201, response.text
    return response.json()


async def add_observation(factory, garden_id: str, day: date, mean: float | None = 0.6, **kw):
    storage = get_storage()
    durum = kw.pop("durum", "tamam")
    key = kw.pop("png_yolu", f"ndvi/{garden_id}/{day}.png" if durum == "tamam" else None)
    if key and kw.pop("write_png", True):
        storage.save(key, b"\x89PNG-test-" + str(day).encode())
    async with factory() as session:
        session.add(
            NdviObservationModel(
                garden_id=uuid.UUID(garden_id),
                tarih=day,
                scene_id=f"S2-{day}",
                durum=durum,
                gecerli_piksel_orani=1.0 if durum == "tamam" else 0.2,
                ortalama=mean if durum == "tamam" else None,
                medyan=mean if durum == "tamam" else None,
                png_yolu=key,
                sorunlu_bolge_geojson={
                    "type": "FeatureCollection",
                    "features": [
                        {"type": "Feature", "properties": {"alan_m2": 400}, "geometry": None}
                    ],
                }
                if durum == "tamam"
                else None,
                goruntu_koordinatlari=[
                    [LNG, LAT],
                    [LNG + 0.001, LAT],
                    [LNG + 0.001, LAT - 0.001],
                    [LNG, LAT - 0.001],
                ],
                kaynak=kw.pop("kaynak", "sentinel-2"),
                created_at=datetime.now(UTC),
            )
        )
        await session.commit()


@pytest.fixture
def jobs_started(monkeypatch):
    """Arka plan işini çalıştırmak yerine hangi işlerin sıraya alındığını kaydeder."""
    started: list[uuid.UUID] = []

    async def fake_run(job_id):
        started.append(job_id)

    monkeypatch.setattr(ndvi_service, "run_job", fake_run)
    from bahcelab_backend.config import get_settings

    get_settings().ndvi_enabled = True  # app fixture teardown eski değeri geri yükler
    return started


# ---------------------------------------------------------------- yetki
@pytest.mark.asyncio
async def test_ndvi_endpoints_require_login(client: AsyncClient):
    gid = uuid.uuid4()
    for method, path in [
        ("GET", f"/gardens/{gid}/ndvi"),
        ("POST", f"/gardens/{gid}/ndvi/refresh"),
        ("GET", f"/gardens/{gid}/ndvi/2026-10-01.png"),
        ("GET", f"/gardens/{gid}/ndvi/2026-10-01/zones"),
    ]:
        assert (await client.request(method, path)).status_code == 401, path


@pytest.mark.asyncio
@pytest.mark.integration
async def test_other_users_garden_ndvi_is_not_accessible(user_client: AsyncClient, app, factory):
    garden = await new_garden(user_client)
    await add_observation(factory, garden["id"], date(2026, 10, 1))

    async with make_client(app) as other:
        await register(other)
        for method, path in [
            ("GET", f"/gardens/{garden['id']}/ndvi"),
            ("POST", f"/gardens/{garden['id']}/ndvi/refresh"),
            ("GET", f"/gardens/{garden['id']}/ndvi/2026-10-01.png"),
            ("GET", f"/gardens/{garden['id']}/ndvi/2026-10-01/zones"),
        ]:
            assert (await other.request(method, path)).status_code == 404, path

    assert (
        await user_client.get(f"/gardens/{garden['id']}/ndvi/2026-10-01.png")
    ).status_code == 200


# ---------------------------------------------------------------- okuma uçları
@pytest.mark.asyncio
@pytest.mark.integration
async def test_overview_png_zones_and_cloudy_dates(user_client: AsyncClient, factory):
    garden = await new_garden(user_client)
    gid = garden["id"]
    await add_observation(factory, gid, date(2026, 9, 10), 0.70)
    await add_observation(factory, gid, date(2026, 9, 15), None, durum="bulutlu")
    await add_observation(factory, gid, date(2026, 9, 27), 0.60)

    body = (await user_client.get(f"/gardens/{gid}/ndvi")).json()
    assert [g["tarih"] for g in body["gozlemler"]] == ["2026-09-10", "2026-09-15", "2026-09-27"]
    assert [g["durum"] for g in body["gozlemler"]] == ["tamam", "bulutlu", "tamam"]
    assert body["gozlemler"][1]["png_var"] is False and body["gozlemler"][0]["png_var"] is True
    assert (
        body["gozlemler"][0]["sorunlu_bolge_sayisi"] == 1
        and len(body["gozlemler"][0]["koordinatlar"]) == 4
    )
    assert body["ornek_veri"] is False
    assert body["uyarilar"][0]["tur"] == "ndvi_dusus"  # 0,70 → 0,60 = −%14,3 (17 gün)

    png = await user_client.get(f"/gardens/{gid}/ndvi/2026-09-10.png")
    assert png.status_code == 200 and png.headers["content-type"] == "image/png"
    assert png.content.startswith(b"\x89PNG-test-2026-09-10")
    assert "private" in png.headers["cache-control"]

    assert (
        await user_client.get(f"/gardens/{gid}/ndvi/2026-09-15.png")
    ).status_code == 404  # bulutlu
    assert (
        await user_client.get(f"/gardens/{gid}/ndvi/2026-01-01.png")
    ).status_code == 404  # kayıt yok
    assert (await user_client.get(f"/gardens/{gid}/ndvi/2026-09-15/zones")).status_code == 404

    zones = (await user_client.get(f"/gardens/{gid}/ndvi/2026-09-10/zones")).json()
    assert (
        zones["type"] == "FeatureCollection"
        and zones["features"][0]["properties"]["alan_m2"] == 400
    )

    listed = (await user_client.get("/gardens")).json()
    assert listed[0]["son_ndvi_ortalama"] == pytest.approx(0.60)
    assert listed[0]["son_ndvi_tarihi"] == "2026-09-27"
    assert (await user_client.get(f"/gardens/{gid}")).json()["son_ndvi_ortalama"] == pytest.approx(
        0.60
    )


# ---------------------------------------------------------------- iş yaşam döngüsü
@pytest.mark.asyncio
@pytest.mark.integration
async def test_new_garden_queues_initial_job_and_refresh_reuses_active_job(
    user_client: AsyncClient, jobs_started
):
    garden = await new_garden(user_client)
    assert (
        len(jobs_started) == 1
    )  # kayıttan sonra son 13 ay arka planda işlenmek üzere sıraya alındı

    overview = (await user_client.get(f"/gardens/{garden['id']}/ndvi")).json()
    assert overview["isleme"]["tur"] == "ilk" and overview["isleme"]["durum"] == "bekliyor"
    assert len(jobs_started) == 1  # aktif iş varken ikinci iş açılmaz

    first = await user_client.post(f"/gardens/{garden['id']}/ndvi/refresh")
    second = await user_client.post(f"/gardens/{garden['id']}/ndvi/refresh")
    assert first.status_code == 202 and first.json()["id"] == second.json()["id"]
    assert len(jobs_started) == 1


@pytest.mark.asyncio
@pytest.mark.integration
async def test_refresh_replaces_sample_data_with_real_processing(
    user_client, jobs_started, factory
):
    from bahcelab_backend.config import get_settings

    get_settings().ndvi_enabled = False  # bahçe oluşturma işi başlatmasın
    garden = await new_garden(user_client)
    get_settings().ndvi_enabled = True
    await add_observation(factory, garden["id"], date(2026, 10, 1), 0.6, kaynak="ornek")
    key = f"ndvi/{garden['id']}/2026-10-01.png"
    assert get_storage().exists(key)

    overview = (await user_client.get(f"/gardens/{garden['id']}/ndvi")).json()
    assert overview["ornek_veri"] is True
    assert jobs_started == []  # örnek veri kendiliğinden gerçek veriyle karışmaz

    job = (await user_client.post(f"/gardens/{garden['id']}/ndvi/refresh")).json()
    assert job["tur"] == "ilk" and len(jobs_started) == 1
    assert not get_storage().exists(key)
    after = (await user_client.get(f"/gardens/{garden['id']}/ndvi")).json()
    assert after["gozlemler"] == [] and after["ornek_veri"] is False


@pytest.mark.asyncio
@pytest.mark.integration
async def test_overview_checks_for_new_scenes_only_after_twelve_hours(
    user_client, jobs_started, factory
):
    from bahcelab_backend.config import get_settings

    get_settings().ndvi_enabled = False
    garden = await new_garden(user_client)
    get_settings().ndvi_enabled = True
    gid = garden["id"]
    await add_observation(factory, gid, date(2026, 10, 1), 0.6)

    # Hiç kontrol yapılmamış → bahçe açılınca yeni sahne araması başlar
    first = (await user_client.get(f"/gardens/{gid}/ndvi")).json()
    assert first["isleme"]["tur"] == "guncelleme" and len(jobs_started) == 1

    # İş bitti, son kontrol 1 saat önce → yeni iş açılmaz
    async with factory() as s:
        await s.execute(
            text("UPDATE ndvi_jobs SET durum='tamam', bitis=:t WHERE garden_id=:g"),
            {"t": datetime.now(UTC) - timedelta(hours=1), "g": uuid.UUID(gid)},
        )
        await s.commit()
    recent = (await user_client.get(f"/gardens/{gid}/ndvi")).json()
    assert recent["isleme"]["durum"] == "tamam" and len(jobs_started) == 1

    # Son kontrol 13 saat önce → yeniden kontrol
    async with factory() as s:
        await s.execute(
            text("UPDATE ndvi_jobs SET bitis=:t WHERE garden_id=:g"),
            {"t": datetime.now(UTC) - timedelta(hours=13), "g": uuid.UUID(gid)},
        )
        await s.commit()
    await user_client.get(f"/gardens/{gid}/ndvi")
    assert len(jobs_started) == 2


@pytest.mark.asyncio
@pytest.mark.integration
async def test_boundary_edit_purges_ndvi_and_requeues_processing(
    user_client, jobs_started, factory
):
    garden = await new_garden(user_client)
    gid = garden["id"]
    async with factory() as s:  # bahçe oluşturma işini tamamlanmış say
        await s.execute(
            text("UPDATE ndvi_jobs SET durum='tamam' WHERE garden_id=:g"), {"g": uuid.UUID(gid)}
        )
        await s.commit()
    await add_observation(factory, gid, date(2026, 10, 1), 0.6)
    key = f"ndvi/{gid}/2026-10-01.png"
    before = len(jobs_started)

    # Ad değişikliği NDVI'ya dokunmaz
    await user_client.patch(f"/gardens/{gid}", json={"ad": "Yeni Ad"})
    assert (await user_client.get(f"/gardens/{gid}/ndvi/2026-10-01.png")).status_code == 200
    assert len(jobs_started) == before

    # Sınır değişince: kayıtlar ve PNG silinir, baştan işlenir
    assert (
        await user_client.patch(f"/gardens/{gid}", json={"geometry": square(200)})
    ).status_code == 200
    assert not get_storage().exists(key)
    body = (await user_client.get(f"/gardens/{gid}/ndvi")).json()
    assert body["gozlemler"] == []
    assert body["isleme"]["tur"] == "yeniden" and len(jobs_started) == before + 1


@pytest.mark.asyncio
@pytest.mark.integration
async def test_boundary_edit_cancels_running_job(user_client, jobs_started, factory):
    garden = await new_garden(user_client)  # 'ilk' iş bekliyor
    gid = garden["id"]
    async with factory() as s:
        await s.execute(
            text("UPDATE ndvi_jobs SET durum='isleniyor' WHERE garden_id=:g"), {"g": uuid.UUID(gid)}
        )
        await s.commit()

    await user_client.patch(f"/gardens/{gid}", json={"geometry": square(200)})
    async with factory() as s:
        jobs = (
            (await s.execute(select(NdviJobModel).where(NdviJobModel.garden_id == uuid.UUID(gid))))
            .scalars()
            .all()
        )
    assert sorted(j.durum for j in jobs) == ["bekliyor", "hata"]
    assert any("sınırı değiştiği" in (j.hata_mesaji or "") for j in jobs)


@pytest.mark.asyncio
@pytest.mark.integration
async def test_deleting_garden_removes_ndvi_files_and_rows(user_client, factory):
    garden = await new_garden(user_client)
    gid = garden["id"]
    await add_observation(factory, gid, date(2026, 10, 1), 0.6)
    key = f"ndvi/{gid}/2026-10-01.png"
    assert get_storage().exists(key)

    assert (await user_client.delete(f"/gardens/{gid}")).status_code == 204
    assert not get_storage().exists(key)
    async with factory() as s:
        count = (
            await s.execute(
                select(func.count())
                .select_from(NdviObservationModel)
                .where(NdviObservationModel.garden_id == uuid.UUID(gid))
            )
        ).scalar_one()
    assert count == 0


# ---------------------------------------------------------------- arka plan işleyicisi (Planetary Computer mock'lu)
class Harness:
    """run_job'u sahte arama/okuma ile çalıştırır; gerçek ağa çıkılmaz."""

    def __init__(self, factory, tmp_path, garden_id: str, geometry: dict) -> None:
        self.factory = factory
        self.storage = LocalStorage(tmp_path / "ndvi-store")
        self.garden_id = uuid.UUID(garden_id)
        self.geometry = geometry
        self.grid = grid_for(geometry)
        self.read_calls: list[date] = []
        self.fail_dates: set[date] = set()
        self.cloud: dict[date, float] = {}
        self.active = 0
        self.max_active = 0
        self.lock = threading.Lock()
        self.on_read = None

    def scenes(self, days: list[date]) -> list[Scene]:
        return [Scene(tarih=d, scene_id=f"S2-{d}", bulut_orani=10.0, item=None) for d in days]

    def search_for(self, days: list[date], error: Exception | None = None):
        def search(geometry, start, end):
            if error:
                raise error
            return self.scenes(days)

        return search

    def read(self, scene: Scene, geometry):
        with self.lock:
            self.active += 1
            self.max_active = max(self.max_active, self.active)
            self.read_calls.append(scene.tarih)
        try:
            time.sleep(0.05)
            if scene.tarih in self.fail_dates:
                raise OSError("ağ hatası")
            if self.on_read:
                self.on_read()
            return make_scene(self.grid, 0.65, self.cloud.get(scene.tarih, 0.0))
        finally:
            with self.lock:
                self.active -= 1

    async def new_job(self, tur: str = "ilk") -> uuid.UUID:
        async with self.factory() as s:
            job = await NdviRepository(s).create_job(self.garden_id, tur)
            await s.commit()
            return job.id

    async def run(
        self, days, *, tur: str = "ilk", search_error: Exception | None = None
    ) -> NdviJobModel:
        job_id = await self.new_job(tur)
        await runner.run_job(
            job_id,
            session_factory=self.factory,
            storage=self.storage,
            search=self.search_for(days, search_error),
            read=self.read,
            today=TODAY,
        )
        async with self.factory() as s:
            return await NdviRepository(s).get_job(job_id)

    async def observations(self) -> list[NdviObservationModel]:
        async with self.factory() as s:
            return await NdviRepository(s).list_observations(self.garden_id)


@pytest.fixture
async def harness(user_client: AsyncClient, factory, tmp_path):
    garden = await new_garden(user_client)
    return Harness(factory, tmp_path, garden["id"], garden["geometry"])


DAYS = [date(2026, 9, 20), date(2026, 9, 25), date(2026, 9, 30)]


@pytest.mark.asyncio
@pytest.mark.integration
async def test_job_processes_scenes_skips_cloudy_and_never_recomputes_a_date(harness: Harness):
    harness.cloud[DAYS[1]] = 0.6  # geçerli oran 0,4 → bulutlu

    job = await harness.run(DAYS)
    assert (job.durum, job.toplam, job.islenen, job.hata_mesaji) == ("tamam", 3, 3, None)

    observations = await harness.observations()
    assert [(o.tarih, o.durum) for o in observations] == [
        (DAYS[0], "tamam"),
        (DAYS[1], "bulutlu"),
        (DAYS[2], "tamam"),
    ]
    cloudy = observations[1]
    assert cloudy.png_yolu is None and cloudy.ortalama is None and cloudy.gecerli_piksel_orani < 0.7
    clear = observations[0]
    assert clear.ortalama == pytest.approx(0.65, abs=1e-3) and clear.kaynak == "sentinel-2"
    assert clear.bulut_orani == 10.0 and len(clear.goruntu_koordinatlari) == 4
    assert harness.storage.exists(clear.png_yolu) and not harness.storage.exists(
        f"ndvi/{harness.garden_id}/{DAYS[1]}.png"
    )

    # Aynı tarihler ikinci kez hesaplanmaz (bulutlu olanlar dahil)
    harness.read_calls.clear()
    second = await harness.run(DAYS, tur="guncelleme")
    assert harness.read_calls == [] and (second.durum, second.toplam) == ("tamam", 0)
    assert len(await harness.observations()) == 3

    # Yeni bir sahne gelirse yalnızca o işlenir
    harness.read_calls.clear()
    third = await harness.run([*DAYS, date(2026, 10, 5)], tur="guncelleme")
    assert harness.read_calls == [date(2026, 10, 5)] and third.toplam == 1


@pytest.mark.asyncio
@pytest.mark.integration
async def test_failed_scene_is_reported_and_retried_next_time(harness: Harness):
    harness.fail_dates.add(DAYS[1])
    job = await harness.run(DAYS)
    assert job.durum == "tamam" and job.islenen == 2
    assert "1 sahne işlenemedi" in job.hata_mesaji
    assert [o.tarih for o in await harness.observations()] == [DAYS[0], DAYS[2]]

    harness.fail_dates.clear()
    harness.read_calls.clear()
    retry = await harness.run(DAYS, tur="guncelleme")
    assert harness.read_calls == [DAYS[1]] and retry.hata_mesaji is None


@pytest.mark.asyncio
@pytest.mark.integration
async def test_all_scenes_failing_marks_job_as_error_without_crashing(harness: Harness):
    harness.fail_dates.update(DAYS)
    job = await harness.run(DAYS)
    assert job.durum == "hata" and "okunamadı" in job.hata_mesaji
    assert await harness.observations() == []


@pytest.mark.asyncio
@pytest.mark.integration
async def test_unreachable_source_gives_clear_error_and_can_be_retried(harness: Harness):
    error = NdviSourceError(
        "Uydu verisi kaynağına (Planetary Computer) ulaşılamadı. Biraz sonra tekrar deneyin."
    )
    job = await harness.run(DAYS, search_error=error)
    assert job.durum == "hata" and "ulaşılamadı" in job.hata_mesaji and job.bitis is not None

    recovered = await harness.run(DAYS)  # aktif iş kalmadığı için yeniden denenebilir
    assert recovered.durum == "tamam" and len(await harness.observations()) == 3


@pytest.mark.asyncio
@pytest.mark.integration
async def test_unexpected_errors_never_escape_the_runner(harness: Harness, monkeypatch):
    def boom(*_args, **_kwargs):
        raise RuntimeError("beklenmeyen")

    monkeypatch.setattr(runner, "analyze_scene", boom)
    job = await harness.run(DAYS)  # sahne başına hata → iş "hata", istisna sızmaz
    assert job.durum == "hata"


@pytest.mark.asyncio
@pytest.mark.integration
async def test_at_most_two_scenes_are_processed_at_once(harness: Harness):
    days = [date(2026, 9, 1) + timedelta(days=5 * i) for i in range(8)]
    job = await harness.run(days)
    assert job.durum == "tamam" and job.islenen == 8
    assert harness.max_active == 2


@pytest.mark.asyncio
@pytest.mark.integration
async def test_results_are_discarded_if_boundary_changes_during_processing(harness: Harness):
    from bahcelab_backend.config import get_settings

    settings = get_settings()
    previous = settings.ndvi_max_parallel_scenes
    settings.ndvi_max_parallel_scenes = 1  # sahneler sırayla: ilk okumada sınır değişir
    try:

        async def shift():
            async with harness.factory() as s:
                await s.execute(
                    text("UPDATE gardens SET geom = ST_Translate(geom, 0.01, 0) WHERE id = :id"),
                    {"id": harness.garden_id},
                )
                await s.commit()

        loop = asyncio.get_running_loop()
        first_read = threading.Event()

        def on_read():
            if not first_read.is_set():
                first_read.set()
                asyncio.run_coroutine_threadsafe(shift(), loop).result(timeout=10)

        harness.on_read = on_read
        job = await harness.run(DAYS)
    finally:
        settings.ndvi_max_parallel_scenes = previous

    assert await harness.observations() == []  # eski sınırla hesaplanan sonuç yazılmadı
    assert harness.read_calls == [DAYS[0]]  # iptalden sonra kalan sahneler okunmadı
    assert job.durum == "hata" and "sınırı değiştiği" in job.hata_mesaji


@pytest.mark.asyncio
@pytest.mark.integration
async def test_stale_jobs_are_failed_on_startup(harness: Harness, factory):
    job_id = await harness.new_job()
    assert await runner.fail_stale_jobs(factory) >= 1
    async with factory() as s:
        job = await NdviRepository(s).get_job(job_id)
    assert job.durum == "hata" and "yeniden başladığı" in job.hata_mesaji


@pytest.mark.asyncio
@pytest.mark.integration
async def test_sample_series_uses_real_pipeline_and_triggers_alert(harness: Harness):
    observations = build_sample_series(harness.garden_id, harness.geometry, harness.storage, TODAY)
    assert 70 <= len(observations) <= 85  # 13 ay, ~5 günde bir
    assert {o.kaynak for o in observations} == {"ornek"}
    assert any(o.durum == "bulutlu" for o in observations) and any(
        o.durum == "tamam" for o in observations
    )
    assert all(harness.storage.exists(o.png_yolu) for o in observations if o.png_yolu)

    from bahcelab_backend.domain.ndvi.rules import drop_alert

    alert = drop_alert(observations)
    assert alert is not None and alert.degisim_yuzde < -10
    zones = [o.sorunlu_bolge_geojson for o in observations if o.durum == "tamam"][-1]
    assert len(zones["features"]) >= 1  # son görüntüde sorunlu bölge var
