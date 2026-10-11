import asyncio
import threading
import time
import uuid
from datetime import UTC, date, datetime, timedelta

import numpy as np
import pytest
from httpx import AsyncClient
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from bahcelab_backend.domain.ndvi import runner
from bahcelab_backend.domain.ndvi import service as ndvi_service
from bahcelab_backend.domain.ndvi.indices import ALL_OUTPUTS, INDEX_IDS, TRUE_COLOR, bands_needed
from bahcelab_backend.domain.ndvi.models import (
    IndexObservationModel,
    NdviJobModel,
    SceneObservationModel,
)
from bahcelab_backend.domain.ndvi.persist import missing_outputs
from bahcelab_backend.domain.ndvi.repository import NdviRepository
from bahcelab_backend.domain.ndvi.rules import build_alerts
from bahcelab_backend.domain.ndvi.stac import NdviSourceError, Scene
from bahcelab_backend.domain.ndvi.zones import GridObservation, compute_yield_zones, kmeans_1d
from bahcelab_backend.shared.storage import LocalStorage, get_storage

from .conftest import make_client, register
from .support.ndvi_sample import build_sample_series, grid_for, make_scene
from .test_gardens_api import LAT, LNG, garden_body, square

TODAY = date(2026, 10, 10)
CORNERS = [[LNG, LAT], [LNG + 0.001, LAT], [LNG + 0.001, LAT - 0.001], [LNG, LAT - 0.001]]


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


async def add_scene(
    factory,
    garden_id: str,
    day: date,
    means: dict[str, float] | None = None,
    *,
    durum: str = "tamam",
    kaynak: str = "sentinel-2",
    grid: np.ndarray | None = None,
    legacy: bool = False,
    true_color: bool = True,
    cloud: float | None = None,
) -> None:
    """Sahne + indeks kayıtları ve dosyaları. `legacy`: eski yalnızca-NDVI kaydı (ham ızgara yok)."""
    storage = get_storage()
    gid = uuid.UUID(garden_id)
    means = means if means is not None else {"ndvi": 0.6}
    values = grid if grid is not None else np.full((4, 5), 0.6, dtype="<f4")
    async with factory() as session:
        tc_key = None
        if durum == "tamam" and true_color and not legacy:
            tc_key = f"indeks/{garden_id}/{day}/gercek-renk.png"
            storage.save(tc_key, b"\x89PNG-tc-" + str(day).encode())
        session.add(
            SceneObservationModel(
                garden_id=gid,
                tarih=day,
                scene_id=f"S2-{day}",
                durum=durum,
                bulut_orani=cloud,
                gecerli_piksel_orani=1.0 if durum == "tamam" else 0.2,
                satir=None if legacy else values.shape[0],
                sutun=None if legacy else values.shape[1],
                goruntu_koordinatlari=CORNERS,
                gercek_renk_png_yolu=tc_key,
                kaynak=kaynak,
                created_at=datetime.now(UTC),
            )
        )
        await session.flush()
        if durum == "tamam":
            for name, mean in means.items():
                png = f"indeks/{garden_id}/{day}/{name}.png"
                storage.save(png, b"\x89PNG-" + name.encode() + b"-" + str(day).encode())
                bin_key = None
                if not legacy:
                    bin_key = f"indeks/{garden_id}/{day}/{name}.bin"
                    storage.save(bin_key, np.asarray(values, "<f4").tobytes())
                session.add(
                    IndexObservationModel(
                        garden_id=gid,
                        tarih=day,
                        indeks=name,
                        ortalama=mean,
                        medyan=mean,
                        p10=mean - 0.05,
                        p90=mean + 0.05,
                        minimum=mean - 0.1,
                        maksimum=mean + 0.1,
                        png_yolu=png,
                        veri_yolu=bin_key,
                        sorunlu_bolge_geojson={
                            "type": "FeatureCollection",
                            "features": [
                                {
                                    "type": "Feature",
                                    "properties": {"alan_m2": 400, "ortalama": mean - 0.2},
                                    "geometry": None,
                                }
                            ],
                        },
                    )
                )
        await session.commit()


