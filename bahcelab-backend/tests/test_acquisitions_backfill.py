"""Geçmiş doldurma (ADR 0015): ay bütçesi, idempotans, kaldığı yerden devam, formül sürümü, bulutlu ay, normal bantlar.
Uydu kaynağı sahtedir (ağ yok); veritabanı ve depolama gerçektir."""

import uuid
from datetime import UTC, date, datetime

import numpy as np
import pytest
from fastapi import Depends
from httpx import AsyncClient
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from bahcelab_backend.config import get_settings
from bahcelab_backend.domain.acquisitions import processor
from bahcelab_backend.domain.acquisitions.backfill import (
    BackfillRunner,
    BackfillService,
    ImmediateMonthQueue,
    fail_stale_months,
)
from bahcelab_backend.domain.acquisitions.models import (
    AcquisitionModel,
    AcquisitionStatModel,
    BackfillMonthModel,
    NormalBandModel,
)
from bahcelab_backend.domain.acquisitions.store import decode_grids
from bahcelab_backend.shared.storage import get_storage

from .conftest import register
from .support.fake_imagery import FakeImageryProvider
from .test_gardens_api import LAT, LNG, garden_body, square

GEOMETRY = square(300, LNG, LAT)
SOURCE = "sentinel2-l2a"


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


def make(factory, start: str, first: date = date(2015, 1, 1)):
    provider = FakeImageryProvider(GEOMETRY, first=first)
    settings = get_settings().model_copy(update={"acq_start": start})
    runner = BackfillRunner(factory, provider, get_storage(), settings)
    return provider, runner, settings


async def run_backfill(factory, runner, settings, provider, garden_id, today: date) -> dict:
    async with factory() as session:
        service = BackfillService(session, provider, get_storage(), ImmediateMonthQueue(runner), settings)
        return await service.start(garden_id, today=today)


async def acquisitions(factory, garden_id, **where) -> list[AcquisitionModel]:
    async with factory() as session:
        rows = await session.execute(select(AcquisitionModel).where(AcquisitionModel.garden_id == garden_id).order_by(AcquisitionModel.tarih))
        return list(rows.scalars())


async def test_monthly_budget_two_best_net_scenes_at_least_ten_days_apart(user_client, factory):
    gid = await new_garden(user_client)
    provider, runner, settings = make(factory, "2024-01-01")
    status = await run_backfill(factory, runner, settings, provider, gid, today=date(2024, 6, 15))
    assert status["durum"] == "tamam" and status["toplam_ay"] == 6 and status["yuzde"] == 100
    rows = [a for a in await acquisitions(factory, gid) if a.durum == "net"]
    by_month: dict[tuple[int, int], list[date]] = {}
    for a in rows:
        by_month.setdefault((a.tarih.year, a.tarih.month), []).append(a.tarih)
    assert set(by_month) == {(2024, m) for m in range(1, 7)}
    for dates in by_month.values():
        assert 1 <= len(dates) <= 2
        if len(dates) == 2:
            assert abs((dates[0] - dates[1]).days) >= settings.acq_min_gap_days
    one = rows[0]
    assert one.formul_surumu and one.isleme_surumu == "05.13" and one.izgara_boyut_bayt and one.gecikme_gun is not None and one.gecerli_oran == 1.0
    grids = decode_grids(get_storage().read(one.izgara_yolu))
    assert {"ndvi", "ndmi", "ndre", "msavi"} <= set(grids) and grids["ndvi"].dtype == np.float32  # ham bant yok, gösterge ızgaraları
    async with factory() as session:
        stats = (await session.execute(select(AcquisitionStatModel).where(AcquisitionStatModel.acquisition_id == one.id))).scalars().all()
    assert {s.indeks for s in stats} >= {"ndvi", "ndre"} and all(s.p10 <= s.medyan <= s.p90 for s in stats)


async def test_second_run_is_idempotent_and_reads_nothing_new(user_client, factory):
    gid = await new_garden(user_client)
    provider, runner, settings = make(factory, "2024-01-01")
    await run_backfill(factory, runner, settings, provider, gid, today=date(2024, 4, 20))
    reads, count = len(provider.read_calls), len(await acquisitions(factory, gid))
    status = await run_backfill(factory, runner, settings, provider, gid, today=date(2024, 4, 20))
    assert len(provider.read_calls) == reads and len(await acquisitions(factory, gid)) == count and status["yuzde"] == 100


async def test_failed_month_resumes_where_it_stopped(user_client, factory):
    gid = await new_garden(user_client)
    provider, runner, settings = make(factory, "2024-01-01")
    provider.fail_years = {2024}  # arama hatası: tüm aylar hata
    first = await run_backfill(factory, runner, settings, provider, gid, today=date(2024, 3, 20))
    assert first["durum"] == "hata" and first["hata_ay"] == 3 and first["tamamlanan_ay"] == 0
    provider.fail_years = set()
    second = await run_backfill(factory, runner, settings, provider, gid, today=date(2024, 3, 20))
    assert second["durum"] == "tamam" and second["tamamlanan_ay"] == 3
    done_reads = len(provider.read_calls)
    third = await run_backfill(factory, runner, settings, provider, gid, today=date(2024, 3, 20))
    assert len(provider.read_calls) == done_reads and third["tamamlanan_ay"] == 3  # tamam aylar yeniden alınmaz


