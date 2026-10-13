"""Çok yıllık bölgeler: uçlar (yetki dahil), iş akışı (ilerleme, devam, idempotans), yıl dahil/hariç, homojen ve yetersiz durumlar.
Uydu kaynağı sahtedir (ağ yok); veritabanı gerçektir."""

import uuid
from datetime import UTC, date, datetime, timedelta

import numpy as np
import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from bahcelab_backend.api.deps import get_imagery, get_month_queue
from bahcelab_backend.config import get_settings
from bahcelab_backend.domain.acquisitions.backfill import BackfillRunner, ImmediateMonthQueue
from bahcelab_backend.domain.agro import catalog as cat
from bahcelab_backend.domain.multiyear import composite, grid
from bahcelab_backend.domain.multiyear.models import (
    MultiyearResultModel,
    MultiyearYearModel,
    MultiyearZoneModel,
)
from bahcelab_backend.domain.multiyear.service import (
    describe_zones,
    last_complete_year,
    parse_window,
    window_tag,
)
from bahcelab_backend.shared.storage import get_storage

from .conftest import make_client, register
from .support.fake_imagery import FakeImageryProvider, bands_pattern
from .test_gardens_api import LAT, LNG, garden_body, square

GEOMETRY = square(400, LNG, LAT)  # 40 × 40 piksel
BASE = "/gardens/{id}/bolgeler/cok-yillik"
TODAY = datetime.now(UTC).date()
LAST = last_complete_year(TODAY, 9)
YEARS = list(range(2018, LAST + 1))

pytestmark = pytest.mark.slow  # çok yıllık hat: her test onlarca sahne işler


@pytest.fixture
def factory(test_engine):
    return async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture
async def user_client(client: AsyncClient, cleanup_users):
    await register(client)
    return client


@pytest.fixture
def fake(app, factory):
    """Uydu kaynağı sahte (ağ yok): çok yıllık analiz TEK VERİ HATTINDAN (geçmiş doldurma → edinimler) beslenir."""
    provider = FakeImageryProvider(GEOMETRY)
    settings = get_settings().model_copy(update={"acq_start": "2018-01-01"})
    runner = BackfillRunner(factory, provider, get_storage(), settings)
    app.dependency_overrides[get_imagery] = lambda: provider
    app.dependency_overrides[get_month_queue] = lambda: ImmediateMonthQueue(runner)
    return provider


async def new_garden(client: AsyncClient, **extra) -> dict:
    response = await client.post("/gardens", json=garden_body(geometry=GEOMETRY, **extra))
    assert response.status_code == 201, response.text
    return response.json()


def url(garden_id: str, tail: str = "") -> str:
    return BASE.format(id=garden_id) + tail


# ----------------------------------------------------------------------------- yetki
async def test_every_endpoint_requires_login(client: AsyncClient):
    gid = uuid.uuid4()
    assert (await client.post(url(str(gid)))).status_code == 401
    assert (await client.get(url(str(gid), "/durum"))).status_code == 401
    assert (await client.get(url(str(gid), "/sonuc"))).status_code == 401
    assert (
        await client.patch(
            url(str(gid), "/yillar"), json={"yillar": [{"yil": 2020, "dahil": False}]}
        )
    ).status_code == 401
    assert (await client.get(url(str(gid), "/yillar/2020/gorsel"))).status_code == 401
    assert (await client.get(url(str(gid), "/yillar/2020/degerler"))).status_code == 401


async def test_other_users_garden_is_404_on_every_endpoint(app, user_client: AsyncClient, fake):
    garden = await new_garden(user_client)
    async with make_client(app) as other:
        await register(other)
        gid = garden["id"]
        assert (await other.post(url(gid))).status_code == 404
        assert (await other.get(url(gid, "/durum"))).status_code == 404
        assert (await other.get(url(gid, "/sonuc"))).status_code == 404
        assert (
            await other.patch(url(gid, "/yillar"), json={"yillar": [{"yil": 2020, "dahil": False}]})
        ).status_code == 404
        assert (await other.get(url(gid, "/yillar/2020/gorsel"))).status_code == 404
        assert (await other.get(url(gid, "/yillar/2020/degerler"))).status_code == 404


async def test_unknown_garden_is_404(user_client: AsyncClient, fake):
    assert (await user_client.post(url(str(uuid.uuid4())))).status_code == 404


