"""Olay ön doğrulaması (ADR 0021): istasyon eşitleme (yalnız gözlem satırı yazılır), kart rozeti, «doğrulanacak» süzgeci, iki ayrı doğruluk sayısı. Gerçek tablolar, ağsız."""

import uuid
from datetime import date, timedelta

import pytest
from sqlalchemy import delete, func, select

from bahcelab_backend.domain.evidence.models import StationDailyModel, StationModel
from bahcelab_backend.domain.evidence.service import sync_stations
from bahcelab_backend.domain.evidence.types import Station, StationDay

from .test_events_service import (  # noqa: F401, F811
    GEOMETRY,
    TODAY,
    factory,
    seed,
    user_client,
)
from .test_fieldbook_api import add_event

LAT, LNG = GEOMETRY["coordinates"][0][0][1], GEOMETRY["coordinates"][0][0][0]


@pytest.fixture(autouse=True)
async def clean_stations(factory):  # noqa: ANN001, ANN201, F811
    """İstasyon tabloları genel (bahçeye bağlı değil): her test temiz başlar ve temiz bırakır."""

    async def wipe() -> None:
        async with factory() as session:
            await session.execute(delete(StationDailyModel))
            await session.execute(delete(StationModel))
            await session.commit()

    await wipe()
    yield
    await wipe()


class FakeStations:
    """Test sağlayıcısı: gerçek Meteostat biçiminde, gözlem + model satırları döner (ürün kodunda yok)."""

    name = "meteostat"

    def __init__(self, rows: dict[date, tuple[float | None, float | None, str]]) -> None:
        self.rows = rows
        self.station = Station("T1", "Test istasyonu", LAT + 0.1, LNG + 0.1, 5.0, None, None, 12.0, "meteostat")

    async def nearest(self, lat, lng, *, max_km, limit):  # noqa: ANN001, ANN201
        return [self.station]

    async def daily(self, station, start, end):  # noqa: ANN001, ANN201
        return [StationDay(station.id, d, t, p, k) for d, (t, p, k) in self.rows.items() if start <= d <= end]  # type: ignore[arg-type]


async def cards_of(client, gid):  # noqa: ANN001, ANN201
    return (await client.get(f"/gardens/{gid}/dogrulama")).json()


async def test_sync_writes_only_observed_rows_and_is_idempotent(user_client, factory):  # noqa: F811
    await seed(user_client, factory)
    d = TODAY - timedelta(days=30)
    fake = FakeStations({d: (-2.0, 0.0, "gozlem"), d + timedelta(days=1): (-9.0, 0.0, "model"), d + timedelta(days=2): (None, None, "gozlem")})
    first = await sync_stations(factory, fake, TODAY)
    again = await sync_stations(factory, fake, TODAY)
    async with factory() as session:
        stored = (await session.execute(select(StationDailyModel).where(StationDailyModel.istasyon_id == "T1"))).scalars().all()
        total = (await session.execute(select(func.count()).select_from(StationDailyModel).where(StationDailyModel.istasyon_id == "T1"))).scalar_one()
    assert first == again and [r.tarih for r in stored] == [d] and total == 1  # model ve boş satır yazılmadı; tekrar çalıştırma aynı sonuç


async def test_cards_carry_prior_and_review_list_keeps_only_contradicting_and_no_evidence(user_client, factory):  # noqa: F811
    gid = await seed(user_client, factory)
    frost, warm, none = TODAY - timedelta(days=40), TODAY - timedelta(days=30), TODAY - timedelta(days=20)
    await sync_stations(factory, FakeStations({frost: (-3.0, 0.0, "gozlem"), warm: (12.0, 0.0, "gozlem")}), TODAY)
    for day in (frost, warm, none):
        await add_event(factory, gid, f"don:{day}", "don", day)
    body = await cards_of(user_client, gid)
    by_day = {c["baslangic"]: c["on_yargi"] for c in body["kartlar"]}
    assert by_day[str(frost)]["sonuc"] == "destekleniyor" and by_day[str(frost)]["kanitlar"][0]["baglanti"].startswith("https://meteostat.net/")
    assert by_day[str(warm)]["sonuc"] == "celisiyor" and by_day[str(none)]["sonuc"] == "kanit_yok"
    assert body["bekleyen"] == 3 and body["dogrulanacak"] == 2  # destekli olay üreticinin listesine düşmez


async def test_producer_answer_is_kept_next_to_prior_and_answered_cards_leave_the_review_count(user_client, factory):  # noqa: F811
    gid = await seed(user_client, factory)
    day = TODAY - timedelta(days=15)
    await add_event(factory, gid, f"don:{day}", "don", day)
    assert (await cards_of(user_client, gid))["dogrulanacak"] == 1  # veri yok → kanıt yok → bakılmalı
    answered = (await user_client.put(f"/gardens/{gid}/dogrulama", json={"hedef_tur": "olay", "hedef_anahtar": f"don:{day}", "sonuc": "gerceklesti"})).json()
    assert answered["sonuc"] == "gerceklesti" and answered["on_yargi"]["sonuc"] == "kanit_yok"  # üretici yargısı ön yargının yerine geçmez
    assert (await cards_of(user_client, gid))["dogrulanacak"] == 0


