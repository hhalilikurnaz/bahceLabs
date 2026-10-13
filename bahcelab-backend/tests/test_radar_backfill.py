"""Radar geçmiş doldurma (ADR 0016): yörünge gruplama, birincil yörüngede ızgara, maske oranı, idempotans, ay boşlukları, normal bant.
Radar kaynağı sahtedir (ağ yok); veritabanı ve depolama gerçektir."""

import uuid
from datetime import date

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from bahcelab_backend.config import get_settings
from bahcelab_backend.domain.acquisitions.backfill import (
    BackfillRunner,
    BackfillService,
    ImmediateMonthQueue,
)
from bahcelab_backend.domain.acquisitions.models import (
    AcquisitionModel,
    AcquisitionStatModel,
    NormalBandModel,
    RadarOrbitModel,
)
from bahcelab_backend.domain.acquisitions.radar_processor import RADAR_SOURCE
from bahcelab_backend.domain.acquisitions.store import decode_grids
from bahcelab_backend.domain.imagery import radar_math as rm
from bahcelab_backend.shared.storage import get_storage

from .conftest import register
from .support.fake_imagery import FakeImageryProvider
from .support.fake_radar import FakeOrbit, FakeRadarProvider
from .test_gardens_api import LAT, LNG, garden_body, square

GEOMETRY = square(300, LNG, LAT)


@pytest.fixture
def factory(test_engine):
    return async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture
async def user_client(client: AsyncClient, cleanup_users):
    await register(client)
    return client


async def new_garden(client: AsyncClient) -> uuid.UUID:
    response = await client.post("/gardens", json=garden_body(geometry=GEOMETRY))
    assert response.status_code == 201, response.text
    return uuid.UUID(response.json()["id"])


def make(factory, radar: FakeRadarProvider, start: str = "2024-01-01"):
    settings = get_settings().model_copy(update={"acq_radar_start": start})
    runner = BackfillRunner(factory, FakeImageryProvider(GEOMETRY), get_storage(), settings, radar_provider=radar)
    return runner, settings


async def run(factory, runner, settings, radar, garden_id, today: date) -> dict:
    async with factory() as session:
        service = BackfillService(session, runner.provider, get_storage(), ImmediateMonthQueue(runner), settings, radar_provider=radar)
        return await service.start(garden_id, today=today, source=RADAR_SOURCE)


async def rows(factory, garden_id) -> list[AcquisitionModel]:
    async with factory() as session:
        found = await session.execute(select(AcquisitionModel).where(AcquisitionModel.garden_id == garden_id, AcquisitionModel.source_id == RADAR_SOURCE).order_by(AcquisitionModel.tarih))
        return list(found.scalars())


async def test_all_passes_are_kept_with_orbit_and_direction_and_the_primary_orbit_gets_the_grid(user_client, factory):
    gid = await new_garden(user_client)
    radar = FakeRadarProvider(GEOMETRY, [FakeOrbit(87, "cikis", 6, 0), FakeOrbit(167, "inis", 12, 3), FakeOrbit(94, "inis", 12, 5)])
    runner, settings = make(factory, radar)
    status = await run(factory, runner, settings, radar, gid, today=date(2024, 3, 31))
    assert status["durum"] == "tamam" and status["toplam_ay"] == 3
    found = await rows(factory, gid)
    assert found and all(a.durum == "net" and a.yorunge and a.gecis_yonu in ("inis", "cikis") and a.formul_surumu == rm.FORMULA_VERSION for a in found)
    assert {(a.yorunge, a.gecis_yonu) for a in found} == {(87, "cikis"), (167, "inis"), (94, "inis")}
    assert len(found) == len(radar.read_calls)  # üst sınır yok: her geçiş edinildi
    async with factory() as session:
        orbits = (await session.execute(select(RadarOrbitModel).where(RadarOrbitModel.garden_id == gid))).scalars().all()
    primary = [o for o in orbits if o.birincil]
    assert len(primary) == 1 and (primary[0].yorunge, primary[0].gecis_yonu) == (87, "cikis")  # en sık geçen
    for a in found:  # ızgara yalnız birincil yörüngede; diğerleri yalnız istatistik
        if a.yorunge == 87:
            grids = decode_grids(get_storage().read(a.izgara_yolu))
            assert set(grids) == set(rm.INDICATORS)
        else:
            assert a.izgara_yolu is None


async def test_stats_are_raw_linear_means_and_scene_has_masked_ratio(user_client, factory):
    gid = await new_garden(user_client)
    radar = FakeRadarProvider(GEOMETRY, [FakeOrbit(87, "cikis", 12, 0)])
    radar.noise = False
    radar.shadow = 0.4  # bahçenin soldan %40'ı gölge
    runner, settings = make(factory, radar)
    await run(factory, runner, settings, radar, gid, today=date(2024, 1, 31))
    found = await rows(factory, gid)
    assert found
    one = found[0]
    assert one.maskeli_oran == pytest.approx(0.40, abs=0.08) and one.gecerli_oran == pytest.approx(1 - one.maskeli_oran, abs=1e-3)
    async with factory() as session:
        stats = {s.indeks: s for s in (await session.execute(select(AcquisitionStatModel).where(AcquisitionStatModel.acquisition_id == one.id))).scalars()}
    assert set(stats) == set(rm.INDICATORS)
    assert stats["vh_db"].ortalama == pytest.approx(float(rm.to_db(0.03)), abs=0.01)  # maske dışı pikseller istatistiğe girmez
    assert stats["vv_db"].ortalama == pytest.approx(float(rm.to_db(0.15)), abs=0.01)
    assert stats["rvi"].ortalama == pytest.approx(4 * 0.03 / (0.15 + 0.03), abs=1e-3)