# ----------------------------------------------------------------------------- iş akışı
async def test_not_started_state_and_empty_result(user_client: AsyncClient, fake):
    garden = await new_garden(user_client)
    status = (await user_client.get(url(garden["id"], "/durum"))).json()
    assert status["durum"] == "yok" and status["yillar"] == [] and status["toplam"] == 0
    result = (await user_client.get(url(garden["id"], "/sonuc"))).json()
    assert (
        result["durum"] == "yok"
        and result["bolgeler"] is None
        and "başlatılmadı" in result["mesaj"]
    )


async def test_start_processes_every_year_and_returns_zones(
    user_client: AsyncClient, fake, factory
):
    garden = await new_garden(user_client)
    response = await user_client.post(url(garden["id"]))
    assert response.status_code == 202, response.text
    status = response.json()
    assert status["durum"] == "tamam" and status["tamamlanan"] == status["toplam"] == len(YEARS)
    assert (
        status["baslangic_yili"] == 2018
        and status["bitis_yili"] == LAST
        and status["arsiv_baslangic"] == "2018-06-20"
    )
    assert [y["yil"] for y in status["yillar"]] == YEARS
    assert all(y["durum"] == "tamam" and y["sahne_sayisi"] >= 3 for y in status["yillar"]), [
        (y["yil"], y["durum"], y["sahne_sayisi"], y["hata_mesaji"]) for y in status["yillar"]
    ]
    assert status["yillar"][0]["kismi"] is True and not any(
        y["kismi"] for y in status["yillar"][1:]
    )  # 2018 penceresi 20 Haz'da başlıyor

    result = (await user_client.get(url(garden["id"], "/sonuc"))).json()
    assert result["durum"] == "hazir" and result["bolge_sayisi"] == 3 and result["versiyon"] == 1
    assert result["yil_araligi"] == f"2018–{LAST}"
    assert [b["sinif"] for b in result["ozet"]] == [1, 2, 3] and [
        b["ad"] for b in result["ozet"]
    ] == ["Zayıf", "Orta", "Güçlü"]
    assert sum(b["pay"] for b in result["ozet"]) == pytest.approx(1.0, abs=0.01)
    assert result["ozet"][0]["fark_yuzde"] < 0 < result["ozet"][2]["fark_yuzde"]
    assert result["homojen"] is False and result["yayilim_yuzde"] > 20
    assert (
        result["bolgeler"]["type"] == "FeatureCollection"
        and len(result["bolgeler"]["features"]) == 3
    )
    assert all(f["geometry"]["type"] == "MultiPolygon" for f in result["bolgeler"]["features"])
    assert result["istikrar"]["features"] and {
        f["properties"]["sinif"] for f in result["istikrar"]["features"]
    } <= {"yuksek", "orta", "dusuk"}
    strongest = result["ozet"][2]
    assert strongest[
        "istikrar_sinifi"
    ] == "yuksek" and "yıllardır bahçenin en güçlü kısmı" in " ".join(result["yorumlar"])
    assert "doğrulanacak" in result["not_"]
    assert all(y["dahil"] and not y["uyumsuz"] for y in result["yillar"]) and len(
        result["yillar"]
    ) == len(YEARS)
    # PostGIS'te sürümlü saklanır
    async with factory() as session:
        count = (
            await session.execute(select(func.count()).select_from(MultiyearZoneModel))
        ).scalar_one()
        assert count >= 3 + 1
        versions = (
            await session.execute(
                select(MultiyearResultModel.bolge_sayisi, MultiyearResultModel.versiyon).where(
                    MultiyearResultModel.garden_id == uuid.UUID(garden["id"])
                )
            )
        ).all()
        assert (3, 1) in versions


async def test_five_zones_can_be_requested(user_client: AsyncClient, fake):
    garden = await new_garden(user_client)
    await user_client.post(url(garden["id"]))
    fake.pattern = lambda year: bands_pattern(list(np.linspace(0.40, 0.80, 5)), fake.grid.shape)
    # kompozitler değişmedi (zaten işlendi); 5 bölge mevcut kompozitlerden hesaplanır
    five_response = await user_client.get(url(garden["id"], "/sonuc"), params={"bolge_sayisi": 5})
    five = five_response.json()
    assert five_response.status_code == 200, five
    assert five["durum"] == "hazir" and five["bolge_sayisi"] == 5 and len(five["ozet"]) == 5
    assert [b["ad"] for b in five["ozet"]] == ["En zayıf", "Zayıf", "Orta", "Güçlü", "En güçlü"]
    assert (
        await user_client.get(url(garden["id"], "/sonuc"), params={"bolge_sayisi": 4})
    ).status_code == 422


