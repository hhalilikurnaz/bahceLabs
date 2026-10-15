"""Olay motoru servisi (ADR 0018): gerçek tablolar, kaynak kimlik referansları, birleştirme, idempotans ve güven. Ağsız (tohumlanmış kayıtlar)."""

import json
import uuid
from datetime import UTC, datetime, timedelta

import numpy as np
import pytest
from httpx import AsyncClient
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from bahcelab_backend.api.deps import get_weather_provider
from bahcelab_backend.domain.acquisitions.models import AcquisitionModel, ChangeEventModel
from bahcelab_backend.domain.acquisitions.processor import FORMULA_VERSION as S2_FORMULA
from bahcelab_backend.domain.acquisitions.processor import SOURCE_ID
from bahcelab_backend.domain.acquisitions.radar_processor import RADAR_SOURCE
from bahcelab_backend.domain.acquisitions.repository import AcquisitionRepository
from bahcelab_backend.domain.acquisitions.store import encode_grids
from bahcelab_backend.domain.events import service as events
from bahcelab_backend.domain.events.models import EventModel, EventSourceModel
from bahcelab_backend.domain.multiyear.grid import canonical_grid, garden_mask
from bahcelab_backend.domain.water.era5_sync import garden_cell
from bahcelab_backend.shared.storage import get_storage

from .conftest import register
from .test_gardens_api import LAT, LNG, garden_body, square
from .test_weather_api import FakeProvider

GEOMETRY = square(300, LNG + 0.41, LAT + 0.31)
TODAY = datetime.now(UTC).date()


@pytest.fixture
def provider(app):
    fake = FakeProvider()
    app.dependency_overrides[get_weather_provider] = lambda: fake
    return fake


@pytest.fixture
def factory(test_engine):
    return async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture
async def user_client(client: AsyncClient, cleanup_users):
    await register(client)
    return client


async def seed(client: AsyncClient, factory) -> uuid.UUID:  # noqa: ANN001
    gid = uuid.UUID((await client.post("/gardens", json=garden_body(geometry=GEOMETRY))).json()["id"])
    async with factory() as session:
        cell, _, _ = await garden_cell(session, gid)
        await session.execute(text("DELETE FROM era5_daily WHERE cell_id = :c"), {"c": cell})
        await session.commit()
    return gid


async def add_s2(factory, gid: uuid.UUID, day, ndvi_patch: float | None, *, whole: bool = False) -> uuid.UUID:  # noqa: ANN001
    async with factory() as session:
        repo = AcquisitionRepository(session)
        geometry = await repo.geometry_geojson(gid)
        grid = canonical_grid(geometry)
        mask = garden_mask(grid, geometry)
        ndvi = np.where(mask, 0.7, np.nan).astype(np.float32)
        if ndvi_patch is not None:
            ndvi = np.where(mask, 0.7 - ndvi_patch, np.nan).astype(np.float32) if whole else ndvi
            if not whole:
                ndvi[8:20, 8:20] = np.where(mask[8:20, 8:20], 0.7 - ndvi_patch, np.nan)
        key = f"acq/{gid}/S2_{day}.npz"
        data = encode_grids({"ndvi": ndvi})
        get_storage().save(key, data)
        row = AcquisitionModel(garden_id=gid, source_id=SOURCE_ID, scene_id=f"S2_{day}", tarih=day, bulut_orani=1.0, durum="net", gecerli_oran=1.0, formul_surumu=S2_FORMULA, izgara_yolu=key, izgara_boyut_bayt=len(data), isleme_surumu="t")
        await repo.upsert_acquisition(row, {})
        await session.commit()
        return row.id


async def add_history(factory, gid: uuid.UUID, day, count: int = 9) -> None:  # noqa: ANN001
    """Diğer yılların AYNI dönemi (bahçenin kendi normu): sağlıklı NDVI 0,7 — pikselin dönem p10'u 0,7 olur."""
    for k in range(1, count + 1):
        await add_s2(factory, gid, day.replace(year=day.year - k, day=min(day.day, 28)), None)


