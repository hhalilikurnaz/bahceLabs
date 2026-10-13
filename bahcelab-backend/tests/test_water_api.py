"""Su sekmesi uç noktası (ADR 0017): ERA5 günlük + toprak profili + Landsat → karar cümlesi, nem profili, su dengesi, yüzey–hava. Ağsız (toprak satırı tohumlanır)."""

import json
import uuid
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from bahcelab_backend.domain.acquisitions.landsat_processor import FORMULA_VERSION, LANDSAT_SOURCE
from bahcelab_backend.domain.acquisitions.models import AcquisitionModel
from bahcelab_backend.domain.acquisitions.repository import AcquisitionRepository
from bahcelab_backend.domain.acquisitions.store import PixelStats, encode_grids, pixel_stats
from bahcelab_backend.domain.multiyear.grid import canonical_grid, garden_mask
from bahcelab_backend.domain.water.era5_sync import garden_cell
from bahcelab_backend.shared.storage import get_storage

from .conftest import register
from .test_gardens_api import LAT, LNG, garden_body, square

GEOMETRY = square(300, LNG, LAT)
TODAY = datetime.now(UTC).astimezone(ZoneInfo("Europe/Istanbul")).date()


@pytest.fixture
def factory(test_engine):
    return async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture
async def user_client(client: AsyncClient, cleanup_users):
    await register(client)
    return client


async def seed(client: AsyncClient, factory, *, with_soil: bool = True) -> uuid.UUID:
    response = await client.post("/gardens", json=garden_body(geometry=GEOMETRY))
    gid = uuid.UUID(response.json()["id"])
    async with factory() as session:
        cell, _, _ = await garden_cell(session, gid)
        await session.execute(text("DELETE FROM era5_daily WHERE cell_id = :c"), {"c": cell})
        # 2015–2025 klimatolojisi: katman başına 0,10–0,40 aralığında dağılım (tarla/solma değil, hücrenin kendi aralığı)
        rows = []
        day = TODAY.replace(year=TODAY.year - 11, month=1, day=1)
        n = 0
        while day <= TODAY + timedelta(days=7):
            wet = 0.10 + 0.30 * ((n % 100) / 99)
            model = day > TODAY - timedelta(days=6)
            rows.append({"c": cell, "d": day, "s0": wet, "s1": wet, "s2": wet, "s3": wet, "e": 3.0, "y": 8.0 if n % 20 == 0 else 0.0, "ts": "model" if model else "era5_land", "hs": "model" if model else "era5_land", "h": json.dumps({"t2m": [20.0 + h * 0.5 for h in range(24)]})})
            day += timedelta(days=1)
            n += 1
        await session.execute(
            text("INSERT INTO era5_daily (cell_id, tarih, sm0, sm1, sm2, sm3, et0_mm, yagis_mm, toprak_kaynak, hava_kaynak, saatlik) VALUES (:c, :d, :s0, :s1, :s2, :s3, :e, :y, :ts, :hs, CAST(:h AS jsonb))"), rows
        )
        if with_soil:
            await session.execute(
                text("INSERT INTO soil_profiles (garden_id, kum_yuzde, kil_yuzde, silt_yuzde, organik_karbon_g_kg, tarla_kapasitesi, solma_noktasi, kaynak) VALUES (:g, 33, 27, 40, 15, 0.32, 0.17, 'test')"), {"g": gid}
            )
        repo = AcquisitionRepository(session)
        geometry = await repo.geometry_geojson(gid)
        grid = canonical_grid(geometry)
        mask = garden_mask(grid, geometry)
        import numpy as np

        for i, back in enumerate((20, 12, 4)):
            tarih = TODAY - timedelta(days=back)
            celsius = np.full(grid.shape, 36.0 + i, dtype=np.float32)
            key = f"acq-landsat/{gid}/LC09_{tarih}.npz"
            data = encode_grids({"st_c": celsius})
            get_storage().save(key, data)
            row = AcquisitionModel(garden_id=gid, source_id=LANDSAT_SOURCE, scene_id=f"LC09_{tarih}", tarih=tarih, bulut_orani=3.0, durum="net", gecerli_oran=1.0, formul_surumu=FORMULA_VERSION, izgara_yolu=key, izgara_boyut_bayt=len(data), isleme_surumu="L9")
            stats = {"st_c": pixel_stats(celsius, mask), "st_tampon": PixelStats(35.0 + i, 35.0 + i, 34.0, 34.5, 35.5, 36.0, 33.0, 37.0, 40)}
            await repo.upsert_acquisition(row, {k: v for k, v in stats.items() if v is not None})
        await session.commit()
    return gid