async def test_second_run_reads_nothing_and_a_failed_month_resumes(user_client, factory):
    gid = await new_garden(user_client)
    radar = FakeRadarProvider(GEOMETRY, [FakeOrbit(87, "cikis", 12, 0)])
    radar.fail_months = {(2024, 2)}
    runner, settings = make(factory, radar)
    status = await run(factory, runner, settings, radar, gid, today=date(2024, 3, 31))
    assert status["durum"] == "hata" and status["hata_ay"] == 1 and status["tamamlanan_ay"] == 2
    radar.fail_months = set()
    reads = len(radar.read_calls)
    status = await run(factory, runner, settings, radar, gid, today=date(2024, 3, 31))
    assert status["durum"] == "tamam" and len(radar.read_calls) > reads
    reads = len(radar.read_calls)
    await run(factory, runner, settings, radar, gid, today=date(2024, 3, 31))
    assert len(radar.read_calls) == reads  # idempotent: tamam aylar atlanır


async def test_sparse_years_show_honestly_in_the_counts(user_client, factory):
    gid = await new_garden(user_client)
    radar = FakeRadarProvider(GEOMETRY, [FakeOrbit(87, "cikis", 6, 0)])
    radar.step_by_year = {2022: 12, 2023: 12}  # S1B arızası: seyrek yıllar
    runner, settings = make(factory, radar, start="2021-01-01")
    await run(factory, runner, settings, radar, gid, today=date(2024, 12, 31))
    per_year: dict[int, int] = {}
    for a in await rows(factory, gid):
        per_year[a.tarih.year] = per_year.get(a.tarih.year, 0) + 1
    assert per_year[2022] < 0.6 * per_year[2021] and per_year[2023] < 0.6 * per_year[2024]  # boşluk uydurulmaz


@pytest.mark.slow
async def test_normal_band_uses_only_the_primary_orbit_and_the_year_rule(user_client, factory):
    gid = await new_garden(user_client)
    radar = FakeRadarProvider(GEOMETRY, [FakeOrbit(87, "cikis", 12, 0), FakeOrbit(167, "inis", 24, 6)])
    radar.noise = False
    runner, settings = make(factory, radar, start="2017-01-01")
    await run(factory, runner, settings, radar, gid, today=date(2026, 1, 31))
    async with factory() as session:
        bands = (await session.execute(select(NormalBandModel).where(NormalBandModel.garden_id == gid, NormalBandModel.source_id == RADAR_SOURCE, NormalBandModel.indeks == "vh_db", NormalBandModel.ay == 1))).scalars().all()
    assert len(bands) == 1
    band = bands[0]
    assert band.yil_sayisi == 9 and band.ceyrek_yeterli and band.onluk_yeterli  # 2017–2025: yalnız tamamlanmış yıllar; yalnız birincil yörünge
    assert band.p50 == pytest.approx(float(rm.to_db(0.03)), abs=0.01)


async def test_backfill_endpoint_reports_radar_progress(user_client, factory, app):
    from bahcelab_backend.api.deps import get_radar

    radar = FakeRadarProvider(GEOMETRY, [FakeOrbit(87, "cikis", 30, 0)])
    app.dependency_overrides[get_radar] = lambda: radar
    gid = await new_garden(user_client)
    before = await user_client.get(f"/gardens/{gid}/gecmis-doldurma", params={"kaynak": "radar"})
    assert before.status_code == 200 and before.json()["durum"] == "yok"
    other = await user_client.get(f"/gardens/{gid}/gecmis-doldurma")
    assert other.json()["toplam_ay"] == 0  # sentinel2 durumu ayrı


async def test_a_month_with_an_unreadable_pass_stays_failed_and_only_the_missing_pass_is_reread(user_client, factory):
    gid = await new_garden(user_client)
    radar = FakeRadarProvider(GEOMETRY, [FakeOrbit(87, "cikis", 12, 0)])
    runner, settings = make(factory, radar)
    real_read, broken = radar.read, {"on": True}

    def flaky(ref, geometry):  # tek geçiş okunamaz
        if broken["on"] and ref.tarih.day in (1, 2, 3, 4):
            raise RuntimeError("ağ hatası")
        return real_read(ref, geometry)

    radar.read = flaky  # type: ignore[method-assign]
    status = await run(factory, runner, settings, radar, gid, today=date(2024, 1, 31))
    assert status["durum"] == "hata"
    ok_before = len([a for a in await rows(factory, gid) if a.durum == "net"])
    broken["on"] = False
    reads = len(radar.read_calls)
    status = await run(factory, runner, settings, radar, gid, today=date(2024, 1, 31))
    assert status["durum"] == "tamam" and len(radar.read_calls) - reads <= 2  # yalnız eksik geçiş(ler)
    assert len([a for a in await rows(factory, gid) if a.durum == "net"]) > ok_before