async def add_era5(factory, gid: uuid.UUID, rows: dict) -> uuid.UUID:  # noqa: ANN001
    async with factory() as session:
        cell, _, _ = await garden_cell(session, gid)
        for day, (t2m, gust) in rows.items():
            await session.execute(
                text("INSERT INTO era5_daily (cell_id, tarih, toprak_kaynak, hava_kaynak, saatlik) VALUES (:c, :d, 'era5_land', 'era5_land', CAST(:h AS jsonb))"),
                {"c": cell, "d": day, "h": json.dumps({"t2m": [t2m] * 24, "yagis": [0.0] * 24, "hamle": [gust] * 24})},
            )
        await session.commit()
        return cell


async def add_radar_candidate(factory, gid: uuid.UUID, day, *, wet: bool) -> uuid.UUID:  # noqa: ANN001
    async with factory() as session:
        row = ChangeEventModel(
            garden_id=gid, source_id=RADAR_SOURCE, scene_id=f"S1_{day}", tarih=day, yorunge=87, gecis_yonu="cikis", durum="aday", isaret="azalis", alan_orani=0.6, alan_m2=60000.0, buyukluk_db=-4.0, bahce_delta_db=-3.0,
            kalici_sapma="alt", art_arda=True, islaklik_olabilir=wet, yagis_mm=9.0 if wet else 0.0, formul_surumu="t", guven="dusuk" if wet else "orta",
        )
        session.add(row)
        await session.commit()
        return row.id


async def test_frost_s2_and_radar_within_five_days_merge_into_one_event_that_references_sources_by_id(user_client, factory):
    gid = await seed(user_client, factory)
    d = TODAY - timedelta(days=40)
    await add_history(factory, gid, d)
    cell = await add_era5(factory, gid, {d: (-3.0, 10.0), d + timedelta(days=1): (-1.0, 10.0)})
    first = await add_s2(factory, gid, d - timedelta(days=5), None)
    second = await add_s2(factory, gid, d + timedelta(days=3), 0.25)  # 12×12 piksel yama: p10 (0,7) altında ve Δ = −0,25
    await add_s2(factory, gid, d + timedelta(days=10), 0.25)  # sonraki net görüntüde de sürüyor: kalıcı
    radar = await add_radar_candidate(factory, gid, d + timedelta(days=4), wet=False)
    await add_radar_candidate(factory, gid, d + timedelta(days=20), wet=True)  # ıslaklık notlu: güven düşük, olay OLMAZ
    async with factory() as session:
        result = await events.compute_events_for(session, get_storage(), gid, TODAY)
        await session.commit()
        assert result["olay"] == 1 and result["eklenen"] == 1
        ev = (await session.execute(select(EventModel).where(EventModel.garden_id == gid))).scalar_one()
        sources = (await session.execute(select(EventSourceModel).where(EventSourceModel.event_id == ev.id))).scalars().all()
    assert ev.tur == "don" and ev.turler == ["don", "s2_dusus", "radar_degisim"] and ev.guven == "yuksek" and ev.siddet == "siddetli" and ev.katman == "degisim" and not ev.tahmin and ev.durum == "olay"
    assert ev.alan_da is not None and ev.alan_da > 5
    refs = {(s.kaynak_tablosu, s.kaynak_kimligi, s.rol) for s in sources}
    assert ("change_events", str(radar), "radar_degisim") in refs  # radar kaydı KOPYALANMADI, kimlikle referanslandı
    assert ("acquisitions", str(second), "s2_dusus") in refs and ("acquisitions", str(first), "s2_dusus") in refs
    assert {s.kaynak_tablosu for s in sources} == {"change_events", "acquisitions", "era5_daily"} and sum(1 for s in sources if s.rol == "don") == 2
    assert not hasattr(EventModel, "buyukluk_db") and not hasattr(EventModel, "alan_m2")  # radar ölçümleri olay tablosuna kopyalanmadı
    async with factory() as session:
        view = (await events.list_events(session, gid))[0]
    assert view.kaynak_sayisi == len(sources) and view.alan_da is not None and view.alan_da >= 60.0  # radar alanı (60 da) change_events'ten OKUNDU
    assert cell is not None