async def test_su_returns_decision_profile_balance_thermal_and_source_chips(user_client, factory):
    gid = await seed(user_client, factory)
    body = (await user_client.get(f"/gardens/{gid}/su")).json()
    assert body["on_deger"] is True and body["karar"].startswith(("Kök bölgesi", "Su dengesi"))
    p = body["profil"]
    assert [k["derinlik"] for k in p["katmanlar"]] == ["0–7 cm", "7–28 cm", "28–100 cm", "100–255 cm"]
    assert all(k["normal_alt"] < k["normal_ust"] for k in p["katmanlar"])  # bu hücrenin p10–p90 aralığı
    assert p["kok_bolgesi_sinif"] in ("nemli", "orta", "kuru") and 0 <= p["kok_bolgesi_doluluk"] <= 100
    assert p["gecis_gunu"] is not None and p["katmanlar"][0]["bugun_kaynak"] == "model"  # son günler model: kaynak çipinde geçiş yazılır
    d = body["denge"]
    assert d["taw_mm"] == pytest.approx((0.32 - 0.17) * 800) and d["tukenme_esigi_mm"] == pytest.approx(0.5 * d["taw_mm"])
    assert len(d["gunler"]) == 30 + 7 and sum(1 for g in d["gunler"] if g["tahmin"]) == 8 and d["yagis_kaynagi"] == "era5" and "yeterli ay yok" in d["yagis_karari"]
    assert all(g["tukenme_mm"] is not None for g in d["gunler"]) and d["gunler"][-1]["tarih"] == str(TODAY + timedelta(days=7))
    t = body["sicaklik"]
    assert len(t["noktalar"]) == 3 and t["noktalar"][-1]["hava_c"] == pytest.approx(25.5) and t["noktalar"][-1]["fark_c"] == pytest.approx(38.0 - 25.5)  # 11:00 ERA5 sıcaklığı 25,5; yüzey 38
    assert all(n["durum"] == "yetersiz_gecmis" and n["stres"] is None and n["normal"] is None for n in t["noktalar"])  # aynı ayda 3 sahne < 8: sabit eşikle yargı verilmez
    assert body["karar_detay"]["cumle"] == body["karar"] and body["profil"]["donem"] == ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"][TODAY.month - 1]
    assert all(n["karisik_piksel"] is False for n in t["noktalar"])  # bahçe − tampon = 1,0 °C < 1,5 °C eşiği
    assert set(body["kaynaklar"]) == {"profil", "denge", "sicaklik"} and any("SMAP" in s for s in body["dogrulama"]) and body["toprak"]["tarla_kapasitesi"] == pytest.approx(0.32)


async def test_su_without_soil_data_says_the_balance_cannot_be_computed_instead_of_guessing(user_client, factory, monkeypatch):
    from bahcelab_backend.domain.water import service as water_service

    async def unreachable(lat, lng, client=None):  # noqa: ANN001, ANN202
        return None

    monkeypatch.setattr(water_service, "fetch_soilgrids", unreachable)
    gid = await seed(user_client, factory, with_soil=False)
    body = (await user_client.get(f"/gardens/{gid}/su")).json()
    assert body["denge"]["taw_mm"] is None and body["denge"]["gunler"] == [] and "hesaplanamadı" in body["karar"]
    assert body["toprak"]["tarla_kapasitesi"] is None and body["profil"]["kok_bolgesi_doluluk"] is not None  # nem profili toprak parametresinden bağımsız