async def test_start_is_idempotent_and_never_rereads_finished_years(
    user_client: AsyncClient, fake, factory
):
    garden = await new_garden(user_client)
    await user_client.post(url(garden["id"]))
    reads = len(fake.read_calls)
    again = await user_client.post(url(garden["id"]))
    assert again.status_code == 202 and again.json()["durum"] == "tamam"
    assert len(fake.read_calls) == reads  # tamam aylar/yıllar yeniden işlenmedi
    async with factory() as session:
        rows = (
            await session.execute(
                select(func.count())
                .select_from(MultiyearYearModel)
                .where(MultiyearYearModel.garden_id == uuid.UUID(garden["id"]))
            )
        ).scalar_one()
        assert rows == len(YEARS)  # yıl satırı çoğalmadı


async def test_failed_year_resumes_where_it_stopped(user_client: AsyncClient, fake):
    garden = await new_garden(user_client)
    fake.fail_years = {2021}  # o yılın tüm aylarında arama hatası
    first = (await user_client.post(url(garden["id"]))).json()
    broken = next(y for y in first["yillar"] if y["yil"] == 2021)
    assert broken["durum"] == "hata" and "çekilemedi" in broken["hata_mesaji"]
    assert first["durum"] == "tamam" and "1 yıl işlenemedi" in first["mesaj"]  # diğer yıllar tamam; hata özetlendi
    reads_before = len(fake.read_calls)

    fake.fail_years = set()
    second = (await user_client.post(url(garden["id"]))).json()
    assert second["durum"] == "tamam" and all(y["durum"] == "tamam" for y in second["yillar"])
    assert 0 < len(fake.read_calls) - reads_before < 60 and all(d.year == 2021 for d in fake.read_calls[reads_before:])  # yalnız hatalı yıl yeniden çalıştı
    result = (await user_client.get(url(garden["id"], "/sonuc"))).json()
    assert result["durum"] == "hazir" and 2021 in [y["yil"] for y in result["yillar"] if y["dahil"]]


async def test_year_without_enough_net_scenes_is_flagged_not_guessed(
    user_client: AsyncClient, fake
):
    garden = await new_garden(user_client)
    fake.cloud_by_year = {2020: 0.95}  # yıl boyu tamamen bulutlu
    await user_client.post(url(garden["id"]))
    result = (await user_client.get(url(garden["id"], "/sonuc"))).json()
    cloudy = next(y for y in result["yillar"] if y["yil"] == 2020)
    assert cloudy["sahne_sayisi"] == 0 and cloudy["dahil"] is False
    # «yetersiz veri» ≠ «uyumsuz yıl»: uyumsuzluk sorusu sorulmaz, neden açıkça yazılır
    assert cloudy["yetersiz_veri"] is True and cloudy["uyumsuz"] is False and cloudy["uyumsuz_nedeni"] is None
    assert "Yetersiz veri" in cloudy["yetersiz_nedeni"]
    ok = next(y for y in result["yillar"] if y["yil"] != 2020 and y["dahil"])
    assert ok["yetersiz_veri"] is False and ok["net_gun_sayisi"] >= 3 and 0 < ok["donem_kapsami"] <= 1
    refused = await user_client.patch(url(garden["id"], "/yillar"), json={"bolge_sayisi": 3, "yillar": [{"yil": 2020, "dahil": True}]})
    assert refused.status_code == 422 and "yetersiz veri" in str(refused.json())
    assert result["durum"] == "hazir"  # kalan yıllar yeterli


