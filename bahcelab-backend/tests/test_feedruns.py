"""Besleme işi izleme (devam et / düşerse görünür ol): durum satırları, kesilme ve yeniden deneme kararı, bildirim ve log. Gerçek tablolar, ağsız."""

import asyncio
import logging
import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select, text

from bahcelab_backend.config import get_settings
from bahcelab_backend.domain.feedruns import service as fr
from bahcelab_backend.domain.feedruns.models import FeedRunModel
from bahcelab_backend.domain.feedruns.rules import is_stale, next_action
from bahcelab_backend.domain.notifications.models import NotificationModel
from bahcelab_backend.domain.water import feed as water_feed

from .test_events_service import factory, seed, user_client  # noqa: F401, F811

NOW = datetime(2026, 10, 10, 12, 0, tzinfo=UTC)


# ----------------------------------------------------------------------------- saf kurallar
def test_stale_heartbeat_means_the_process_died():
    assert is_stale(NOW - timedelta(minutes=4), NOW, 3) and not is_stale(NOW - timedelta(minutes=2), NOW, 3)


def test_next_action_resumes_cut_runs_retries_failures_with_backoff_and_gives_up_visibly():
    kw = {"retry_max": 4, "backoff_minutes": 15}
    assert next_action("kesildi", 1, NOW, NOW, **kw) == "devam"  # süreç düştü, iş suçsuz: hemen devam
    assert next_action("hata", 1, NOW - timedelta(minutes=5), NOW, **kw) == "bekle"  # geri çekilme
    assert next_action("hata", 1, NOW - timedelta(minutes=20), NOW, **kw) == "devam"
    assert next_action("hata", 4, NOW - timedelta(hours=5), NOW, **kw) == "vazgec"  # kendiliğinden denemeyi bırakır
    assert [next_action(d, 0, NOW, NOW, **kw) for d in ("tamam", "atlandi", "calisiyor")] == ["yok"] * 3


# ----------------------------------------------------------------------------- izleyici
async def runs_of(factory, gid):  # noqa: ANN001, ANN201, F811
    async with factory() as session:
        return {r.kaynak: r for r in (await session.execute(select(FeedRunModel).where(FeedRunModel.garden_id == gid))).scalars().all()}


async def feed_notes(factory, gid):  # noqa: ANN001, ANN201, F811
    async with factory() as session:
        return (await session.execute(select(NotificationModel).where(NotificationModel.garden_id == gid, NotificationModel.tur == "besleme"))).scalars().all()


async def test_successful_run_is_recorded_as_done_and_resets_attempts(user_client, factory):  # noqa: F811
    gid = await seed(user_client, factory)
    async with fr.tracked(factory, gid, "era5") as run:
        await run.ilerle(gun=12)
    row = (await runs_of(factory, gid))["era5"]
    assert row.durum == "tamam" and row.deneme == 0 and row.ilerleme == {"gun": 12} and row.bitis is not None and row.hata is None


async def test_failed_run_is_logged_notified_once_per_day_and_the_error_is_reraised(user_client, factory, caplog):  # noqa: F811
    gid = await seed(user_client, factory)
    caplog.set_level(logging.ERROR)
    for _ in range(2):
        with pytest.raises(RuntimeError, match="erişim reddedildi"):
            async with fr.tracked(factory, gid, "imerg"):
                raise RuntimeError("erişim reddedildi (403)")
    row = (await runs_of(factory, gid))["imerg"]
    assert row.durum == "hata" and row.deneme == 2 and "403" in (row.hata or "")
    assert any("Besleme başarısız" in r.getMessage() for r in caplog.records)  # log
    notes = await feed_notes(factory, gid)
    assert len(notes) == 1 and notes[0].teslim == "anlik" and "IMERG yağış çekimi başarısız" in notes[0].baslik and "yeniden denenecek" in notes[0].metin  # bildirim merkezinde ANINDA, günde bir


async def test_repeated_failures_say_that_it_stopped_trying(user_client, factory):  # noqa: F811
    gid = await seed(user_client, factory)
    for _ in range(get_settings().feed_retry_max):
        with pytest.raises(ValueError):
            async with fr.tracked(factory, gid, "smap"):
                raise ValueError("kaynak yok")
    notes = await feed_notes(factory, gid)
    assert any("tekrar tekrar başarısız" in n.baslik for n in notes)


async def test_cancellation_marks_the_run_cut_without_a_notification(user_client, factory):  # noqa: F811
    gid = await seed(user_client, factory)

    async def body() -> None:
        async with fr.tracked(factory, gid, "hls"):
            await asyncio.sleep(30)

    task = asyncio.create_task(body())
    await asyncio.sleep(0.3)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert (await runs_of(factory, gid))["hls"].durum == "kesildi" and await feed_notes(factory, gid) == []  # kapanış suç değil: açılışta devam eder


async def test_missing_token_is_recorded_as_skipped_not_silently_ignored(user_client, factory, monkeypatch):  # noqa: F811
    gid = await seed(user_client, factory)
    monkeypatch.setattr(get_settings(), "earthdata_token", "")
    out = await water_feed.feed_validation(factory, gid)
    runs = await runs_of(factory, gid)
    assert "atlandi" in str(out["durum"]) and {runs["imerg"].durum, runs["smap"].durum} == {"atlandi"} and "EARTHDATA_TOKEN" in (runs["imerg"].hata or "")