async def test_cloudy_months_stay_empty_and_cloudy_scenes_are_not_retried(user_client, factory):
    gid = await new_garden(user_client)
    provider, runner, settings = make(factory, "2024-01-01")
    provider.cloud_by_year = {2024: 0.95}  # bahçenin %95'i bulutlu
    status = await run_backfill(factory, runner, settings, provider, gid, today=date(2024, 3, 20))
    rows = await acquisitions(factory, gid)
    assert status["net_sahne"] == 0 and rows and all(a.durum == "bulutlu" and a.izgara_yolu is None for a in rows)  # uydurma yok
    reads = len(provider.read_calls)
    await run_backfill(factory, runner, settings, provider, gid, today=date(2024, 3, 20))
    async with factory() as session:  # aylar tamam: yeniden taranmaz
        assert (await session.execute(select(func.count()).select_from(BackfillMonthModel).where(BackfillMonthModel.garden_id == gid, BackfillMonthModel.durum == "tamam"))).scalar_one() == 3
    assert len(provider.read_calls) == reads


async def test_formula_change_recomputes_from_the_archive(user_client, factory, monkeypatch):
    gid = await new_garden(user_client)
    provider, runner, settings = make(factory, "2024-01-01")
    await run_backfill(factory, runner, settings, provider, gid, today=date(2024, 2, 20))
    before = {a.scene_id: a.formul_surumu for a in await acquisitions(factory, gid) if a.durum == "net"}
    monkeypatch.setattr(processor, "FORMULA_VERSION", "f2+test")
    reads = len(provider.read_calls)
    async with factory() as session:  # tüm ayları yeniden aç (formül sürümü değişince arşivden yeniden hesaplama)
        await session.execute(text("UPDATE backfill_months SET durum = 'bekliyor' WHERE garden_id = :g"), {"g": gid})
        await session.commit()
    await run_backfill(factory, runner, settings, provider, gid, today=date(2024, 2, 20))
    after = {a.scene_id: a.formul_surumu for a in await acquisitions(factory, gid) if a.durum == "net"}
    assert len(provider.read_calls) > reads and set(after.values()) == {"f2+test"} and set(before.values()) != {"f2+test"}


async def test_progress_survives_a_restart_and_stale_running_months_are_failed(user_client, factory):
    gid = await new_garden(user_client)
    provider, runner, settings = make(factory, "2024-01-01")
    await run_backfill(factory, runner, settings, provider, gid, today=date(2024, 3, 20))
    async with factory() as session:
        await session.execute(text("UPDATE backfill_months SET durum = 'isleniyor' WHERE garden_id = :g AND ay = '2024-03-01'"), {"g": gid})
        await session.commit()
    assert await fail_stale_months(factory) >= 1
    status = await run_backfill(factory, runner, settings, provider, gid, today=date(2024, 3, 20))
    assert status["durum"] == "tamam" and status["tamamlanan_ay"] == 3


@pytest.mark.slow
async def test_normal_bands_need_enough_years_and_skip_excluded_years(user_client, factory):
    gid = await new_garden(user_client)
    provider, runner, settings = make(factory, "2015-06-01")
    provider.scenes_per_year = 6
    this_year = datetime.now(UTC).year
    await run_backfill(factory, runner, settings, provider, gid, today=date(this_year, 1, 20))
    async with factory() as session:
        rows = (await session.execute(select(NormalBandModel).where(NormalBandModel.garden_id == gid, NormalBandModel.indeks == "ndvi").order_by(NormalBandModel.ay))).scalars().all()
    june = rows[5]
    assert june.yil_sayisi >= 10 and june.ceyrek_yeterli and june.onluk_yeterli and june.p10 <= june.p25 <= june.p50 <= june.p75 <= june.p90
    assert this_year not in june.yillar and 2015 in june.yillar  # cari yıl banda girmez
    jan = rows[0]
    assert jan.formul_surumu and jan.yil_sayisi >= 10
    # 2015'te arşiv Haziran'da başlar (fake `first` 2015-01): kısmi yıllar eksik ay bırakır → ocakta 2015 yok mu? (uydurma yok)
    assert len(rows) == 12