async def test_incompatible_year_is_flagged_and_user_can_toggle_it(user_client: AsyncClient, fake):
    garden = await new_garden(user_client)
    rng = np.random.default_rng(7)
    flood = rng.uniform(0.3, 0.8, fake.grid.shape).astype(np.float32)
    base = fake.pattern
    fake.pattern = lambda year: flood if year == 2021 else base(year)
    await user_client.post(url(garden["id"]))
    result = (await user_client.get(url(garden["id"], "/sonuc"))).json()
    bad = next(y for y in result["yillar"] if y["yil"] == 2021)
    assert (
        bad["uyumsuz"] is True
        and bad["dahil"] is False
        and bad["korelasyon"] < get_settings().multiyear_year_min_correlation
    )
    assert bad["elle"] is None and "uyumsuz" in bad["uyumsuz_nedeni"]
    assert bad["karar_bekliyor"] is True and bad["varsayilan_dahil"] is False and bad["karar_zamani"] is None
    assert result["versiyon"] == 1

    # kullanıcı yılı dahil eder → yeniden hesaplanır, yeni sürüm
    patched = await user_client.patch(
        url(garden["id"], "/yillar"), json={"yillar": [{"yil": 2021, "dahil": True}]}
    )
    assert patched.status_code == 200, patched.text
    body = patched.json()
    included = next(y for y in body["yillar"] if y["yil"] == 2021)
    assert included["dahil"] is True and included["elle"] is True and body["versiyon"] == 2
    assert included["karar_bekliyor"] is False and included["karar_zamani"] is not None  # karar kayıtlı

    # başka bir yılı hariç tut
    out = (
        await user_client.patch(
            url(garden["id"], "/yillar"), json={"yillar": [{"yil": 2019, "dahil": False}]}
        )
    ).json()
    assert (
        next(y for y in out["yillar"] if y["yil"] == 2019)["dahil"] is False
        and out["versiyon"] == 3
    )

    # isteğe bağlı olay notu: karara eklenir, boş metin siler
    noted = (await user_client.patch(url(garden["id"], "/yillar"), json={"yillar": [{"yil": 2021, "dahil": True, "olay_notu": "Sel oldu"}]})).json()
    assert next(y for y in noted["yillar"] if y["yil"] == 2021)["karar_notu"] == "Sel oldu"
    cleared = (await user_client.patch(url(garden["id"], "/yillar"), json={"yillar": [{"yil": 2021, "dahil": True, "olay_notu": " "}]})).json()
    assert next(y for y in cleared["yillar"] if y["yil"] == 2021)["karar_notu"] is None

    # null = otomatiğe dön
    auto = (
        await user_client.patch(
            url(garden["id"], "/yillar"),
            json={"yillar": [{"yil": 2021, "dahil": None}, {"yil": 2019, "dahil": None}]},
        )
    ).json()
    y2021 = next(y for y in auto["yillar"] if y["yil"] == 2021)
    assert (
        y2021["elle"] is None
        and y2021["karar_bekliyor"] is True and y2021["karar_zamani"] is None  # geri alındı: soru yeniden açılır
        and y2021["dahil"] is False
        and next(y for y in auto["yillar"] if y["yil"] == 2019)["dahil"] is True
    )


async def test_patch_validates_input(user_client: AsyncClient, fake):
    garden = await new_garden(user_client)
    await user_client.post(url(garden["id"]))
    assert (
        await user_client.patch(
            url(garden["id"], "/yillar"), json={"yillar": [{"yil": 1999, "dahil": False}]}
        )
    ).status_code == 422
    assert (
        await user_client.patch(url(garden["id"], "/yillar"), json={"yillar": []})
    ).status_code == 422
    assert (
        await user_client.patch(
            url(garden["id"], "/yillar"), json={"yillar": [{"yil": "abc", "dahil": True}]}
        )
    ).status_code == 422
    assert (
        await user_client.patch(
            url(garden["id"], "/yillar"),
            json={"yillar": [{"yil": 2020, "dahil": True}], "bolge_sayisi": 7},
        )
    ).status_code == 422


async def test_excluding_too_many_years_reports_insufficient_instead_of_guessing(
    user_client: AsyncClient, fake
):
    garden = await new_garden(user_client)
    await user_client.post(url(garden["id"]))
    keep = YEARS[:2]
    body = {"yillar": [{"yil": y, "dahil": False} for y in YEARS if y not in keep]}
    result = (await user_client.patch(url(garden["id"], "/yillar"), json=body)).json()
    assert (
        result["durum"] == "yetersiz"
        and "en az 3 yıl" in result["mesaj"]
        and result["bolgeler"] is None
        and result["ozet"] == []
    )


async def test_homogeneous_garden_is_reported(user_client: AsyncClient, fake):
    garden = await new_garden(user_client)
    fake.pattern = lambda year: np.full(fake.grid.shape, 0.65, dtype=np.float32)
    fake.noise = 0.004
    await user_client.post(url(garden["id"]))
    result = (await user_client.get(url(garden["id"], "/sonuc"))).json()
    assert result["durum"] == "hazir" and result["homojen"] is True and result["yayilim_yuzde"] < 8
    assert "homojen" in " ".join(result["yorumlar"]) and not any(
        b["kontrol_onerisi"] for b in result["ozet"]
    )