ALL_MEANS = {name: 0.5 for name in INDEX_IDS}


@pytest.fixture
def jobs_started(monkeypatch):
    """Arka plan işini çalıştırmak yerine hangi işlerin sıraya alındığını kaydeder."""
    started: list[uuid.UUID] = []
    monkeypatch.setattr(ndvi_service, "start_job", started.append)
    from bahcelab_backend.config import get_settings

    get_settings().ndvi_enabled = True  # app fixture teardown eski değeri geri yükler
    return started


# ---------------------------------------------------------------- yetki
@pytest.mark.asyncio
async def test_endpoints_require_login(client: AsyncClient):
    gid = uuid.uuid4()
    for method, path in [
        ("GET", "/indeks/tanimlar"),
        ("GET", f"/gardens/{gid}/indeks"),
        ("POST", f"/gardens/{gid}/indeks/refresh"),
        ("GET", f"/gardens/{gid}/indeks/ndvi/2026-10-01.png"),
        ("GET", f"/gardens/{gid}/indeks/ndvi/2026-10-01.bin"),
        ("GET", f"/gardens/{gid}/indeks/ndvi/2026-10-01/zones"),
        ("GET", f"/gardens/{gid}/verimlilik-bolgeleri"),
    ]:
        assert (await client.request(method, path)).status_code == 401, path


@pytest.mark.asyncio
@pytest.mark.integration
async def test_other_users_garden_is_not_accessible(user_client: AsyncClient, app, factory):
    garden = await new_garden(user_client)
    gid = garden["id"]
    await add_scene(factory, gid, date(2026, 10, 1), ALL_MEANS)

    async with make_client(app) as other:
        await register(other)
        for method, path in [
            ("GET", f"/gardens/{gid}/indeks"),
            ("POST", f"/gardens/{gid}/indeks/refresh"),
            ("GET", f"/gardens/{gid}/indeks/ndvi/2026-10-01.png"),
            ("GET", f"/gardens/{gid}/indeks/ndvi/2026-10-01.bin"),
            ("GET", f"/gardens/{gid}/indeks/gercek-renk/2026-10-01.png"),
            ("GET", f"/gardens/{gid}/indeks/ndre/2026-10-01/zones"),
            ("GET", f"/gardens/{gid}/verimlilik-bolgeleri"),
        ]:
            assert (await other.request(method, path)).status_code == 404, path

    assert (await user_client.get(f"/gardens/{gid}/indeks/ndvi/2026-10-01.png")).status_code == 200


@pytest.mark.asyncio
@pytest.mark.integration
async def test_index_definitions(user_client: AsyncClient):
    definitions = {d["id"]: d for d in (await user_client.get("/indeks/tanimlar")).json()}
    assert set(definitions) == set(INDEX_IDS)
    assert definitions["ndmi"]["renk"] == "mavi" and definitions["ndmi"]["min"] == -0.2
    assert definitions["ndre"]["max"] == 0.6 and definitions["cigreen"]["max"] == 3.0
    assert all(d["aciklama"] and d["duraklar"] for d in definitions.values())


