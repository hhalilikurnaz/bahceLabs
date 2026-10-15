"""Bildirim karar katmanı (ADR 0018): sessiz saat, özet birleştirme, tekrar önleme, kritik istisnası, şablonlar ve kanal soyutlaması."""

import uuid
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from bahcelab_backend.domain.agro.catalog import load_catalog
from bahcelab_backend.domain.events.service import EventView
from bahcelab_backend.domain.notifications import decision, templates
from bahcelab_backend.domain.notifications.channels import registry
from bahcelab_backend.domain.notifications.event_candidates import (
    event_candidate,
    event_importance,
    tier_candidate,
)
from bahcelab_backend.domain.notifications.repository import NotificationRepository
from bahcelab_backend.domain.notifications.service import NotificationService
from bahcelab_backend.domain.notifications.types import Candidate

from .conftest import register
from .test_agro_api import new_garden

RULE = load_catalog().bildirim
TODAY = date(2026, 10, 13)
GARDEN = uuid.uuid4()


# ----------------------------------------------------------------------------- saf kararlar
def test_quiet_hours_wrap_midnight_and_digest_waits_for_seven() -> None:
    assert [decision.in_quiet_hours(h, RULE) for h in (21, 22, 23, 0, 3, 6, 7, 12)] == [False, True, True, True, True, True, False, False]
    assert not decision.digest_due(6, TODAY, None, RULE) and not decision.digest_due(23, TODAY, None, RULE)  # sessiz saatte özet üretilmez
    assert decision.digest_due(7, TODAY, None, RULE) and decision.digest_due(9, TODAY, None, RULE)  # geç kalan iş özeti yine bugün üretir
    assert not decision.digest_due(8, TODAY, TODAY, RULE)  # bugün üretildi: ikinci özet yok
    assert decision.digest_due(7, TODAY, TODAY - timedelta(days=1), RULE)


def test_only_critical_is_immediate_everything_else_waits_for_the_digest() -> None:
    assert decision.delivery("kritik", RULE) == "hemen" and decision.delivery("onemli", RULE) == "ozet" and decision.delivery("bilgi", RULE) == "ozet"


def test_tier_drop_means_getting_worse_never_data_gaps() -> None:
    assert decision.tier_dropped("iyi", "izle") and decision.tier_dropped("izle", "sorun") and not decision.tier_dropped("izle", "iyi") and not decision.tier_dropped("izle", "izle")
    assert not decision.tier_dropped(None, "dikkat") and not decision.tier_dropped("iyi", "veri_yok") and not decision.tier_dropped("veri_yok", "sorun")


def view(tur: str, guven: str, *, days_ago: int = 1, siddet: str | None = None, tahmin: bool = False, alan: float | None = 12.0, ayrinti: dict | None = None) -> EventView:
    end = TODAY - timedelta(days=days_ago)
    return EventView(uuid.uuid4(), tur, [tur], end - timedelta(days=1), end, alan, guven, siddet, None, tahmin, 1, "olay", None, ayrinti or {}, f"{tur}:{end}")


def test_event_importance_critical_for_frost_severe_and_high_confidence_important_otherwise_low_confidence_never_notified() -> None:
    assert event_importance(view("don", "orta"), RULE) == "kritik" and event_importance(view("ruzgar", "orta", siddet="siddetli"), RULE) == "kritik"
    assert event_importance(view("s2_dusus", "yuksek"), RULE) == "kritik" and event_importance(view("s2_dusus", "orta"), RULE) == "onemli"
    assert event_importance(view("ruzgar", "dusuk"), RULE) is None