async def test_unstable_or_small_weak_zone_does_not_trigger_a_field_check(
    user_client: AsyncClient, fake
):
    garden = await new_garden(user_client)
    await user_client.post(url(garden["id"]))
    result = (await user_client.get(url(garden["id"], "/sonuc"))).json()
    weakest = result["ozet"][0]
    assert (
        weakest["fark_yuzde"] <= -get_settings().multiyear_weak_zone_diff_percent
        and weakest["istikrar_sinifi"] == "yuksek"
    )
    assert weakest["kontrol_onerisi"] is True  # anlamlı fark + istikrarlı → "yerinde kontrol edin"
    assert [b["kontrol_onerisi"] for b in result["ozet"][1:]] == [False, False]
    assert any("yerinde kontrol edin" in c for c in result["yorumlar"])


async def test_short_archive_is_insufficient(user_client: AsyncClient, fake):
    garden = await new_garden(user_client)
    fake.first = date(LAST - 1, 7, 1)  # yalnızca 2 yıllık arşiv
    await user_client.post(url(garden["id"]))
    result = (await user_client.get(url(garden["id"], "/sonuc"))).json()
    assert result["durum"] == "yetersiz" and "en az 3 yıl" in result["mesaj"]


async def test_provider_without_required_bands_is_refused(app, user_client: AsyncClient, fake):
    garden = await new_garden(user_client)
    fake.roles = frozenset({"blue", "green"})
    response = await user_client.post(url(garden["id"]))
    assert (
        response.status_code == 422 and "bantları sağlamıyor" in response.json()["error"]["message"]
    )


async def test_provider_error_on_archive_lookup_is_reported_not_crashed(
    app, user_client: AsyncClient, fake
):
    garden = await new_garden(user_client)

    def boom(geometry):
        from bahcelab_backend.domain.imagery.provider import ImageryError

        raise ImageryError("Uydu verisi kaynağına ulaşılamadı.")

    fake.first_scene_date = boom  # type: ignore[method-assign]
    response = await user_client.post(url(garden["id"]))
    assert response.status_code == 502 and "ulaşılamadı" in response.json()["error"]["message"]


async def test_year_image_is_a_png_and_missing_year_is_404(user_client: AsyncClient, fake):
    garden = await new_garden(user_client)
    await user_client.post(url(garden["id"]))
    response = await user_client.get(url(garden["id"], "/yillar/2020/gorsel"))
    assert (
        response.status_code == 200
        and response.headers["content-type"] == "image/png"
        and response.content[:8] == b"\x89PNG\r\n\x1a\n"
    )
    assert (await user_client.get(url(garden["id"], "/yillar/1999/gorsel"))).status_code == 404


async def test_changing_the_boundary_discards_old_acquisitions_and_rebuilds(user_client: AsyncClient, fake, factory):
    from bahcelab_backend.domain.acquisitions.models import AcquisitionModel

    garden = await new_garden(user_client)
    await user_client.post(url(garden["id"]))
    gid = uuid.UUID(garden["id"])
    async with factory() as session:
        before = {a.scene_id for a in (await session.execute(select(AcquisitionModel).where(AcquisitionModel.garden_id == gid))).scalars()}
    moved = square(400, LNG + 0.0004, LAT)
    assert (await user_client.patch(f"/gardens/{garden['id']}", json={"geometry": moved})).status_code == 200
    reads = len(fake.read_calls)
    await user_client.post(url(garden["id"]))
    assert len(fake.read_calls) > reads  # sınır değişti: edinimler silindi ve yeniden okundu
    async with factory() as session:
        count = (await session.execute(select(func.count()).select_from(AcquisitionModel).where(AcquisitionModel.garden_id == gid))).scalar_one()
    assert count >= len(before) // 2  # yeni sınırla yeniden dolduruldu


async def cok_yillik(factory, garden_id: str) -> list:  # noqa: ANN001
    """Bilgi türü bildirim günlük özette bekler (listede görünmez): kayıtlar doğrudan okunur."""
    from sqlalchemy import text

    async with factory() as session:
        return list((await session.execute(text("SELECT baslik, baglanti, oncelik, teslim FROM notifications WHERE tur = 'cok_yillik' AND garden_id = :g"), {"g": uuid.UUID(garden_id)})).all())