# ---------------------------------------------------------------- okuma uçları
@pytest.mark.asyncio
@pytest.mark.integration
async def test_overview_and_downloads(user_client: AsyncClient, factory):
    garden = await new_garden(user_client)
    gid = garden["id"]
    await add_scene(factory, gid, date(2026, 9, 10), {**ALL_MEANS, "ndvi": 0.70})
    await add_scene(factory, gid, date(2026, 9, 15), durum="bulutlu")
    await add_scene(factory, gid, date(2026, 9, 27), {**ALL_MEANS, "ndvi": 0.60})

    body = (await user_client.get(f"/gardens/{gid}/indeks")).json()
    assert [g["tarih"] for g in body["gozlemler"]] == ["2026-09-10", "2026-09-15", "2026-09-27"]
    first, cloudy = body["gozlemler"][0], body["gozlemler"][1]
    assert (
        cloudy["durum"] == "bulutlu"
        and cloudy["indeksler"] == {}
        and cloudy["gercek_renk_var"] is False
    )
    assert set(first["indeksler"]) == set(INDEX_IDS) and first["gercek_renk_var"] is True
    ndvi = first["indeksler"]["ndvi"]
    assert ndvi["ortalama"] == pytest.approx(0.70) and ndvi["png_var"] and ndvi["veri_var"]
    assert (first["satir"], first["sutun"], len(first["koordinatlar"])) == (4, 5, 4)
    assert body["eksik_cikti"] is False
    assert [u["indeks"] for u in body["uyarilar"]] == ["ndvi"]  # 0,70 → 0,60 (17 gün)

    png = await user_client.get(f"/gardens/{gid}/indeks/ndre/2026-09-10.png")
    assert png.status_code == 200 and png.headers["content-type"] == "image/png"
    assert (
        png.content.startswith(b"\x89PNG-ndre-2026-09-10")
        and "private" in png.headers["cache-control"]
    )
    tc = await user_client.get(f"/gardens/{gid}/indeks/gercek-renk/2026-09-10.png")
    assert tc.status_code == 200 and tc.content.startswith(b"\x89PNG-tc-")

    raw = await user_client.get(f"/gardens/{gid}/indeks/ndvi/2026-09-10.bin")
    assert raw.status_code == 200 and raw.headers["content-type"] == "application/octet-stream"
    grid = np.frombuffer(raw.content, dtype="<f4").reshape(first["satir"], first["sutun"])
    assert grid.shape == (4, 5) and grid[0, 0] == pytest.approx(0.6)

    assert (
        await user_client.get(f"/gardens/{gid}/indeks/ndvi/2026-09-15.png")
    ).status_code == 404  # bulutlu
    assert (await user_client.get(f"/gardens/{gid}/indeks/ndvi/2026-01-01.png")).status_code == 404
    assert (await user_client.get(f"/gardens/{gid}/indeks/yok/2026-09-10.png")).status_code == 404
    assert (
        await user_client.get(f"/gardens/{gid}/indeks/gercek-renk/2026-09-10.bin")
    ).status_code == 404
    zones = (await user_client.get(f"/gardens/{gid}/indeks/ndmi/2026-09-10/zones")).json()
    assert zones["features"][0]["properties"]["alan_m2"] == 400

    listed = (await user_client.get("/gardens")).json()
    assert (
        listed[0]["son_ndvi_ortalama"] == pytest.approx(0.60)
        and listed[0]["son_ndvi_tarihi"] == "2026-09-27"
    )


@pytest.mark.asyncio
@pytest.mark.integration
async def test_legacy_scenes_are_reported_as_incomplete(user_client, jobs_started, factory):
    garden = await new_garden(user_client)
    gid = garden["id"]
    await add_scene(factory, gid, date(2026, 10, 1), {"ndvi": 0.6}, legacy=True)
    async with factory() as s:
        await s.execute(
            text("UPDATE ndvi_jobs SET durum='tamam', bitis=now() WHERE garden_id=:g"),
            {"g": uuid.UUID(gid)},
        )
        await s.commit()
    body = (await user_client.get(f"/gardens/{gid}/indeks")).json()
    ndvi = body["gozlemler"][0]["indeksler"]["ndvi"]
    assert body["eksik_cikti"] is True and ndvi["png_var"] and ndvi["veri_var"] is False
    # Eksikler son iş hata değilse otomatik tamamlanır: yeni bir "guncelleme" işi sıraya alınır
    assert body["isleme"]["tur"] == "guncelleme" and len(jobs_started) == 2
    # Ham veri yokken ızgara uç noktası açıkça 404 verir
    assert (await user_client.get(f"/gardens/{gid}/indeks/ndvi/2026-10-01.bin")).status_code == 404


# ---------------------------------------------------------------- verimlilik bölgeleri
def _yield_grid(offset: float) -> np.ndarray:
    """Soldan sağa artan verim deseni (6 × 9 piksel)."""
    return (
        0.35 + 0.05 * np.arange(9, dtype="<f4")[None, :] + offset + np.zeros((6, 1), "<f4")
    ).astype("<f4")