def test_event_candidates_skip_stale_suspect_and_forecast_frost_and_use_stable_dedupe_keys() -> None:
    e = view("asiri_yagis", "orta", ayrinti={"asiri_yagis.en_yuksek_24s_mm": 63.3})
    c = event_candidate(GARDEN, "Bahçem", e, TODAY, RULE, e.anahtar)
    assert c is not None and c.oncelik == "onemli" and c.tur == "olay" and c.dedupe_key == f"olay:{GARDEN}:{e.anahtar}" and "63" in c.metin and c.baslik.startswith("Bahçem:")
    assert event_candidate(GARDEN, "B", view("asiri_yagis", "orta", days_ago=RULE.taze_olay_gun + 1), TODAY, RULE, "x") is None  # bayat olay bildirilmez
    assert event_candidate(GARDEN, "B", view("don", "orta", tahmin=True, days_ago=-2), TODAY, RULE, "x") is None  # tahmin donu hava uyarısı yolundan gelir
    suspect = view("s2_suphe", "dusuk")
    assert event_candidate(GARDEN, "B", EventView(**{**suspect.__dict__, "durum": "suphe"}), TODAY, RULE, "x") is None
    assert event_candidate(GARDEN, "B", view("ruzgar", "orta", tahmin=True, days_ago=-2), TODAY, RULE, "ruzgar:y") is not None  # tahmin rüzgârı uyarıdır


def test_templates_are_deterministic_and_never_invent_missing_numbers() -> None:
    title, body = templates.event_text("Bahçem", "don", date(2026, 2, 22), date(2026, 2, 23), {"en_dusuk_c": -4.5}, severe=True)
    assert title == "Bahçem: 22 Şub–23 Şub don olayı" and "-4,5 °C" in body and "(şiddetli)" in body
    assert templates.event_text("B", "don", TODAY, TODAY, {"en_dusuk_c": -1.0})[1] == templates.event_text("B", "don", TODAY, TODAY, {"en_dusuk_c": -1.0})[1]
    assert templates.tier_text("Bahçem", "iyi", "izle", ["a.", "b.", "c."]) == ("Bahçem: durum İyi → İzle", "a. b.")
    head, text_ = templates.digest_text(TODAY, [("bilgi", "Sulama bilgisi", "/x"), ("onemli", "Olay A", "/y")] * 6, RULE)
    assert head == "Günlük özet · 13 Eki: 6 önemli, 6 bilgi" and text_.splitlines()[0] == "• Olay A" and text_.splitlines()[-1] == "+4 madde daha" and len(text_.splitlines()) == RULE.ozet_azami_madde + 1


def test_tier_candidate_only_when_getting_worse() -> None:
    drop = tier_candidate(GARDEN, "Bahçem", "iyi", "izle", ["Ağaç gücü normal.", "Veri."], TODAY)
    assert drop is not None and drop.tur == "kademe_dususu" and drop.oncelik == "onemli" and drop.dedupe_key == f"kademe:{GARDEN}:iyi>izle:{TODAY}"
    assert tier_candidate(GARDEN, "B", "izle", "iyi", [], TODAY) is None and tier_candidate(GARDEN, "B", None, "dikkat", [], TODAY) is None


# ----------------------------------------------------------------------------- servis (gerçek tablolar)
@pytest.fixture
def factory(test_engine):
    return async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture
async def user_client(client: AsyncClient, cleanup_users):
    await register(client)
    return client


class Recorder:
    name = "kayit"

    def __init__(self) -> None:
        self.delivered: list[tuple[str, str]] = []

    async def deliver(self, workspace_id, notification) -> None:  # noqa: ANN001
        self.delivered.append((notification.tur, notification.oncelik))


async def setup(user_client, factory):  # noqa: ANN001, ANN201
    garden = await new_garden(user_client)
    workspace = uuid.UUID((await user_client.get("/auth/me")).json()["workspace_id"])
    return uuid.UUID(garden["id"]), workspace


def cand(garden: uuid.UUID, key: str, onem: str, tur: str = "olay") -> Candidate:
    return Candidate(garden, tur, onem, f"B: {key}", f"metin {key}", "durum", key)  # type: ignore[arg-type]