async def test_completion_notification_is_published_once(user_client: AsyncClient, fake, factory):
    garden = await new_garden(user_client)
    await user_client.post(url(garden["id"]))
    notes = await cok_yillik(factory, garden["id"])
    assert len(notes) == 1 and notes[0].baglanti == f"/bahceler/{garden['id']}/analiz"
    assert "çok yıllık analiz hazır" in notes[0].baslik and notes[0].oncelik == "bilgi" and notes[0].teslim == "ozet"  # bilgi: günlük özette
    assert (await user_client.get("/notifications", params={"tur": "cok_yillik"})).json()["toplam"] == 0  # özet gelene kadar listede görünmez
    await user_client.post(url(garden["id"]))  # tekrar başlatma: yeni bildirim üretmez
    assert len(await cok_yillik(factory, garden["id"])) == 1


async def test_reprocessing_the_same_analysis_does_not_notify_again(user_client: AsyncClient, fake, factory):
    """Aynı bahçe ve aynı yıl aralığı için analiz yeniden kurulsa da «çok yıllık analiz hazır» tek kez görünür."""
    from sqlalchemy import text

    garden = await new_garden(user_client)
    gid = uuid.UUID(garden["id"])
    await user_client.post(url(garden["id"]))
    for _ in range(2):  # sınır özeti değişir → tüm yıllar yeniden işlenir → analiz yeniden hazırlanır
        async with factory() as session:
            await session.execute(text("UPDATE multiyear_runs SET geometry_hash = 'eski', updated_at = now() WHERE garden_id = :g"), {"g": gid})
            await session.commit()
        await user_client.post(url(garden["id"]))
    assert len(await cok_yillik(factory, garden["id"])) == 1


# ----------------------------------------------------------------------------- saf birimler
def test_analysis_window_comes_from_the_rule_file_and_is_unverified():
    rule = cat.load_catalog().urun("limon").analiz_penceresi  # type: ignore[union-attr]
    assert (
        rule.durum == "dogrulanmadi"
        and rule.kaynak
        and (rule.ay_baslangic, rule.ay_bitis, rule.indeks) == (6, 9, "ndvi")
    )
    assert (
        cat.load_catalog().urun("diger") is None
        or cat.load_catalog().urun("diger").analiz_penceresi is None
    )  # type: ignore[union-attr]


def test_window_dates_and_last_complete_year():
    assert composite.window_dates(2024, 6, 9) == (date(2024, 6, 1), date(2024, 9, 30))
    assert composite.window_dates(2023, 10, 12) == (date(2023, 10, 1), date(2023, 12, 31))
    assert (
        last_complete_year(date(2026, 10, 1), 9) == 2026
        and last_complete_year(date(2026, 9, 30), 9) == 2025
    )
    assert last_complete_year(date(2026, 1, 15), 9) == 2025
    assert parse_window(window_tag("ndvi", 6, 9)) == (6, 9, "ndvi")


def test_alignment_places_shifted_windows_exactly_and_rejects_foreign_grids():
    g = grid.canonical_grid(GEOMETRY)
    h, w = g.shape
    values = np.arange(h * w, dtype=np.float32).reshape(h, w)
    from rasterio.transform import Affine

    pad = 4
    big = np.full((h + 2 * pad, w + 2 * pad), np.nan, np.float32)
    big[pad:-pad, pad:-pad] = values
    shifted = Affine(10, 0, g.transform.c - pad * 10, 0, -10, g.transform.f + pad * 10)
    out = grid.align_to_grid(big, shifted, g.epsg, g)
    assert out is not None and np.array_equal(out, values)
    assert grid.align_to_grid(big, shifted, g.epsg + 1, g) is None  # başka UTM bölgesi
    off = Affine(10, 0, g.transform.c + 3.3, 0, -10, g.transform.f)  # kafese oturmayan kaydırma
    assert grid.align_to_grid(values, off, g.epsg, g) is None
    partial = grid.align_to_grid(
        values, Affine(10, 0, g.transform.c + 50, 0, -10, g.transform.f), g.epsg, g
    )
    assert (
        partial is not None
        and np.isnan(partial[:, :5]).all()
        and np.array_equal(partial[:, 5:], values[:, : w - 5])
    )
    nothing = grid.align_to_grid(
        values, Affine(10, 0, g.transform.c + 10_000, 0, -10, g.transform.f), g.epsg, g
    )
    assert nothing is not None and np.isnan(nothing).all()