async def test_validation_that_finds_nothing_for_many_days_is_a_failure_but_a_small_gap_is_not(user_client, factory, monkeypatch):  # noqa: F811
    gid = await seed(user_client, factory)
    monkeypatch.setattr(get_settings(), "earthdata_token", "x")
    results = iter([{"aranan_gun": 30, "yazilan": 0}, {"aranan_gun": 30, "yazilan": 0}, {"aranan_gun": 3, "yazilan": 0}, {"aranan_gun": 3, "yazilan": 0}])

    async def fake_sync(session, garden_id, source, start, end, **kw):  # noqa: ANN001, ANN202
        return next(results)

    monkeypatch.setattr(water_feed, "sync_validation", fake_sync)
    out = await water_feed.feed_validation(factory, gid)
    assert all(str(v).startswith("hata") for v in out.values())  # 30 gün arandı, hiçbiri yazılamadı: sessiz «tamam» DEĞİL
    assert {r.durum for r in (await runs_of(factory, gid)).values()} == {"hata"}
    out2 = await water_feed.feed_validation(factory, gid)  # 3 günlük eksik: kaynak gecikmesi, hata değil
    assert all(isinstance(v, dict) for v in out2.values()) and {r.durum for r in (await runs_of(factory, gid)).values()} == {"tamam"}


# ----------------------------------------------------------------------------- devam ettirme
async def put_run(factory, gid, kaynak, durum, *, heartbeat_min=0, finished_min=None, attempts=0):  # noqa: ANN001, ANN201, F811
    now = datetime.now(UTC)
    async with factory() as session:
        await session.execute(text("DELETE FROM feed_runs WHERE garden_id = :g AND kaynak = :k"), {"g": gid, "k": kaynak})
        session.add(FeedRunModel(garden_id=gid, kaynak=kaynak, durum=durum, deneme=attempts, kalp_atisi=now - timedelta(minutes=heartbeat_min), baslangic=now - timedelta(minutes=heartbeat_min + 1), bitis=None if finished_min is None else now - timedelta(minutes=finished_min)))
        await session.commit()


async def test_resume_marks_dead_runs_cut_notifies_and_restarts_them_but_leaves_live_ones(user_client, factory):  # noqa: F811
    dead, alive = await seed(user_client, factory), await seed(user_client, factory)
    await put_run(factory, dead, "imerg", "calisiyor", heartbeat_min=10)
    await put_run(factory, alive, "imerg", "calisiyor", heartbeat_min=0)
    started: list[uuid.UUID] = []
    out = await fr.resume_feeds(factory, start=started.append)
    assert started == [dead] and out == {"kesilen": 1, "devam": 1, "vazgecilen": 0}
    assert (await runs_of(factory, dead))["imerg"].durum == "kesildi" and (await runs_of(factory, alive))["imerg"].durum == "calisiyor"
    notes = await feed_notes(factory, dead)
    assert len(notes) == 1 and "yarıda kaldı" in notes[0].baslik and "kaldığı yerden" in notes[0].metin and await feed_notes(factory, alive) == []
    again = await fr.resume_feeds(factory, start=started.append)  # kesilen iş devam ettirilir; bildirim günde bir
    assert again["kesilen"] == 0 and len(await feed_notes(factory, dead)) == 1


async def test_startup_treats_a_minute_old_heartbeat_as_dead_but_the_periodic_watch_waits_longer(user_client, factory):  # noqa: F811
    gid = await seed(user_client, factory)
    await put_run(factory, gid, "era5", "calisiyor", heartbeat_min=2)
    started: list[uuid.UUID] = []
    assert (await fr.resume_feeds(factory, start=started.append))["kesilen"] == 0  # bekçi: 3 dk eşiği
    assert (await fr.resume_feeds(factory, startup=True, start=started.append))["kesilen"] == 1  # açılış: 1 dk eşiği


async def test_failures_are_retried_after_the_backoff_and_abandoned_after_the_limit(user_client, factory):  # noqa: F811
    wait, ready, spent, done = [await seed(user_client, factory) for _ in range(4)]
    await put_run(factory, wait, "hls", "hata", finished_min=3, attempts=1)
    await put_run(factory, ready, "hls", "hata", finished_min=30, attempts=1)
    await put_run(factory, spent, "hls", "hata", finished_min=600, attempts=get_settings().feed_retry_max)
    await put_run(factory, done, "hls", "tamam", finished_min=600)
    started: list[uuid.UUID] = []
    out = await fr.resume_feeds(factory, start=started.append)
    assert started == [ready] and out["vazgecilen"] >= 1  # yalnız geri çekilmesi dolan yeniden denenir; limit dolan görünür kalır (denenmez)


async def test_a_failure_after_the_garden_was_deleted_is_not_an_alarm(user_client, factory):  # noqa: F811
    gid = await seed(user_client, factory)
    with pytest.raises(RuntimeError):
        async with fr.tracked(factory, gid, "era5"):
            await user_client.delete(f"/gardens/{gid}")
            raise RuntimeError("yabancı anahtar ihlali (bahçe silindi)")
    async with factory() as session:
        assert (await session.execute(select(FeedRunModel).where(FeedRunModel.garden_id == gid))).first() is None  # kayıt bahçeyle gitti
        assert (await session.execute(select(NotificationModel).where(NotificationModel.tur == "besleme"))).first() is None  # alarm yok


async def test_a_run_skipped_for_a_missing_token_resumes_once_the_token_exists(user_client, factory, monkeypatch):  # noqa: F811
    gid = await seed(user_client, factory)
    monkeypatch.setattr(get_settings(), "earthdata_token", "")
    await water_feed.feed_validation(factory, gid)  # belirteç yok → atlandi
    started: list[uuid.UUID] = []
    assert (await fr.resume_feeds(factory, start=started.append))["devam"] == 0  # hâlâ belirteç yok: boşuna denenmez
    monkeypatch.setattr(get_settings(), "earthdata_token", "x")
    assert (await fr.resume_feeds(factory, start=started.append))["devam"] == 1 and started == [gid]