def local(hour: int, day: date = TODAY) -> datetime:
    return datetime(day.year, day.month, day.day, hour, 0, tzinfo=ZoneInfo("Europe/Istanbul"))


async def test_critical_is_delivered_immediately_while_important_and_info_wait_hidden_for_the_digest(user_client, factory):
    gid, ws = await setup(user_client, factory)
    recorder = Recorder()
    registry.register(recorder)
    try:
        async with factory() as session:
            service = NotificationService(NotificationRepository(session, ws))
            await service.publish([cand(gid, "a", "kritik"), cand(gid, "b", "onemli"), cand(gid, "c", "bilgi")])
            await session.commit()
        assert recorder.delivered == [("olay", "kritik")]  # yalnız kritik kanala gitti
        listed = (await user_client.get("/notifications")).json()
        assert [n["oncelik"] for n in listed["ogeler"]] == ["kritik"] and listed["okunmamis_sayisi"] == 1  # önemli/bilgi listede ve okunmamış sayısında yok
    finally:
        registry._extra.clear()


async def test_digest_merges_pending_items_into_one_card_once_a_day_and_never_in_quiet_hours(user_client, factory):
    gid, ws = await setup(user_client, factory)
    async with factory() as session:
        service = NotificationService(NotificationRepository(session, ws))
        await service.publish([cand(gid, "b", "onemli"), cand(gid, "c", "bilgi"), cand(gid, "d", "onemli")])
        assert await service.build_digest(local(6)) is None and await service.build_digest(local(23)) is None  # sessiz saat
        digest = await service.build_digest(local(7))
        await session.commit()
        assert digest is not None and digest.tur == "ozet" and digest.oncelik == "onemli" and "2 önemli, 1 bilgi" in digest.baslik
        assert [i["onem"] for i in digest.ayrinti or []] == ["onemli", "onemli", "bilgi"] and digest.baglanti == "/bahceler"
        assert await service.build_digest(local(9)) is None  # bugün zaten üretildi: tek özet
        await service.publish([cand(gid, "e", "bilgi")])
        assert await service.build_digest(local(10)) is None  # sonradan gelen madde yarın özette
        tomorrow = await service.build_digest(local(7, TODAY + timedelta(days=1)))
        assert tomorrow is not None and "0 önemli, 1 bilgi" in tomorrow.baslik
        await session.commit()
    listed = (await user_client.get("/notifications")).json()
    assert sorted(n["tur"] for n in listed["ogeler"]) == ["ozet", "ozet"] and all(n["ogeler"] for n in listed["ogeler"])  # özet kartı kapsadığı maddeleri taşır


async def test_digest_is_not_built_when_nothing_is_pending_or_the_user_turned_the_type_off(user_client, factory):
    gid, ws = await setup(user_client, factory)
    async with factory() as session:
        service = NotificationService(NotificationRepository(session, ws))
        assert await service.build_digest(local(8)) is None  # bekleyen yok
        await service.publish([cand(gid, "x", "onemli")])
        await service.set_preference("ozet", False)
        assert await service.build_digest(local(8)) is None  # kullanıcı özeti kapattı
        await session.commit()


async def test_same_event_is_never_repeated_and_critical_ignores_the_quiet_hours(user_client, factory):
    gid, ws = await setup(user_client, factory)
    recorder = Recorder()
    registry.register(recorder)
    try:
        async with factory() as session:
            service = NotificationService(NotificationRepository(session, ws))
            first = await service.publish([cand(gid, "frost", "kritik"), cand(gid, "wind", "onemli")])
            again = await service.publish([cand(gid, "frost", "kritik"), cand(gid, "wind", "onemli")])
            await session.commit()
        assert len(first) == 2 and again == [] and recorder.delivered == [("olay", "kritik")]  # dedupe: ikinci kez ne kayıt ne iletim
        # sessiz saat (03:00) kritiği engellemez: karar yalnız önem sınıfına bakar
        assert decision.in_quiet_hours(3, RULE) and decision.delivery("kritik", RULE) == "hemen"
    finally:
        registry._extra.clear()