async def test_incremental_refresh_takes_only_new_scenes_and_respects_the_budget(user_client, factory):
    from bahcelab_backend.domain.acquisitions.backfill import refresh_recent

    gid = await new_garden(user_client)
    provider, runner, settings = make(factory, "2024-01-01")
    today = datetime.now(UTC).date()
    settings = settings.model_copy(update={"acq_start": f"{today.year}-01-01", "acq_incremental_days": 45})
    runner = BackfillRunner(factory, provider, get_storage(), settings)
    await run_backfill(factory, runner, settings, provider, gid, today=today)
    reads = len(provider.read_calls)
    scanned = await refresh_recent(factory, runner, [gid])
    assert scanned >= 1 and len(provider.read_calls) == reads  # bütçe dolu: yeni okuma yok (idempotent)
    # Yeni bir sahne gelirse (bütçede yer varsa) yalnız o okunur
    async with factory() as session:
        victim = (await session.execute(select(AcquisitionModel).where(AcquisitionModel.garden_id == gid, AcquisitionModel.durum == "net").order_by(AcquisitionModel.tarih.desc()))).scalars().first()
        await session.delete(victim)
        await session.commit()
    await refresh_recent(factory, runner, [gid])
    assert len(provider.read_calls) > reads  # eksilen bütçe yeniden dolduruldu


@pytest.mark.slow
async def test_backfill_endpoints_require_login_and_report_progress(user_client: AsyncClient, factory, app):
    from bahcelab_backend.api.deps import (
        get_data_foundation_service,
        get_db_session,
        get_imagery,
        get_month_queue,
        get_workspace_id,
    )
    from bahcelab_backend.domain.acquisitions.service import DataFoundationService

    gid = await new_garden(user_client)
    provider, runner, settings = make(factory, "2024-01-01")
    app.dependency_overrides[get_imagery] = lambda: provider
    app.dependency_overrides[get_month_queue] = lambda: ImmediateMonthQueue(runner)

    async def service(session=Depends(get_db_session), workspace_id=Depends(get_workspace_id)):
        return DataFoundationService(session, workspace_id, BackfillService(session, provider, get_storage(), ImmediateMonthQueue(runner), settings))

    app.dependency_overrides[get_data_foundation_service] = service
    status = (await user_client.get(f"/gardens/{gid}/gecmis-doldurma")).json()
    assert status["durum"] == "yok" and status["yuzde"] == 0
    started = await user_client.post(f"/gardens/{gid}/gecmis-doldurma")
    assert started.status_code == 202
    detail = (await user_client.get(f"/gardens/{gid}/gecmis-doldurma", params={"ayrinti": "true"})).json()
    assert detail["durum"] == "tamam" and detail["yuzde"] == 100 and detail["depolama_bayt"] > 0 and detail["aylar"][0]["ay"] == "2024-01-01"
    bands = (await user_client.get(f"/gardens/{gid}/normal-bantlar")).json()
    assert bands["esik_durumu"] == "dogrulanmadi" and bands["asgari_yil_ceyrek"] == 5 and bands["asgari_yil_onluk"] == 8
    assert set(bands["gostergeler"]) >= {"ndvi", "ndre"} and all(m["durum"] == "yetersiz_gecmis" for m in bands["gostergeler"]["ndvi"])  # 2024'ten beri tek yıl: yetersiz geçmiş
    other = await user_client.get(f"/gardens/{uuid.uuid4()}/gecmis-doldurma")
    assert other.status_code == 404
    from httpx import ASGITransport

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as anon:
        assert (await anon.get(f"/gardens/{gid}/gecmis-doldurma")).status_code == 401


@pytest.mark.slow
async def test_acquisition_list_and_grid_endpoints(user_client: AsyncClient, factory, app):
    from bahcelab_backend.api.deps import (
        get_data_foundation_service,
        get_db_session,
        get_imagery,
        get_month_queue,
        get_workspace_id,
    )
    from bahcelab_backend.domain.acquisitions.service import DataFoundationService

    gid = await new_garden(user_client)
    provider, runner, settings = make(factory, "2024-01-01")
    app.dependency_overrides[get_imagery] = lambda: provider
    app.dependency_overrides[get_month_queue] = lambda: ImmediateMonthQueue(runner)

    async def service(session=Depends(get_db_session), workspace_id=Depends(get_workspace_id)):
        return DataFoundationService(session, workspace_id, BackfillService(session, provider, get_storage(), ImmediateMonthQueue(runner), settings))

    app.dependency_overrides[get_data_foundation_service] = service
    await user_client.post(f"/gardens/{gid}/gecmis-doldurma")
    data = (await user_client.get(f"/gardens/{gid}/edinimler")).json()
    assert data["net_sayisi"] >= 6 and data["izgara"]["satir"] > 10 and len(data["izgara"]["koordinatlar"]) == 4
    first = data["edinimler"][0]
    assert {"ndvi", "ndmi", "ndre", "msavi"} <= set(first["gostergeler"]) and first["gostergeler"]["ndvi"]["p10"] <= first["gostergeler"]["ndvi"]["p90"]
    raw = await user_client.get(f"/gardens/{gid}/edinimler/{first['tarih']}/ndvi/izgara")
    values = np.frombuffer(raw.content, dtype="<f4")
    assert raw.status_code == 200 and values.size == data["izgara"]["satir"] * data["izgara"]["sutun"] and np.isfinite(values).sum() > 0
    assert (await user_client.get(f"/gardens/{gid}/edinimler/2001-01-01/ndvi/izgara")).status_code == 404
    assert (await user_client.get(f"/gardens/{gid}/edinimler/{first['tarih']}/yok/izgara")).status_code == 404