async def s2_scenario(user_client, factory, *, next_drop: float | None, whole: bool = False, frost: bool = False, ago: int = 60):  # noqa: ANN001, ANN201
    gid = await seed(user_client, factory)
    d = TODAY - timedelta(days=ago)
    await add_history(factory, gid, d)
    await add_era5(factory, gid, {d + timedelta(days=3): (-2.5, 10.0)} if frost else {d: (10.0, 10.0)})
    await add_s2(factory, gid, d - timedelta(days=5), None)
    await add_s2(factory, gid, d + timedelta(days=3), 0.25, whole=whole)
    if next_drop is not None:
        await add_s2(factory, gid, d + timedelta(days=10), next_drop, whole=whole)
    async with factory() as session:
        await events.compute_events_for(session, get_storage(), gid, TODAY)
        await session.commit()
        real = await events.list_events(session, gid)
        doubt = await events.list_events(session, gid, suphe=True)
    return [e for e in real if "s2_dusus" in e.turler], doubt


async def test_a_single_scene_drop_that_recovers_is_an_atmosphere_suspicion_not_an_event(user_client, factory):
    real, doubt = await s2_scenario(user_client, factory, next_drop=0.0)  # sonraki görüntüde toparlandı
    assert real == [] and len(doubt) == 1 and doubt[0].tur == "s2_suphe" and doubt[0].durum == "suphe" and doubt[0].neden == "toparlandi" and doubt[0].guven == "dusuk"


async def test_a_drop_in_the_latest_scene_waits_for_confirmation_as_a_pending_event_not_a_suspicion(user_client, factory):
    real, doubt = await s2_scenario(user_client, factory, next_drop=None, ago=12)  # düşüşü gören görüntü 9 gün önce: sonraki net görüntü henüz yok
    assert doubt == [] and len(real) == 1 and real[0].durum == "bekliyor" and real[0].guven == "orta" and real[0].tur == "s2_dusus"
    old_real, old_doubt = await s2_scenario(user_client, factory, next_drop=None, ago=80)  # 30 günden uzun süredir sonraki görüntü yok: doğrulanamadı
    assert old_real == [] and len(old_doubt) == 1 and old_doubt[0].neden == "teyit_edilemedi"


async def test_the_pending_drop_is_promoted_when_the_next_scene_confirms_and_keeps_the_same_event_key(user_client, factory):
    gid = await seed(user_client, factory)
    d = TODAY - timedelta(days=12)
    await add_history(factory, gid, d)
    await add_era5(factory, gid, {d: (10.0, 10.0)})
    await add_s2(factory, gid, d - timedelta(days=5), None)
    await add_s2(factory, gid, d + timedelta(days=3), 0.25)
    async with factory() as session:
        await events.compute_events_for(session, get_storage(), gid, TODAY)
        await session.commit()
        pending = (await session.execute(select(EventModel).where(EventModel.garden_id == gid, EventModel.tur == "s2_dusus"))).scalar_one()
    assert pending.durum == "bekliyor"
    await add_s2(factory, gid, d + timedelta(days=8), 0.25)  # sonraki net görüntü doğruladı
    async with factory() as session:
        await events.compute_events_for(session, get_storage(), gid, TODAY)
        await session.commit()
        confirmed = (await session.execute(select(EventModel).where(EventModel.garden_id == gid, EventModel.tur == "s2_dusus"))).scalar_one()
    assert confirmed.id == pending.id and confirmed.anahtar == pending.anahtar and confirmed.durum == "olay"  # aynı kimlik: bildirim tekrarlanmaz


async def test_the_events_endpoint_marks_pending_drops_and_the_damage_trace_name(user_client, factory):
    gid = await seed(user_client, factory)
    d = TODAY - timedelta(days=12)
    await add_history(factory, gid, d)
    await add_era5(factory, gid, {d + timedelta(days=1): (-2.5, 10.0)})
    await add_s2(factory, gid, d - timedelta(days=5), None)
    await add_s2(factory, gid, d + timedelta(days=3), 0.25)  # donun hemen ardından düşüş; sonraki görüntü yok
    async with factory() as session:
        await events.compute_events_for(session, get_storage(), gid, TODAY)
        await session.commit()
    body = (await user_client.get(f"/gardens/{gid}/olaylar")).json()
    assert [(o["durum"], o["tur_adi"]) for o in body["olaylar"] if o["tur"] == "s2_dusus"] == [("bekliyor", "Ani düşüş (optik) (doğrulama bekliyor)")]