async def test_preferences_off_skip_the_type_and_medium_risk_waits_in_the_digest_but_high_risk_is_critical(user_client, factory):
    from bahcelab_backend.domain.agro.risks import RiskSonucu

    gid, ws = await setup(user_client, factory)

    def risk(level: str) -> RiskSonucu:
        return RiskSonucu(kod="akdeniz_meyve_sinegi", ad="Akdeniz meyve sineği", seviye=level, gerekce="g", gecerlilik_baslangic=TODAY, gecerlilik_bitis=TODAY, veri_yeterli=True)  # type: ignore[arg-type]

    async with factory() as session:
        service = NotificationService(NotificationRepository(session, ws))
        await service.reconcile_risks(gid, "Bahçem", [risk("orta")])
        await session.commit()
    assert (await user_client.get("/notifications")).json()["toplam"] == 0  # orta risk özette bekler
    async with factory() as session:
        service = NotificationService(NotificationRepository(session, ws))
        await service.reconcile_risks(gid, "Bahçem", [risk("yuksek")])  # yükseğe çıktı: kritik, listede ANINDA
        await session.commit()
    listed = (await user_client.get("/notifications")).json()
    assert [(n["tur"], n["oncelik"]) for n in listed["ogeler"]] == [("zararli_riski", "kritik")]
    async with factory() as session:
        await NotificationService(NotificationRepository(session, ws)).set_preference("olay", False)
        out = await NotificationService(NotificationRepository(session, ws)).publish([cand(gid, "k", "kritik")])
        await session.commit()
    assert out == []  # tercih kapalı: tür atlanır


async def test_channel_abstraction_receives_the_same_template_text_for_every_channel(user_client, factory):
    gid, ws = await setup(user_client, factory)
    seen: list[str] = []

    class Phone:
        name = "whatsapp"

        async def deliver(self, workspace_id, notification) -> None:  # noqa: ANN001
            seen.append(notification.metin)

    registry.register(Phone())
    try:
        async with factory() as session:
            service = NotificationService(NotificationRepository(session, ws))
            title, body = templates.event_text("Bahçem", "don", TODAY, TODAY, {"en_dusuk_c": -2.0})
            await service.publish([Candidate(gid, "olay", "kritik", title, body, "hava", "k1")])  # type: ignore[arg-type]
            await session.commit()
    finally:
        registry._extra.clear()
    assert seen == [templates.event_text("Bahçem", "don", TODAY, TODAY, {"en_dusuk_c": -2.0})[1]]
    assert datetime.now(UTC).year >= 2026 and text is not None


