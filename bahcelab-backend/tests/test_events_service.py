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


async def add_s2(factory, gid: uuid.UUID, day, ndvi_patch: float | None) -> uuid.UUID:  # noqa: ANN001
    async with factory() as session:
        repo = AcquisitionRepository(session)
        geometry = await repo.geometry_geojson(gid)
        grid = canonical_grid(geometry)
        mask = garden_mask(grid, geometry)
        ndvi = np.where(mask, 0.7, np.nan).astype(np.float32)
        if ndvi_patch is not None:
            ndvi[8:20, 8:20] = np.where(mask[8:20, 8:20], 0.7 - ndvi_patch, np.nan)
        key = f"acq/{gid}/S2_{day}.npz"
        data = encode_grids({"ndvi": ndvi})
        get_storage().save(key, data)
        row = AcquisitionModel(garden_id=gid, source_id=SOURCE_ID, scene_id=f"S2_{day}", tarih=day, bulut_orani=1.0, durum="net", gecerli_oran=1.0, formul_surumu=S2_FORMULA, izgara_yolu=key, izgara_boyut_bayt=len(data), isleme_surumu="t")
        await repo.upsert_acquisition(row, {})
        await session.commit()
        return row.id


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
            kalici_sapma="alt", art_arda=True, islaklik_olabilir=wet, yagis_mm=9.0 if wet else 0.0, formul_surumu="t", guven="dusuk" if wet else "normal",
        )
        session.add(row)
        await session.commit()
        return row.id


async def test_frost_s2_and_radar_within_five_days_merge_into_one_event_that_references_sources_by_id(user_client, factory):
    gid = await seed(user_client, factory)
    d = TODAY - timedelta(days=40)
    cell = await add_era5(factory, gid, {d: (-3.0, 10.0), d + timedelta(days=1): (-1.0, 10.0)})
    first = await add_s2(factory, gid, d - timedelta(days=5), None)
    second = await add_s2(factory, gid, d + timedelta(days=3), 0.2)  # 12×12 piksel yama: ≈ 14 da düşüş
    radar = await add_radar_candidate(factory, gid, d + timedelta(days=4), wet=False)
    await add_radar_candidate(factory, gid, d + timedelta(days=20), wet=True)  # ıslaklık notlu: güven düşük, olay OLMAZ
    async with factory() as session:
        result = await events.compute_events_for(session, get_storage(), gid, TODAY)
        await session.commit()
        assert result["olay"] == 1 and result["eklenen"] == 1
        ev = (await session.execute(select(EventModel).where(EventModel.garden_id == gid))).scalar_one()
        sources = (await session.execute(select(EventSourceModel).where(EventSourceModel.event_id == ev.id))).scalars().all()
    assert ev.tur == "don" and ev.turler == ["don", "s2_dusus", "radar_degisim"] and ev.guven == "yuksek" and ev.siddet == "siddetli" and ev.katman == "degisim" and not ev.tahmin
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


async def test_status_v2_endpoint_returns_a_tier_five_components_and_never_a_number(user_client, factory, provider):
    gid = await seed(user_client, factory)
    body = (await user_client.get(f"/gardens/{gid}/durum-v2")).json()
    assert body["durum"] in ("veri_yok", "izle", "dikkat") and [c["kod"] for c in body["bilesenler"]] == ["agac_gucu", "su", "beslenme", "ani_degisim", "isi"]
    assert not any(c["kullanilabilir"] for c in body["bilesenler"] if c["kod"] in ("agac_gucu", "beslenme", "isi"))  # veri yok: kademe yalnız risk/uyarıdan
    assert "ic_puan" not in body and "skor" not in body and all("puan" not in c for c in body["bilesenler"]) and len(body["nasil"]) <= 3
    assert body["esik_durumu"] == "ön değer · v2" and body["guven"] == "dusuk"
    assert (await user_client.get(f"/gardens/{uuid.uuid4()}/durum-v2")).status_code == 404
