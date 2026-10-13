"""Durum (v2) uç noktası: bahçenin kendi dönem normu, risk tavanı, tek kademe (liste = Durum sekmesi) ve sayısız yanıt (ADR 0018)."""

import uuid
from datetime import timedelta
from zoneinfo import ZoneInfo

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from bahcelab_backend.api.deps import get_weather_provider
from bahcelab_backend.domain.acquisitions.models import AcquisitionModel
from bahcelab_backend.domain.acquisitions.processor import FORMULA_VERSION as S2_FORMULA
from bahcelab_backend.domain.acquisitions.processor import SOURCE_ID
from bahcelab_backend.domain.acquisitions.repository import AcquisitionRepository
from bahcelab_backend.domain.acquisitions.store import PixelStats

from .conftest import register
from .test_agro_api import istanbul_today, new_garden
from .test_weather_api import (  # noqa: F401  (autouse hava hücresi temizliği)
    FakeProvider,
    clean_cells,
)


@pytest.fixture
def factory(test_engine):
    return async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture
def provider(app):
    fake = FakeProvider()
    app.dependency_overrides[get_weather_provider] = lambda: fake
    return fake


@pytest.fixture
async def user_client(client: AsyncClient, cleanup_users):
    await register(client)
    return client


def stats(value: float) -> PixelStats:
    return PixelStats(value, value, value - 0.02, value - 0.01, value + 0.01, value + 0.02, value - 0.05, value + 0.05, 20)


async def add_acquisition(factory, gid: str, day, ndvi: float, ndmi: float, ndre: float) -> None:  # noqa: ANN001
    async with factory() as session:
        repo = AcquisitionRepository(session)
        row = AcquisitionModel(garden_id=uuid.UUID(gid), source_id=SOURCE_ID, scene_id=f"S2_{day}", tarih=day, bulut_orani=1.0, durum="net", gecerli_oran=1.0, formul_surumu=S2_FORMULA, isleme_surumu="t")
        await repo.upsert_acquisition(row, {"ndvi": stats(ndvi), "ndmi": stats(ndmi), "ndre": stats(ndre)})
        await session.commit()


async def seed_history(factory, gid: str, last_ndvi: float = 0.705) -> None:  # noqa: ANN001
    """Diğer 9 yılda AYNI ayda 2'şer sahne (bahçenin kendi dönem normu) + son sahne 2 gün önce."""
    today = istanbul_today()
    for k in range(1, 10):
        for off, bump in ((0, 0.0), (6, 0.01)):
            day = (today - timedelta(days=off)).replace(year=today.year - k, day=min((today - timedelta(days=off)).day, 28))
            await add_acquisition(factory, gid, day, 0.69 + bump + 0.002 * k, 0.22 + bump / 2, 0.30 + bump / 2)
    await add_acquisition(factory, gid, today - timedelta(days=2), last_ndvi, 0.22, 0.30)


async def no_risks(monkeypatch) -> None:  # noqa: ANN001
    from bahcelab_backend.domain.agro.service import AgroService

    async def empty(self, garden_row, history, weather, today):  # noqa: ANN001, ANN202
        return []

    monkeypatch.setattr(AgroService, "_compute_risks", empty)


async def test_status_without_images_has_no_tier_and_no_numbers(user_client, provider, monkeypatch):
    await no_risks(monkeypatch)
    garden = await new_garden(user_client)
    data = (await user_client.get(f"/gardens/{garden['id']}/durum")).json()
    assert data["durum"] == "veri_yok" and [c["kod"] for c in data["bilesenler"]] == ["agac_gucu", "su", "beslenme", "ani_degisim", "isi"]
    assert not any(c["kullanilabilir"] for c in data["bilesenler"] if c["kod"] in ("agac_gucu", "beslenme", "isi")) and data["guven"] == "dusuk"
    assert "skor" not in data and "ic_puan" not in data and all("puan" not in c for c in data["bilesenler"]) and len(data["nasil"]) <= 3


async def test_status_scores_against_the_gardens_own_same_month_history(user_client, factory, provider, monkeypatch):
    await no_risks(monkeypatch)
    garden = await new_garden(user_client)
    await seed_history(factory, garden["id"])
    data = (await user_client.get(f"/gardens/{garden['id']}/durum")).json()
    assert data["durum"] == "iyi" and data["etiket"] == "İyi" and data["riskler"] == [] and data["esik_durumu"] == "ön değer · v2"
    by = {c["kod"]: c for c in data["bilesenler"]}
    assert by["agac_gucu"]["seviye"] == "normal" and by["beslenme"]["seviye"] == "normal" and by["agac_gucu"]["veri_tarihi"] == (istanbul_today() - timedelta(days=2)).isoformat()
    assert not by["isi"]["kullanilabilir"] and data["guven"] in ("orta", "yuksek")  # Landsat yok: ağırlık dağıtıldı, güven iyi değil
    assert "skor" not in data and "/100" not in str(data)


async def test_a_sudden_fall_below_the_months_band_lowers_the_tier_and_names_tree_vigour(user_client, factory, provider, monkeypatch):
    await no_risks(monkeypatch)
    garden = await new_garden(user_client)
    await seed_history(factory, garden["id"], last_ndvi=0.40)
    data = (await user_client.get(f"/gardens/{garden['id']}/durum")).json()
    by = {c["kod"]: c for c in data["bilesenler"]}
    assert data["durum"] in ("izle", "dikkat", "sorun") and by["agac_gucu"]["seviye"] == "belirgin_dusuk" and data["dusuren"][0] == "agac_gucu" and "Ağaç gücü" in data["nasil"][0]


async def test_medium_risk_caps_the_tier_at_izle_and_high_risk_at_dikkat(user_client, factory, provider, monkeypatch):
    from bahcelab_backend.domain.agro.risks import RiskSonucu
    from bahcelab_backend.domain.agro.service import AgroService

    garden = await new_garden(user_client)
    await seed_history(factory, garden["id"])

    def risk(level: str):  # noqa: ANN202
        async def fake(self, garden_row, history, weather, today):  # noqa: ANN001, ANN202
            return [(RiskSonucu("akdeniz_meyve_sinegi", "Meyve sineği", level, "gerekçe", today, today + timedelta(days=7), True), None, None)]  # type: ignore[arg-type]

        return fake

    monkeypatch.setattr(AgroService, "_compute_risks", risk("orta"))
    medium = (await user_client.get(f"/gardens/{garden['id']}/durum")).json()
    assert medium["durum"] == "izle" and medium["risk_sinirladi"] and medium["riskler"] == ["Meyve sineği · orta"]
    monkeypatch.setattr(AgroService, "_compute_risks", risk("yuksek"))
    high = (await user_client.get(f"/gardens/{garden['id']}/durum")).json()
    assert high["durum"] == "dikkat" and high["riskler"] == ["Meyve sineği · yüksek"]


async def test_list_and_status_endpoint_show_the_same_single_tier(user_client, factory, provider, monkeypatch):
    await no_risks(monkeypatch)
    garden = await new_garden(user_client)
    await seed_history(factory, garden["id"], last_ndvi=0.40)
    before = (await user_client.get("/gardens/overview")).json()["bahceler"][0]["durum"]
    assert before == "veri_yok"  # kademe henüz hesaplanmadı: liste uydurmaz
    status = (await user_client.get(f"/gardens/{garden['id']}/durum")).json()
    item = (await user_client.get("/gardens/overview")).json()["bahceler"][0]
    assert item["durum"] == status["durum"] != "veri_yok" and "skor" not in item  # Durum sekmesi hesaplar ve kaydeder: liste aynısını gösterir
    assert ZoneInfo is not None