async def test_job_turns_fresh_events_and_tier_drops_into_candidates_and_the_digest_job_summarises_them(user_client, factory):
    from bahcelab_backend.domain.events.models import EventModel
    from bahcelab_backend.domain.notifications.repository import StatusSnapshotRepository
    from bahcelab_backend.jobs.tasks import generate_notifications, send_digest

    from .test_weather_api import FakeProvider

    gid, ws = await setup(user_client, factory)
    today = datetime.now(ZoneInfo("Europe/Istanbul")).date()
    async with factory() as session:
        session.add(EventModel(garden_id=gid, anahtar=f"asiri_yagis:{today}", tur="asiri_yagis", turler=["asiri_yagis"], baslangic=today - timedelta(days=1), bitis=today - timedelta(days=1), guven="orta", durum="olay", tahmin=False, ayrinti={"asiri_yagis.en_yuksek_24s_mm": 71.0}, formul_surumu="t"))
        session.add(EventModel(garden_id=gid, anahtar="ruzgar:eski", tur="ruzgar", turler=["ruzgar"], baslangic=today - timedelta(days=60), bitis=today - timedelta(days=60), guven="orta", durum="olay", tahmin=False, formul_surumu="t"))
        await StatusSnapshotRepository(session).save(gid, "iyi")
        await session.commit()
    first = await generate_notifications(factory, FakeProvider(), workspace_id=ws)
    assert first.hata == 0
    async with factory() as session:
        rows = (await session.execute(text("SELECT tur, oncelik, teslim, baslik FROM notifications WHERE workspace_id = :w AND tur IN ('olay', 'kademe_dususu')"), {"w": ws})).all()
        snapshot = await StatusSnapshotRepository(session).get(gid)
    assert [(r[0], r[1], r[2]) for r in rows if r[0] == "olay"] == [("olay", "onemli", "ozet")]  # taze aşırı yağış: önemli → özette; 60 gün önceki olay bildirilmedi
    assert snapshot is not None  # kademe anlık görüntüsü güncellendi
    again = await generate_notifications(factory, FakeProvider(), workspace_id=ws)
    assert again.uretilen == 0  # tekrar yok
    digest = await send_digest(factory, FakeProvider(), now_local=local(7, today))
    assert digest.hata == 0 and digest.uretilen >= 1
    assert (await send_digest(factory, FakeProvider(), now_local=local(8, today))).uretilen == 0  # aynı gün ikinci özet yok
    listed = (await user_client.get("/notifications")).json()
    assert any(n["tur"] == "ozet" and any("aşırı yağış" in o["baslik"] for o in n["ogeler"]) for n in listed["ogeler"])


async def test_a_pending_drop_notification_closes_with_an_atmosphere_note_when_the_next_scene_does_not_confirm(user_client, factory):
    from bahcelab_backend.domain.events.models import EventModel
    from bahcelab_backend.jobs.tasks import generate_notifications

    from .test_weather_api import FakeProvider

    gid, ws = await setup(user_client, factory)
    today = datetime.now(ZoneInfo("Europe/Istanbul")).date()
    start = today - timedelta(days=6)
    async with factory() as session:
        session.add(EventModel(garden_id=gid, anahtar=f"s2_dusus:{start}", tur="s2_dusus", turler=["s2_dusus"], baslangic=start, bitis=today - timedelta(days=2), alan_da=8.0, guven="orta", durum="bekliyor", tahmin=False, ayrinti={"s2_dusus.neden": None}, formul_surumu="t"))
        await session.commit()
    await generate_notifications(factory, FakeProvider(), workspace_id=ws)  # «doğrulama bekliyor» önemli bildirim → özette bekler
    async with factory() as session:
        row = (await session.execute(text("SELECT baslik, metin, durum, teslim, oncelik FROM notifications WHERE workspace_id = :w AND dedupe_key = :k"), {"w": ws, "k": f"olay:{gid}:s2_dusus:{start}"})).one()
    assert row.oncelik == "onemli" and row.teslim == "ozet" and "doğrulama bekliyor" in row.baslik and row.durum == "olustu"
    async with factory() as session:  # sonraki net görüntü doğrulamadı: olay şüpheye döndü
        await session.execute(text("UPDATE events SET durum = 'suphe', tur = 's2_suphe', anahtar = :a, ayrinti = CAST(:d AS jsonb) WHERE garden_id = :g"), {"a": f"s2_suphe:{start}", "g": gid, "d": '{"s2_dusus.neden": "toparlandi"}'})
        await session.commit()
    await generate_notifications(factory, FakeProvider(), workspace_id=ws)
    async with factory() as session:
        closed = (await session.execute(text("SELECT baslik, metin, durum, otomatik_cozuldu FROM notifications WHERE workspace_id = :w AND dedupe_key = :k"), {"w": ws, "k": f"olay:{gid}:s2_dusus:{start}"})).one()
    assert closed.durum == "cozuldu" and closed.otomatik_cozuldu and "atmosfer" in closed.metin and closed.baslik.endswith("— atmosfer") and "doğrulama bekliyor" not in closed.baslik
