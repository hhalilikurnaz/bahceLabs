"""HLS NDVI gözlemleri ve kesintisiz canlılık eğrisi uç noktası (ADR 0018). Ağsız: sahte HLS sağlayıcısı + tohumlanmış S2 kayıtları."""

import uuid
from datetime import UTC, date, datetime, timedelta

import numpy as np
import pytest
from httpx import AsyncClient
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from bahcelab_backend.domain.acquisitions.models import AcquisitionModel
from bahcelab_backend.domain.acquisitions.processor import FORMULA_VERSION as S2_FORMULA
from bahcelab_backend.domain.acquisitions.processor import SOURCE_ID
from bahcelab_backend.domain.acquisitions.repository import AcquisitionRepository
from bahcelab_backend.domain.acquisitions.store import PixelStats
from bahcelab_backend.domain.imagery import hls
from bahcelab_backend.domain.series.models import HlsObservationModel
from bahcelab_backend.domain.series.service import sync_hls

from .conftest import register
from .support.fake_hls import FakeHlsProvider
from .test_gardens_api import LAT, LNG, garden_body, square

GEOMETRY = square(150, LNG + 0.51, LAT + 0.41)


@pytest.fixture
def factory(test_engine):
    return async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture
async def user_client(client: AsyncClient, cleanup_users):
    await register(client)
    return client


# ----------------------------------------------------------------------------- saf bant matematiği
def test_fmask_marks_cloud_shadow_adjacent_cirrus_snow_and_high_aerosol_invalid() -> None:
    f = np.array([0b00000000, 0b00000001, 0b00000010, 0b00000100, 0b00001000, 0b00010000, 0b00100000, 0b11000000, 0b01000000], dtype=np.uint8)
    assert hls.fmask_valid(f).tolist() == [True, False, False, False, False, False, True, False, True]  # su (bit 5) ve orta aerosol geçerli; yüksek aerosol geçersiz


def test_ndvi_from_dn_scales_reflectance_and_drops_fill_and_nonpositive_sums() -> None:
    red = np.array([1000, 2000, -9999, 0, 500], dtype=np.int16)
    nir = np.array([5000, 2000, 3000, 0, -9999], dtype=np.int16)
    out = hls.ndvi_from_dn(red, nir)
    assert out[0] == pytest.approx((0.5 - 0.1) / 0.6, abs=1e-6) and out[1] == pytest.approx(0.0, abs=1e-6)
    assert np.isnan(out[2]) and np.isnan(out[3]) and np.isnan(out[4])