@pytest.mark.asyncio
@pytest.mark.integration
async def test_yield_zones_split_the_garden_into_three_classes(user_client: AsyncClient, factory):
    garden = await new_garden(user_client, geometry=square(161, LNG, LAT))
    gid = garden["id"]
    bounds = garden["geometry"]["coordinates"][0]
    west, east = min(p[0] for p in bounds), max(p[0] for p in bounds)
    south, north = min(p[1] for p in bounds), max(p[1] for p in bounds)
    corners = [[west, north], [east, north], [east, south], [west, south]]

    for i, day in enumerate(
        (date(2026, 7, 1), date(2026, 8, 1), date(2026, 9, 1), date(2026, 10, 1))
    ):
        await add_scene(factory, gid, day, {"ndvi": 0.5}, grid=_yield_grid(0.01 * i))
        async with factory() as s:
            await s.execute(
                text(
                    "UPDATE scene_observations SET goruntu_koordinatlari = CAST(:c AS jsonb) WHERE garden_id=:g AND tarih=:d"
                ),
                {"c": __import__("json").dumps(corners), "g": uuid.UUID(gid), "d": day},
            )
            await s.commit()

    response = await user_client.get(f"/gardens/{gid}/verimlilik-bolgeleri?indeks=ndvi")
    assert response.status_code == 200, response.text
    body = response.json()
    assert (
        body["gozlem_sayisi"] == 4
        and body["ilk_tarih"] == "2026-07-01"
        and body["son_tarih"] == "2026-10-01"
    )
    features = {f["properties"]["sinif"]: f["properties"] for f in body["bolgeler"]["features"]}
    assert set(features) == {"dusuk", "orta", "yuksek"}
    assert (
        features["dusuk"]["ortalama"]
        < features["orta"]["ortalama"]
        < features["yuksek"]["ortalama"]
    )
    assert sum(f["pay"] for f in features.values()) == pytest.approx(1.0, abs=0.01)
    assert body["toplam_alan_m2"] == pytest.approx(
        sum(f["alan_m2"] for f in features.values()), rel=1e-6
    )
    assert body["toplam_alan_m2"] == pytest.approx(
        garden["alan_dekar"] * 1000, rel=0.05
    )  # bahçe alanına yakın
    assert features["dusuk"]["etiket"] == "Düşük" and features["yuksek"]["etiket"] == "Yüksek"

    assert (
        await user_client.get(f"/gardens/{gid}/verimlilik-bolgeleri?indeks=ndre")
    ).status_code == 422


@pytest.mark.asyncio
@pytest.mark.integration
async def test_yield_zones_need_at_least_three_valid_images(user_client: AsyncClient, factory):
    garden = await new_garden(user_client)
    gid = garden["id"]
    await add_scene(factory, gid, date(2026, 9, 1), {"ndvi": 0.5}, grid=_yield_grid(0))
    await add_scene(factory, gid, date(2026, 9, 6), {"ndvi": 0.5}, grid=_yield_grid(0))
    response = await user_client.get(f"/gardens/{gid}/verimlilik-bolgeleri")
    assert (
        response.status_code == 422
        and "en az 3 geçerli görüntü" in response.json()["error"]["message"]
    )


def test_kmeans_and_zones_unit():
    values = np.concatenate([np.full(30, 0.2), np.full(30, 0.5), np.full(30, 0.8)])
    assert kmeans_1d(values) == pytest.approx([0.2, 0.5, 0.8])
    garden = {
        "type": "Polygon",
        "coordinates": [[[0, 0], [0.001, 0], [0.001, 0.001], [0, 0.001], [0, 0]]],
    }
    corners = ((0.0, 0.001), (0.001, 0.001), (0.001, 0.0), (0.0, 0.0))
    obs = [GridObservation(date(2026, 1, d), _yield_grid(0.0), corners) for d in (1, 2)]
    assert compute_yield_zones(obs, garden) is None  # 3'ten az görüntü
    obs.append(GridObservation(date(2026, 1, 3), _yield_grid(0.0), corners))
    result = compute_yield_zones(obs, garden)
    assert [f["properties"]["sinif"] for f in result["features"]] == ["dusuk", "orta", "yuksek"]