async def test_landsat_endpoints_list_scenes_and_serve_a_polygon_masked_celsius_grid(user_client, factory):
    import numpy as np

    from bahcelab_backend.domain.acquisitions import masking

    gid = await seed(user_client, factory)
    body = (await user_client.get(f"/gardens/{gid}/landsat/edinimler")).json()
    assert len(body["edinimler"]) == 3 and body["edinimler"][0]["bahce_c"] == pytest.approx(36.0) and body["edinimler"][-1]["tampon_c"] == pytest.approx(37.0) and body["izgara"]["satir"] > 0
    day = body["edinimler"][0]["tarih"]
    grid = await user_client.get(f"/gardens/{gid}/landsat/edinimler/{day}/izgara")
    values = np.frombuffer(grid.content, dtype="<f4")
    assert grid.status_code == 200 and int(np.isfinite(values).sum()) == int(masking.mask_for(GEOMETRY).sum()) and np.nanmean(values) == pytest.approx(36.0, abs=0.1)
    assert (await user_client.get(f"/gardens/{gid}/landsat/edinimler/2001-01-01/izgara")).status_code == 404
    assert (await user_client.get(f"/gardens/{uuid.uuid4()}/su")).status_code == 404


async def test_climatology_and_fill_are_compared_with_the_same_season_not_the_whole_year(user_client, factory):
    """Kış ıslak (0,40), yaz kuru (0,15): 0,15 yazın NORMAL (≈ orta), kışın ise çok kuru. Yıl geneliyle bakılsa her zaman «kuru» görünürdü."""
    from bahcelab_backend.domain.agro.catalog import load_catalog
    from bahcelab_backend.domain.water import balance as wb
    from bahcelab_backend.domain.water.service import WaterService

    gid = uuid.UUID((await user_client.post("/gardens", json=garden_body(geometry=GEOMETRY))).json()["id"])
    rule = load_catalog().su
    async with factory() as session:
        cell, _, _ = await garden_cell(session, gid)
        await session.execute(text("DELETE FROM era5_daily WHERE cell_id = :c"), {"c": cell})
        rows, day, n = [], date(2015, 1, 1), 0
        while day <= date(2025, 12, 31):
            base = 0.40 if day.month in (12, 1, 2) else 0.15 if day.month in (7, 8, 9) else 0.28
            v = base + 0.02 * ((n % 7) / 6)
            rows.append({"c": cell, "d": day, "v": v})
            day += timedelta(days=1)
            n += 1
        await session.execute(text("INSERT INTO era5_daily (cell_id, tarih, sm0, sm1, sm2, sm3, toprak_kaynak, hava_kaynak) VALUES (:c, :d, :v, :v, :v, :v, 'era5_land', 'era5_land')"), rows)
        service = WaterService(session, uuid.uuid4())
        summer = (await service.climatology(cell, rule, date(2026, 8, 15)))[0]
        winter = (await service.climatology(cell, rule, date(2026, 1, 15)))[0]
        year = (await session.execute(text("SELECT percentile_cont(0.02) WITHIN GROUP (ORDER BY sm0), percentile_cont(0.98) WITHIN GROUP (ORDER BY sm0) FROM era5_daily WHERE cell_id = :c"), {"c": cell})).one()
        await session.execute(text("DELETE FROM era5_daily WHERE cell_id = :c"), {"c": cell})  # kalıcı test veritabanını kirletme
        await session.commit()
    assert summer.p_ust < 0.19 and winter.p_alt > 0.38  # pencere yalnız ±15 gün: ağustos bandı kuru, ocak bandı ıslak
    assert 0 < (wb.normalized_fill(0.16, summer) or 0) < 100  # yazın 0,16 normal aralıkta
    assert wb.normalized_fill(0.16, winter) == 0.0  # aynı değer kışın normalin çok altı
    assert wb.normalized_fill(0.16, wb.Climatology(float(year[0]), float(year[1]), 0, 0)) < 15  # yıl geneliyle bakınca yazın normal nem bile «kuru» görünürdü (eski hata)


async def test_hava_and_su_endpoints_return_the_same_irrigation_decision(user_client, factory):
    gid = await seed(user_client, factory)
    su = (await user_client.get(f"/gardens/{gid}/su")).json()
    hava = (await user_client.get(f"/gardens/{gid}/sulama")).json()
    assert hava["karar_kaynagi"] == "su" and hava["gerekli"] == su["karar_detay"]["gerekli"]
    assert su["karar"].split(" Kök bölgesini doldurmak")[0] == su["karar_detay"]["cumle"]
    assert hava["cumle"].startswith(su["karar_detay"]["cumle"])  # aynı cümle; yalnız gerekliyse miktar eklenir
    assert (hava["ihtiyac_mm"] or 0) > 0 if su["karar_detay"]["gerekli"] else not hava["ihtiyac_mm"]
