"""Landsat yüzey sıcaklığı (ADR 0017): dönüşüm, QA maskesi, bahçe/tampon özeti, doldurma hattı (sahte sağlayıcı, ağ yok)."""

import uuid
from datetime import date

import numpy as np
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
from bahcelab_backend.domain.acquisitions.landsat_processor import (
    FORMULA_VERSION,
    LANDSAT_SOURCE,
    landsat_grid_key,
    ring_stats,
    ring_values,
    to_canonical,
)
from bahcelab_backend.domain.acquisitions.models import AcquisitionModel, AcquisitionStatModel
from bahcelab_backend.domain.acquisitions.store import decode_grids
from bahcelab_backend.domain.imagery.landsat import dn_to_celsius, qa_valid_mask
from bahcelab_backend.domain.multiyear.grid import canonical_grid
from bahcelab_backend.shared.storage import get_storage

from .conftest import register
from .support.fake_imagery import FakeImageryProvider
from .support.fake_landsat import FakeLandsatProvider
from .test_gardens_api import LAT, LNG, garden_body, square

GEOMETRY = square(300, LNG, LAT)


def test_kelvin_scale_offset_and_celsius() -> None:
    # PC lwir11: K = DN × 0,00341802 + 149; DN 0 = nodata
    dn = np.array([0, 44000, 40000], dtype=np.uint16)
    c = dn_to_celsius(dn, 0.00341802, 149.0)
    assert np.isnan(c[0])
    assert c[1] == pytest.approx(44000 * 0.00341802 + 149 - 273.15, abs=1e-3) and 22 < c[1] < 27 + 100  # ≈ 26 °C
    assert c[1] > c[2]


def test_qa_pixel_masks_fill_cloud_shadow_cirrus_dilated_cloud_and_snow() -> None:
    qa = np.array([1 << 6, 1 << 0, 1 << 1, 1 << 2, 1 << 3, 1 << 4, 1 << 5, (1 << 6) | (1 << 7)], dtype=np.uint16)  # 6 = temiz, 7 = su
    assert qa_valid_mask(qa).tolist() == [True, False, False, False, False, False, False, True]


def test_ring_excludes_the_garden_and_needs_enough_pixels() -> None:
    grid = canonical_grid(GEOMETRY)
    fake = FakeLandsatProvider(GEOMETRY)
    fake.garden_offset = 2.0
    piece = fake.read(fake.search(GEOMETRY, date(2024, 6, 1), date(2024, 6, 30))[0], GEOMETRY)
    values = ring_values(piece, GEOMETRY)
    assert values.size > 20 and abs(float(values.mean()) - fake.base_c) < 0.6  # halka tampon değerinde: bahçe (+2 °C) içermez
    assert ring_stats(values[:3]) is None  # <5 piksel: tampon özeti yok
    canon = to_canonical(piece, grid)
    # en yakın komşu: 30 m piksel 10 m ızgarada 3×3 blok (komşu piksellerin çoğu aynı değerde)
    assert np.isfinite(canon).all() and (np.diff(canon[5], n=1) == 0).mean() > 0.55


@pytest.fixture
def factory(test_engine):
    return async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture
async def user_client(client: AsyncClient, cleanup_users):
    await register(client)
    return client


async def run_months(factory, provider, garden_id, start: str, today: date) -> dict:
    settings = get_settings().model_copy(update={"acq_landsat_start": start})
    runner = BackfillRunner(factory, FakeImageryProvider(GEOMETRY), get_storage(), settings, landsat_provider=provider)
    async with factory() as session:
        service = BackfillService(session, runner.provider, get_storage(), ImmediateMonthQueue(runner), settings, landsat_provider=provider)
        return await service.start(garden_id, today=today, source=LANDSAT_SOURCE)


async def new_garden(client: AsyncClient) -> uuid.UUID:
    response = await client.post("/gardens", json=garden_body(geometry=GEOMETRY))
    assert response.status_code == 201, response.text
    return uuid.UUID(response.json()["id"])


async def test_backfill_stores_celsius_grid_garden_and_buffer_stats_and_keeps_cloudy_scenes_out(user_client, factory):
    gid = await new_garden(user_client)
    provider = FakeLandsatProvider(GEOMETRY, step_days=8, start=date(2024, 1, 1))
    provider.garden_offset = 1.5
    cloudy = date(2024, 1, 9)
    provider.cloudy_dates = {cloudy}
    status = await run_months(factory, provider, gid, "2024-01-01", date(2024, 2, 29))
    assert status["durum"] == "tamam" and status["toplam_ay"] == 2
    async with factory() as session:
        rows = (await session.execute(select(AcquisitionModel).where(AcquisitionModel.garden_id == gid, AcquisitionModel.source_id == LANDSAT_SOURCE).order_by(AcquisitionModel.tarih))).scalars().all()
        net = [a for a in rows if a.durum == "net"]
        assert net and next(a for a in rows if a.tarih == cloudy).durum == "bulutlu" and all(a.formul_surumu == FORMULA_VERSION and a.izgara_yolu == landsat_grid_key(gid, a.scene_id) for a in net)
        stats = {s.indeks: s for s in (await session.execute(select(AcquisitionStatModel).where(AcquisitionStatModel.acquisition_id == net[0].id))).scalars()}
    assert set(stats) == {"st_c", "st_tampon"}
    assert stats["st_c"].ortalama - stats["st_tampon"].ortalama == pytest.approx(1.5, abs=0.5)  # bahçe − tampon ayrı saklanır
    grid = decode_grids(get_storage().read(net[0].izgara_yolu))["st_c"]
    assert grid.shape == canonical_grid(GEOMETRY).shape and 25 < float(np.nanmean(grid)) < 40
    reads = len(provider.read_calls)
    await run_months(factory, provider, gid, "2024-01-01", date(2024, 2, 29))
    assert len(provider.read_calls) == reads  # idempotent: net ve bulutlu sahneler yeniden okunmaz


async def test_unreadable_scene_leaves_the_month_failed_and_resumes_only_the_missing_scene(user_client, factory):
    gid = await new_garden(user_client)
    provider = FakeLandsatProvider(GEOMETRY, step_days=8, start=date(2024, 3, 1))
    bad = date(2024, 3, 9)
    provider.fail_dates = {bad}
    status = await run_months(factory, provider, gid, "2024-03-01", date(2024, 3, 31))
    assert status["durum"] == "hata"
    provider.fail_dates = set()
    reads = len(provider.read_calls)
    status = await run_months(factory, provider, gid, "2024-03-01", date(2024, 3, 31))
    assert status["durum"] == "tamam" and len(provider.read_calls) - reads == 1  # yalnız eksik sahne yeniden okundu