def test_summary_is_the_median_over_valid_polygon_pixels_and_reports_the_valid_share() -> None:
    from rasterio.transform import from_origin

    refs = [r for r in FakeHlsProvider().search(GEOMETRY, date(2025, 1, 1), date(2025, 2, 28)) if r.bulut_orani == 5.0]
    piece = FakeHlsProvider().read(refs[0], GEOMETRY)
    full = hls.summarize(piece, GEOMETRY)
    assert full.toplam_piksel >= 9 and full.gecerli_oran == 1.0 and full.ndvi is not None
    half = np.array(piece.ndvi)
    mask = hls.polygon_pixels(piece, GEOMETRY)
    ys, xs = np.nonzero(mask)
    half[ys[: len(ys) // 2], xs[: len(ys) // 2]] = np.nan  # yarısı bulutlu
    partial = hls.summarize(hls.HlsPiece(half, piece.transform, piece.crs), GEOMETRY)
    assert 0.3 < partial.gecerli_oran < 0.7 and partial.ndvi == pytest.approx(full.ndvi)
    none = hls.summarize(hls.HlsPiece(np.full_like(half, np.nan), piece.transform, piece.crs), GEOMETRY)
    assert none.ndvi is None and none.gecerli_oran == 0.0 and from_origin is not None


# ----------------------------------------------------------------------------- servis
async def new_garden(client: AsyncClient) -> uuid.UUID:
    return uuid.UUID((await client.post("/gardens", json=garden_body(geometry=GEOMETRY))).json()["id"])


async def test_hls_sync_is_idempotent_stores_cloudy_scenes_as_empty_and_never_invents_values(user_client, factory):
    gid = await new_garden(user_client)
    start, end = date(2025, 1, 1), date(2025, 3, 31)
    async with factory() as session:
        first = await sync_hls(session, gid, start, end, FakeHlsProvider())
        rows = (await session.execute(select(HlsObservationModel).where(HlsObservationModel.garden_id == gid))).scalars().all()
        second = await sync_hls(session, gid, start, end, FakeHlsProvider())
        again = (await session.execute(text("SELECT count(*) FROM hls_observations WHERE garden_id = :g"), {"g": gid})).scalar_one()
    assert first["yazilan"] == len(rows) > 20 and second["aranan"] == 0 and again == len(rows)  # ikinci çalışma yeni sahne aramaz
    cloudy = [r for r in rows if r.ndvi is None]
    assert cloudy and all(r.gecerli_oran == 0.0 and r.gecerli_piksel == 0 for r in cloudy) and all(0.5 < (r.ndvi or 0.6) < 0.8 for r in rows)


async def add_s2(factory, gid: uuid.UUID, day: date, ndvi: float, valid: float = 1.0) -> None:  # noqa: ANN001
    async with factory() as session:
        repo = AcquisitionRepository(session)
        row = AcquisitionModel(garden_id=gid, source_id=SOURCE_ID, scene_id=f"S2_{day}", tarih=day, bulut_orani=1.0, durum="net", gecerli_oran=valid, formul_surumu=S2_FORMULA, isleme_surumu="t")
        await repo.upsert_acquisition(row, {"ndvi": PixelStats(ndvi, ndvi, ndvi - 0.02, ndvi - 0.01, ndvi + 0.01, ndvi + 0.02, ndvi - 0.05, ndvi + 0.05, 10)})
        await session.commit()


async def test_curve_endpoint_combines_s2_and_hls_marks_estimated_days_and_adds_radar_marks_only_in_gaps(user_client, factory):
    gid = await new_garden(user_client)
    today = datetime.now(UTC).date()
    for i in range(0, 120, 6):
        await add_s2(factory, gid, today - timedelta(days=200 - i), 0.62 + 0.0005 * i)
    async with factory() as session:
        await sync_hls(session, gid, today - timedelta(days=60), today, FakeHlsProvider())
    body = (await user_client.get(f"/gardens/{gid}/canlilik-egrisi", params={"gun": 240})).json()
    assert body["yeterli"] is True and {g["kaynak"] for g in body["gozlemler"]} == {"s2", "hls"}
    pts = {p["tarih"]: p for p in body["noktalar"]}
    gap_day = (today - timedelta(days=73)).isoformat()  # S2 serisi ~86 gün önce bitti; HLS 60 gün önce başlıyor: aradaki boşluk tahmini
    assert pts[gap_day]["tahmini"] is True and pts[gap_day]["alt"] < pts[gap_day]["deger"] < pts[gap_day]["ust"]
    recent = pts[(today - timedelta(days=30)).isoformat()]
    assert recent["ust"] - recent["alt"] < pts[gap_day]["ust"] - pts[gap_day]["alt"]  # gözleme yakınken bant dar
    assert "radar" not in str(body["noktalar"][0]) and body["kademe_notu"].startswith("Kademe bu eğriye değil")
    assert (await user_client.get(f"/gardens/{uuid.uuid4()}/canlilik-egrisi")).status_code == 404


async def test_curve_has_no_line_when_there_are_fewer_than_three_observations(user_client):
    gid = await new_garden(user_client)
    body = (await user_client.get(f"/gardens/{gid}/canlilik-egrisi")).json()
    assert body["yeterli"] is False and body["noktalar"] == [] and body["gozlemler"] == []  # uydurma eğri yok