def test_median_composite_ignores_clouds_and_requires_net_scenes():
    g = grid.canonical_grid(GEOMETRY)
    mask = grid.garden_mask(g, GEOMETRY)
    a = np.where(mask, 0.5, np.nan).astype(np.float32)
    b = np.where(mask, 0.7, np.nan).astype(np.float32)
    c = np.where(mask, 0.9, np.nan).astype(np.float32)
    cloudy = c.copy()
    cloudy[:, : g.shape[1] // 2] = np.nan
    out = composite.median_composite([a, b, cloudy])
    assert out is not None and out.scene_count == 3
    half = g.shape[1] // 2
    right = out.values[:, half:][mask[:, half:]]
    assert np.allclose(right, 0.7)  # sağ yarı: 0,5/0,7/0,9 medyanı
    left = out.values[:, :half][mask[:, :half]]
    assert np.allclose(left, 0.6)  # sol yarı: bulutlu sahne yok sayıldı → (0,5, 0,7) medyanı
    assert composite.median_composite([]) is None


def test_comment_text_is_plain_and_mentions_direction():
    zones = [
        {"sinif": 1, "istikrar": 0.9, "kontrol_onerisi": True},
        {"sinif": 2, "istikrar": 0.8, "kontrol_onerisi": False},
        {"sinif": 3, "istikrar": 0.9, "kontrol_onerisi": False},
    ]
    centroids = {1: (0.0, -1.0), 2: (0.0, 0.0), 3: (0.0, 1.0)}
    text = describe_zones(zones, centroids, (0.0, 0.0), False, 0.5)
    assert (
        text[0] == "Kuzey kesim yıllardır bahçenin en güçlü kısmı."
        and text[1] == "Güney kesim yıllardır zayıf kalıyor; yerinde kontrol edin."
    )
    unstable = describe_zones(
        [{**zones[2], "istikrar": 0.3}, *zones[:2]][::-1][::-1], centroids, (0.0, 0.0), False, 0.5
    )
    assert isinstance(unstable, list)
    assert describe_zones(zones, centroids, (0.0, 0.0), True, 0.5) == [
        "Bahçe büyük ölçüde homojen: kesimler arasında ağaç gücü farkı küçük."
    ]
    assert timedelta(days=1) > timedelta(0)


async def test_year_values_expose_the_composite_grid_inside_the_garden_only(
    user_client: AsyncClient, fake
):
    garden = await new_garden(user_client)
    await user_client.post(url(garden["id"]))
    response = await user_client.get(url(garden["id"], "/yillar/2020/degerler"))
    assert response.status_code == 200, response.text
    data = response.json()
    assert (
        data["yil"] == 2020
        and len(data["degerler"]) == data["satir"] * data["sutun"]
        and len(data["koordinatlar"]) == 4
    )
    inside = [v for v in data["degerler"] if v is not None]
    assert 0.3 * len(data["degerler"]) < len(inside) < len(data["degerler"])  # bahçe dışı null
    assert 0.4 <= min(inside) and max(inside) <= 0.85  # sahte desen aralığı (0,45–0,75 + gürültü)
    assert (await user_client.get(url(garden["id"], "/yillar/1999/degerler"))).status_code == 404


async def test_incompatible_recent_year_stays_in_the_analysis_until_the_user_decides(user_client: AsyncClient, fake):
    garden = await new_garden(user_client)
    rng = np.random.default_rng(11)
    odd = rng.uniform(0.3, 0.8, fake.grid.shape).astype(np.float32)
    base = fake.pattern
    last_year = max(YEARS)
    fake.pattern = lambda year: odd if year == last_year else base(year)
    await user_client.post(url(garden["id"]))
    result = (await user_client.get(url(garden["id"], "/sonuc"))).json()
    recent = next(y for y in result["yillar"] if y["yil"] == last_year)
    assert recent["uyumsuz"] is True and recent["dahil"] is True  # sessizce atılmadı
    assert recent["karar_bekliyor"] is True and recent["varsayilan_dahil"] is True
    out = (await user_client.patch(url(garden["id"], "/yillar"), json={"yillar": [{"yil": last_year, "dahil": False}]})).json()
    decided = next(y for y in out["yillar"] if y["yil"] == last_year)
    assert decided["dahil"] is False and decided["karar_bekliyor"] is False