# ---------------------------------------------------------------- iş yaşam döngüsü
@pytest.mark.asyncio
@pytest.mark.integration
async def test_new_garden_queues_initial_job_and_refresh_reuses_active_job(
    user_client, jobs_started
):
    garden = await new_garden(user_client)
    assert len(jobs_started) == 1
    overview = (await user_client.get(f"/gardens/{garden['id']}/indeks")).json()
    assert overview["isleme"]["tur"] == "ilk" and overview["isleme"]["durum"] == "bekliyor"
    assert len(jobs_started) == 1  # aktif iş varken ikinci iş açılmaz

    first = await user_client.post(f"/gardens/{garden['id']}/indeks/refresh")
    second = await user_client.post(f"/gardens/{garden['id']}/indeks/refresh")
    assert (
        first.status_code == 202
        and first.json()["id"] == second.json()["id"]
        and len(jobs_started) == 1
    )


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
    await add_scene(factory, gid, date(2026, 10, 1), ALL_MEANS)

    first = (await user_client.get(f"/gardens/{gid}/indeks")).json()
    assert first["isleme"]["tur"] == "guncelleme" and len(jobs_started) == 1

    async with factory() as s:
        await s.execute(
            text("UPDATE ndvi_jobs SET durum='tamam', bitis=:t WHERE garden_id=:g"),
            {"t": datetime.now(UTC) - timedelta(hours=1), "g": uuid.UUID(gid)},
        )
        await s.commit()
    assert (await user_client.get(f"/gardens/{gid}/indeks")).json()["isleme"]["durum"] == "tamam"
    assert len(jobs_started) == 1

    async with factory() as s:
        await s.execute(
            text("UPDATE ndvi_jobs SET bitis=:t WHERE garden_id=:g"),
            {"t": datetime.now(UTC) - timedelta(hours=13), "g": uuid.UUID(gid)},
        )
        await s.commit()
    await user_client.get(f"/gardens/{gid}/indeks")
    assert len(jobs_started) == 2


@pytest.mark.asyncio
@pytest.mark.integration
async def test_boundary_edit_purges_everything_and_requeues(user_client, jobs_started, factory):
    garden = await new_garden(user_client)
    gid = garden["id"]
    async with factory() as s:
        await s.execute(
            text("UPDATE ndvi_jobs SET durum='tamam' WHERE garden_id=:g"), {"g": uuid.UUID(gid)}
        )
        await s.commit()
    await add_scene(factory, gid, date(2026, 10, 1), ALL_MEANS)
    keys = [f"indeks/{gid}/2026-10-01/{n}.png" for n in ALL_OUTPUTS if n != TRUE_COLOR] + [
        f"indeks/{gid}/2026-10-01/gercek-renk.png"
    ]
    before = len(jobs_started)

    await user_client.patch(f"/gardens/{gid}", json={"ad": "Yeni Ad"})  # ad değişimi dokunmaz
    assert (await user_client.get(f"/gardens/{gid}/indeks/ndvi/2026-10-01.png")).status_code == 200
    assert len(jobs_started) == before

    assert (
        await user_client.patch(f"/gardens/{gid}", json={"geometry": square(200)})
    ).status_code == 200
    assert not any(get_storage().exists(k) for k in keys)
    body = (await user_client.get(f"/gardens/{gid}/indeks")).json()
    assert (
        body["gozlemler"] == []
        and body["isleme"]["tur"] == "yeniden"
        and len(jobs_started) == before + 1
    )