async def test_a_persistent_partial_drop_is_an_event_without_extra_support(user_client, factory):
    real, doubt = await s2_scenario(user_client, factory, next_drop=0.25)
    assert len(real) == 1 and real[0].tur == "s2_dusus" and real[0].durum == "olay" and doubt == []


async def test_a_whole_garden_drop_needs_weather_or_radar_support(user_client, factory):
    real, doubt = await s2_scenario(user_client, factory, next_drop=0.25, whole=True)
    assert real == [] and len(doubt) == 1 and doubt[0].neden == "tum_bahce_destek_yok"
    real, doubt = await s2_scenario(user_client, factory, next_drop=0.25, whole=True, frost=True)  # ±5 gün içinde don: destek
    assert len(real) == 1 and real[0].tur == "don" and "s2_dusus" in real[0].turler and doubt == []


async def test_recompute_is_idempotent_keeps_ids_and_removes_events_whose_sources_disappeared(user_client, factory):
    gid = await seed(user_client, factory)
    d = TODAY - timedelta(days=30)
    await add_era5(factory, gid, {d: (-1.0, 10.0)})
    async with factory() as session:
        await events.compute_events_for(session, get_storage(), gid, TODAY)
        await session.commit()
        before = (await session.execute(select(EventModel.id, EventModel.anahtar).where(EventModel.garden_id == gid))).all()
        again = await events.compute_events_for(session, get_storage(), gid, TODAY)
        await session.commit()
        after = (await session.execute(select(EventModel.id, EventModel.anahtar).where(EventModel.garden_id == gid))).all()
    assert before == after and again == {"olay": 1, "eklenen": 0, "guncellenen": 1, "silinen": 0}  # kimlik sabit, kopya yok
    async with factory() as session:
        cell, _, _ = await garden_cell(session, gid)
        await session.execute(text("DELETE FROM era5_daily WHERE cell_id = :c"), {"c": cell})
        gone = await events.compute_events_for(session, get_storage(), gid, TODAY)
        await session.commit()
    assert gone["silinen"] == 1 and gone["olay"] == 0


async def test_forecast_wind_is_flagged_as_forecast_and_past_wind_is_low_confidence(user_client, factory):
    gid = await seed(user_client, factory)
    past, future = TODAY - timedelta(days=100), TODAY + timedelta(days=2)
    cell = await add_era5(factory, gid, {past: (10.0, 75.0)})
    async with factory() as session:
        await session.execute(
            text("INSERT INTO era5_daily (cell_id, tarih, toprak_kaynak, hava_kaynak, saatlik) VALUES (:c, :d, 'model', 'model', CAST(:h AS jsonb))"),
            {"c": cell, "d": future, "h": json.dumps({"t2m": [10.0] * 24, "yagis": [0.0] * 24, "hamle": [80.0] * 24})},
        )
        await session.commit()
        await events.compute_events_for(session, get_storage(), gid, TODAY)
        await session.commit()
        rows = {e.baslangic: e for e in (await session.execute(select(EventModel).where(EventModel.garden_id == gid))).scalars().all()}
    assert rows[past].tur == "ruzgar" and rows[past].guven == "dusuk" and not rows[past].tahmin  # geçmiş ERA5 hamlesi: düşük güven
    assert rows[future].tahmin and rows[future].guven == "orta"  # Open-Meteo tahmin hamlesi: uyarı



async def test_events_endpoint_lists_events_and_suspicions_separately_with_ownership(user_client, factory, app):
    from .conftest import make_client

    gid = await seed(user_client, factory)
    d = TODAY - timedelta(days=25)
    await add_era5(factory, gid, {d: (-3.0, 10.0)})
    async with factory() as session:
        await events.compute_events_for(session, get_storage(), gid, TODAY)
        await session.commit()
    body = (await user_client.get(f"/gardens/{gid}/olaylar")).json()
    assert [o["tur"] for o in body["olaylar"]] == ["don"] and body["olaylar"][0]["siddet"] == "siddetli" and body["olaylar"][0]["tur_adi"] == "Don olayı" and body["supheler"] == []
    assert "kopyalan" not in str(body)  # yanıt kaynak kayıt değerlerini taşımaz
    async with make_client(app) as other:
        await register(other)
        assert (await other.get(f"/gardens/{gid}/olaylar")).status_code == 404