async def test_accuracy_reports_producer_verification_and_external_support_as_two_separate_numbers(user_client, factory):  # noqa: F811
    gid = await seed(user_client, factory)
    days = [TODAY - timedelta(days=10 * i) for i in range(2, 6)]
    await sync_stations(factory, FakeStations({days[0]: (-4.0, 0.0, "gozlem"), days[1]: (15.0, 0.0, "gozlem")}), TODAY)
    for d in days:
        await add_event(factory, gid, f"don:{d}", "don", d)
    await user_client.put(f"/gardens/{gid}/dogrulama", json={"hedef_tur": "olay", "hedef_anahtar": f"don:{days[0]}", "sonuc": "gerceklesmedi"})
    don = next(t for t in (await user_client.get(f"/gardens/{gid}/dogruluk-ozeti")).json()["turler"] if t["tur"] == "don")
    assert don["dogrulanan"] == 1 and don["gerceklesmedi"] == 1  # üretici sayısı
    assert (don["dis_destekleniyor"], don["dis_celisiyor"], don["dis_kanit_yok"]) == (1, 1, 2) and don["dis_metin"].startswith("dış kaynak:")  # ikinci, ayrı sayı


async def test_resync_removes_days_that_the_source_no_longer_reports_as_observed(user_client, factory):  # noqa: F811
    await seed(user_client, factory)
    d = TODAY - timedelta(days=40)
    await sync_stations(factory, FakeStations({d: (1.0, 0.0, "gozlem"), d + timedelta(days=1): (-8.0, 0.0, "gozlem")}), TODAY)
    await sync_stations(factory, FakeStations({d: (1.0, 0.0, "gozlem"), d + timedelta(days=1): (-8.0, 0.0, "model")}), TODAY)  # kaynak ikinci günü model olarak düzeltti
    async with factory() as session:
        left = (await session.execute(select(StationDailyModel.tarih).where(StationDailyModel.istasyon_id == "T1"))).scalars().all()
    assert left == [d]


async def test_uncertain_and_no_evidence_are_listed_apart_and_the_review_list_orders_contradicting_first(user_client, factory):  # noqa: F811
    gid = await seed(user_client, factory)
    days = [TODAY - timedelta(days=10 * i) for i in range(2, 6)]
    await sync_stations(factory, FakeStations({days[0]: (2.5, 0.0, "gozlem"), days[1]: (-4.0, 0.0, "gozlem"), days[2]: (15.0, 0.0, "gozlem")}), TODAY)
    for d in days:  # [belirsiz, destek, çelişki, veri yok]
        await add_event(factory, gid, f"don:{d}", "don", d)
    body = await cards_of(user_client, gid)
    by = {c["baslangic"]: c["on_yargi"] for c in body["kartlar"]}
    assert [by[str(d)]["sonuc"] for d in days] == ["belirsiz", "destekleniyor", "celisiyor", "kanit_yok"]
    assert "2,5 °C" in by[str(days[0])]["kanitlar"][0]["metin"] and "rakım" in by[str(days[0])]["kanitlar"][0]["metin"]
    assert body["dogrulanacak"] == 3
    don = next(t for t in (await user_client.get(f"/gardens/{gid}/dogruluk-ozeti")).json()["turler"] if t["tur"] == "don")
    assert (don["dis_destekleniyor"], don["dis_celisiyor"], don["dis_belirsiz"], don["dis_kanit_yok"]) == (1, 1, 1, 1)


async def test_station_observation_range_is_derived_from_the_observed_days_not_from_a_stale_inventory(user_client, factory):  # noqa: F811
    await seed(user_client, factory)
    d = TODAY - timedelta(days=50)
    await sync_stations(factory, FakeStations({d: (1.0, 0.0, "gozlem"), d + timedelta(days=9): (2.0, 0.0, "gozlem"), d + timedelta(days=20): (9.0, 0.0, "model")}), TODAY)
    async with factory() as session:
        st = (await session.execute(select(StationModel).where(StationModel.id == "T1"))).scalar_one()
    assert (st.gozlem_baslangic, st.gozlem_bitis) == (d, d + timedelta(days=9))


async def test_garden_without_station_data_gets_no_evidence_for_every_event(user_client, factory):  # noqa: F811
    gid = uuid.UUID(str(await seed(user_client, factory)))
    day = TODAY - timedelta(days=12)
    await add_event(factory, gid, f"asiri_yagis:{day}", "asiri_yagis", day)
    card = (await cards_of(user_client, gid))["kartlar"][0]
    assert card["on_yargi"]["sonuc"] == "kanit_yok" and card["on_yargi"]["kanitlar"] == []