@pytest.mark.asyncio
@pytest.mark.integration
async def test_boundary_edit_cancels_running_job(user_client, jobs_started, factory):
    garden = await new_garden(user_client)
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
async def test_deleting_garden_removes_files_and_rows(user_client, factory):
    garden = await new_garden(user_client)
    gid = garden["id"]
    await add_scene(factory, gid, date(2026, 10, 1), ALL_MEANS)
    key = f"indeks/{gid}/2026-10-01/ndvi.bin"
    assert get_storage().exists(key)
    assert (await user_client.delete(f"/gardens/{gid}")).status_code == 204
    assert not get_storage().exists(key)
    async with factory() as s:
        for table in ("scene_observations", "index_observations"):
            count = (
                await s.execute(
                    text(f"SELECT count(*) FROM {table} WHERE garden_id=:g"), {"g": uuid.UUID(gid)}
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
        self.read_calls: list[tuple[date, frozenset[str]]] = []
        self.fail_dates: set[date] = set()
        self.cloud: dict[date, float] = {}
        self.active = 0
        self.max_active = 0
        self.lock = threading.Lock()
        self.on_read = None

    def search_for(self, days: list[date], error: Exception | None = None):
        def search(geometry, start, end):
            if error:
                raise error
            return [Scene(tarih=d, scene_id=f"S2-{d}", bulut_orani=10.0, item=None) for d in days]

        return search

    def read(self, scene: Scene, geometry, bands=None):
        with self.lock:
            self.active += 1
            self.max_active = max(self.max_active, self.active)
            self.read_calls.append((scene.tarih, frozenset(bands or ())))
        try:
            time.sleep(0.05)
            if scene.tarih in self.fail_dates:
                raise OSError("ağ hatası")
            if self.on_read:
                self.on_read()
            return make_scene(
                self.grid, 0.65, self.cloud.get(scene.tarih, 0.0), ndre=0.33, ndmi=0.21
            )
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

    async def scenes(self):
        async with self.factory() as s:
            return await NdviRepository(s).list_scenes(self.garden_id)


@pytest.fixture
async def harness(user_client: AsyncClient, factory, tmp_path):
    garden = await new_garden(user_client)
    return Harness(factory, tmp_path, garden["id"], garden["geometry"])


DAYS = [date(2026, 9, 20), date(2026, 9, 25), date(2026, 9, 30)]


@pytest.mark.asyncio
@pytest.mark.integration
async def test_one_read_per_scene_produces_every_index_and_true_color(harness: Harness):
    harness.cloud[DAYS[1]] = 0.6  # geçerli oran 0,4 → bulutlu
    job = await harness.run(DAYS)
    assert (job.durum, job.toplam, job.islenen, job.hata_mesaji) == ("tamam", 3, 3, None)

    # Her sahne için tek okuma turu ve gereken tüm bantlar (7 bant) tek seferde
    assert sorted(d for d, _ in harness.read_calls) == DAYS
    assert all(
        bands == frozenset(bands_needed(set(ALL_OUTPUTS))) for _, bands in harness.read_calls
    )

    scenes = await harness.scenes()
    assert [(s.scene.tarih, s.scene.durum) for s in scenes] == [
        (DAYS[0], "tamam"),
        (DAYS[1], "bulutlu"),
        (DAYS[2], "tamam"),
    ]
    clear, cloudy = scenes[0], scenes[1]
    assert set(clear.indices) == set(INDEX_IDS) and cloudy.indices == {}
    assert clear.indices["ndvi"].ortalama == pytest.approx(0.65, abs=1e-3)
    assert clear.indices["ndre"].ortalama == pytest.approx(0.33, abs=1e-3)
    assert clear.indices["ndmi"].ortalama == pytest.approx(0.21, abs=1e-3)
    assert clear.scene.bulut_orani == 10.0 and clear.scene.kaynak == "sentinel-2"
    assert (clear.scene.satir, clear.scene.sutun) == harness.grid.shape and len(
        clear.scene.goruntu_koordinatlari
    ) == 4
    assert missing_outputs(clear) == set() and missing_outputs(cloudy) == set()
    for name in INDEX_IDS:
        row = clear.indices[name]
        assert harness.storage.exists(row.png_yolu) and harness.storage.exists(row.veri_yolu)
        grid = np.frombuffer(harness.storage.read(row.veri_yolu), dtype="<f4")
        assert grid.size == clear.scene.satir * clear.scene.sutun and np.isfinite(grid).any()
    assert harness.storage.exists(clear.scene.gercek_renk_png_yolu)


@pytest.mark.asyncio
@pytest.mark.integration
async def test_complete_dates_are_never_recomputed(harness: Harness):
    await harness.run(DAYS)
    harness.read_calls.clear()
    second = await harness.run(DAYS, tur="guncelleme")
    assert harness.read_calls == [] and (second.durum, second.toplam) == ("tamam", 0)
    third = await harness.run([*DAYS, date(2026, 10, 5)], tur="guncelleme")
    assert [d for d, _ in harness.read_calls] == [date(2026, 10, 5)] and third.toplam == 1


@pytest.mark.asyncio
@pytest.mark.integration
async def test_legacy_ndvi_only_scenes_are_completed_reading_only_needed_bands(
    harness: Harness, factory
):
    """Eski kayıtlar yeniden indirilmez: yalnızca eksik çıktıların bantları okunur, mevcut NDVI PNG'si korunur."""
    day = DAYS[0]
    await add_scene(factory, str(harness.garden_id), day, {"ndvi": 0.6}, legacy=True)
    legacy_png = f"indeks/{harness.garden_id}/{day}/ndvi.png"
    assert (await harness.scenes())[0].indices["ndvi"].veri_yolu is None

    job = await harness.run([day], tur="guncelleme")
    assert job.durum == "tamam" and job.toplam == 1
    # Eksik: tüm indeks ızgaraları (NDVI ızgarası dahil) ve gerçek renk → tüm bantlar; ama tek okuma turu
    assert harness.read_calls == [(day, frozenset(bands_needed(set(ALL_OUTPUTS))))]

    (item,) = await harness.scenes()
    assert missing_outputs(item) == set() and set(item.indices) == set(INDEX_IDS)
    assert item.indices["ndvi"].veri_yolu and item.scene.satir and item.scene.gercek_renk_png_yolu
    assert item.indices["ndvi"].png_yolu == legacy_png  # aynı anahtar, güncel içerik

    # Kısmen tamamlanmış sahnede yalnızca eksiklerin bantları okunur
    harness.read_calls.clear()
    async with factory() as s:
        await s.execute(
            text("DELETE FROM index_observations WHERE garden_id=:g AND indeks IN ('ndre','ndmi')"),
            {"g": harness.garden_id},
        )
        await s.commit()
    await harness.run([day], tur="guncelleme")
    assert harness.read_calls == [(day, frozenset(bands_needed({"ndre", "ndmi"})))]
    assert "B02" not in harness.read_calls[0][1] and "B11" in harness.read_calls[0][1]
    assert missing_outputs((await harness.scenes())[0]) == set()


@pytest.mark.asyncio
@pytest.mark.integration
async def test_failed_scene_is_reported_and_retried_next_time(harness: Harness):
    harness.fail_dates.add(DAYS[1])
    job = await harness.run(DAYS)
    assert job.durum == "tamam" and job.islenen == 2 and "1 sahne işlenemedi" in job.hata_mesaji
    assert [s.scene.tarih for s in await harness.scenes()] == [DAYS[0], DAYS[2]]

    harness.fail_dates.clear()
    harness.read_calls.clear()
    retry = await harness.run(DAYS, tur="guncelleme")
    assert [d for d, _ in harness.read_calls] == [DAYS[1]] and retry.hata_mesaji is None


@pytest.mark.asyncio
@pytest.mark.integration
async def test_all_scenes_failing_marks_job_as_error_without_crashing(harness: Harness):
    harness.fail_dates.update(DAYS)
    job = await harness.run(DAYS)
    assert job.durum == "hata" and "okunamadı" in job.hata_mesaji and await harness.scenes() == []


@pytest.mark.asyncio
@pytest.mark.integration
async def test_unreachable_source_gives_clear_error_and_can_be_retried(harness: Harness):
    error = NdviSourceError(
        "Uydu verisi kaynağına (Planetary Computer) ulaşılamadı. Biraz sonra tekrar deneyin."
    )
    job = await harness.run(DAYS, search_error=error)
    assert job.durum == "hata" and "ulaşılamadı" in job.hata_mesaji and job.bitis is not None
    recovered = await harness.run(DAYS)
    assert recovered.durum == "tamam" and len(await harness.scenes()) == 3


@pytest.mark.asyncio
@pytest.mark.integration
async def test_unexpected_errors_never_escape_the_runner(harness: Harness, monkeypatch):
    def boom(*_a, **_k):
        raise RuntimeError("beklenmeyen")

    monkeypatch.setattr(runner, "analyze_scene", boom)
    assert (await harness.run(DAYS)).durum == "hata"


@pytest.mark.asyncio
@pytest.mark.integration
async def test_at_most_two_scenes_are_processed_at_once(harness: Harness):
    days = [date(2026, 9, 1) + timedelta(days=5 * i) for i in range(8)]
    job = await harness.run(days)
    assert job.durum == "tamam" and job.islenen == 8 and harness.max_active == 2


@pytest.mark.asyncio
@pytest.mark.integration
async def test_results_are_discarded_if_boundary_changes_during_processing(harness: Harness):
    from bahcelab_backend.config import get_settings

    settings = get_settings()
    previous = settings.ndvi_max_parallel_scenes
    settings.ndvi_max_parallel_scenes = 1
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

    assert await harness.scenes() == []
    assert [d for d, _ in harness.read_calls] == [DAYS[0]]
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
async def test_runner_waits_for_job_row_committed_after_the_task_starts(harness: Harness):
    """FastAPI arka plan görevi, isteğin commit'inden önce başlayabilir (gerçek uçtan uca denemede görüldü)."""
    job_id = uuid.uuid4()
    task = asyncio.create_task(
        runner.run_job(
            job_id,
            session_factory=harness.factory,
            storage=harness.storage,
            search=harness.search_for(DAYS),
            read=harness.read,
            today=TODAY,
        )
    )
    await asyncio.sleep(0.6)
    async with harness.factory() as session:
        session.add(
            NdviJobModel(id=job_id, garden_id=harness.garden_id, tur="ilk", durum="bekliyor")
        )
        await session.commit()
    await asyncio.wait_for(task, timeout=30)
    async with harness.factory() as session:
        job = await NdviRepository(session).get_job(job_id)
    assert job.durum == "tamam" and job.islenen == 3


@pytest.mark.asyncio
@pytest.mark.integration
async def test_sample_series_covers_every_output_and_raises_a_multi_index_alert(harness: Harness):
    scenes, rows = build_sample_series(harness.garden_id, harness.geometry, harness.storage, TODAY)
    assert 70 <= len(scenes) <= 85 and {s.kaynak for s in scenes} == {"ornek"}
    assert any(s.durum == "bulutlu" for s in scenes) and any(s.durum == "tamam" for s in scenes)
    clear_dates = {s.tarih for s in scenes if s.durum == "tamam"}
    assert {r.tarih for r in rows} == clear_dates
    assert {r.indeks for r in rows} == set(INDEX_IDS) and len(rows) == len(clear_dates) * len(
        INDEX_IDS
    )
    assert all(
        harness.storage.exists(r.png_yolu) and harness.storage.exists(r.veri_yolu) for r in rows
    )
    assert all(harness.storage.exists(s.gercek_renk_png_yolu) for s in scenes if s.durum == "tamam")

    # Aynı işleme hattı: eksik çıktı yok; son görüntüde birden fazla indeks aynı bölgede düşer
    from bahcelab_backend.domain.ndvi.repository import SceneWithIndices

    items = []
    by_date: dict[date, dict] = {}
    for r in rows:
        by_date.setdefault(r.tarih, {})[r.indeks] = r
    for s in scenes:
        items.append(SceneWithIndices(s, by_date.get(s.tarih, {})))
    assert all(missing_outputs(i) == set() for i in items)
    alerts = build_alerts(items)
    assert alerts and alerts[0].tur == "coklu_indeks" and alerts[0].oncelik == "yuksek"
    assert {"ndvi", "ndre"} <= set(alerts[0].indeksler)
    assert not [a for a in alerts if a.degisim_yuzde and a.degisim_yuzde > 0]
