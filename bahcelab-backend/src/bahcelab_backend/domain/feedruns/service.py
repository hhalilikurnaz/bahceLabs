"""Besleme işi izleyicisi: her çalışma `feed_runs` satırına yazılır (başlangıç, kalp atışı, sonuç); düşen/başarısız iş log + bildirimle GÖRÜNÜR olur.

İzleme hiçbir zaman işin kendisini bozmaz: kayıt hataları yutulur (loglanır). Bahçe silinirse (FK) izleme sessizce kapanır.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select, text, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from bahcelab_backend.config import get_settings
from bahcelab_backend.domain.feedruns.models import KAYNAK_ADI, FeedRunModel
from bahcelab_backend.domain.feedruns.rules import is_stale, next_action

logger = logging.getLogger(__name__)
SessionFactory = async_sessionmaker[AsyncSession]


def _now() -> datetime:
    return datetime.now(UTC)


@dataclass
class RunHandle:
    """İş gövdesinin ilerleme bildirdiği tutamaç (`ilerle`): kalp atışını da tazeler."""

    factory: SessionFactory
    garden_id: uuid.UUID
    kaynak: str
    progress: dict[str, Any] = field(default_factory=dict)
    active: bool = True

    async def ilerle(self, **values: Any) -> None:
        self.progress.update(values)
        if self.active:
            await _safe(self.factory, update(FeedRunModel).where(FeedRunModel.garden_id == self.garden_id, FeedRunModel.kaynak == self.kaynak).values(ilerleme=self.progress, kalp_atisi=_now()))


async def _garden_exists(factory: SessionFactory, garden_id: uuid.UUID) -> bool:
    try:
        async with factory() as session:
            return (await session.execute(text("SELECT 1 FROM gardens WHERE id = :g"), {"g": garden_id})).first() is not None
    except Exception:  # noqa: BLE001
        return True  # emin değilsek hatayı gizleme


async def _safe(factory: SessionFactory, stmt: Any) -> bool:
    try:
        async with factory() as session:
            await session.execute(stmt)
            await session.commit()
        return True
    except Exception:  # noqa: BLE001 - izleme işi bozmaz (bahçe silinmiş olabilir)
        logger.debug("Besleme izleme kaydı yazılamadı", exc_info=True)
        return False


async def notify(factory: SessionFactory, garden_id: uuid.UUID, kaynak: str, olay: str, ayrinti: str, attempts: int) -> None:
    """Kesilme / başarısızlık bildirimi (günde bir, bahçe × kaynak × olay): bildirim merkezinde ANINDA görünür."""
    from bahcelab_backend.domain.notifications.repository import NotificationRepository
    from bahcelab_backend.domain.notifications.service import NotificationService
    from bahcelab_backend.domain.notifications.types import Candidate
    from bahcelab_backend.shared.clock import today_istanbul

    try:
        async with factory() as session:
            row = (await session.execute(text("SELECT ad, workspace_id FROM gardens WHERE id = :g"), {"g": garden_id})).one_or_none()
            if row is None:
                return
            ad, workspace_id = row
            settings = get_settings()
            durable = attempts >= settings.feed_retry_max
            what = KAYNAK_ADI.get(kaynak, kaynak)
            if olay == "kesildi":
                title, body = f"{ad}: {what} çekimi yarıda kaldı", "Arka plan işi (sunucu yeniden başlamış olabilir) kesildi; kaldığı yerden kendiliğinden devam edecek. Veri tamamlanana kadar bu kaynak eksik olabilir."
            elif durable:
                title, body = f"{ad}: {what} çekimi tekrar tekrar başarısız", f"{attempts} denemede tamamlanamadı; kendiliğinden denemeyi bıraktı. Son hata: {ayrinti[:160]}. Hesap/erişim ya da kaynak durumu kontrol edilmeli."
            else:
                title, body = f"{ad}: {what} çekimi başarısız", f"Deneme {attempts}/{settings.feed_retry_max}; {settings.feed_retry_backoff_minutes} dk sonra kendiliğinden yeniden denenecek. Hata: {ayrinti[:160]}."
            key = f"besleme:{garden_id}:{kaynak}:{'vazgec' if durable and olay == 'hata' else olay}:{today_istanbul()}"  # «denemeyi bıraktı» ayrı bildirimdir (ilk hata bildirimi aynı günde olsa da)
            await NotificationService(NotificationRepository(session, workspace_id)).publish_operational([Candidate(garden_id, "besleme", "onemli", title, body, "durum", key)])
            await session.commit()
    except Exception:  # noqa: BLE001
        logger.exception("Besleme bildirimi yazılamadı (%s %s)", garden_id, kaynak)


async def _begin(factory: SessionFactory, garden_id: uuid.UUID, kaynak: str) -> bool:
    now = _now()
    stmt = insert(FeedRunModel).values(garden_id=garden_id, kaynak=kaynak, durum="calisiyor", deneme=0, baslangic=now, kalp_atisi=now, bitis=None, ilerleme=None, hata=None)
    stmt = stmt.on_conflict_do_update(constraint="uq_feed_run", set_={"durum": "calisiyor", "baslangic": now, "kalp_atisi": now, "bitis": None, "hata": None, "ilerleme": None})
    return await _safe(factory, stmt)


async def _beat(factory: SessionFactory, garden_id: uuid.UUID, kaynak: str, every: float) -> None:
    while True:
        await asyncio.sleep(every)
        await _safe(factory, update(FeedRunModel).where(FeedRunModel.garden_id == garden_id, FeedRunModel.kaynak == kaynak, FeedRunModel.durum == "calisiyor").values(kalp_atisi=_now()))


@asynccontextmanager
async def tracked(factory: SessionFactory, garden_id: uuid.UUID, kaynak: str) -> AsyncIterator[RunHandle]:
    """Bir besleme aşamasını izler. Başarıda `tamam` (deneme sıfırlanır); istisnada `hata` + log + bildirim ve istisna YENİDEN fırlatılır;
    iptalde (süreç kapanıyor) `kesildi` (bildirimsiz: kapanış suç değil, açılışta devam eder)."""
    active = await _begin(factory, garden_id, kaynak)
    handle = RunHandle(factory, garden_id, kaynak, active=active)
    beat = asyncio.create_task(_beat(factory, garden_id, kaynak, get_settings().feed_heartbeat_seconds)) if active else None
    try:
        yield handle
    except asyncio.CancelledError:
        await asyncio.shield(_safe(factory, update(FeedRunModel).where(FeedRunModel.garden_id == garden_id, FeedRunModel.kaynak == kaynak).values(durum="kesildi", bitis=_now(), hata="iptal edildi (süreç kapanıyor)")))
        raise
    except Exception as exc:
        if not await _garden_exists(factory, garden_id):
            raise  # bahçe silindi: yarım kalan yazım hatası bir arıza değildir; sessizce biter (kayıt FK ile zaten gider)
        message = f"{type(exc).__name__}: {exc}"[:500]
        attempts = await _fail(factory, garden_id, kaynak, "hata", message)
        logger.error("Besleme başarısız (%s, bahçe %s, deneme %s): %s", kaynak, garden_id, attempts, message)
        await notify(factory, garden_id, kaynak, "hata", message, attempts)
        raise
    else:
        await _safe(factory, update(FeedRunModel).where(FeedRunModel.garden_id == garden_id, FeedRunModel.kaynak == kaynak).values(durum="tamam", deneme=0, bitis=_now(), kalp_atisi=_now(), ilerleme=handle.progress or None, hata=None))
    finally:
        if beat is not None:
            beat.cancel()


async def mark_skipped(factory: SessionFactory, garden_id: uuid.UUID, kaynak: str, reason: str) -> None:
    """Bilinçli atlama (örn. belirteç yok): hata değil, ama sessiz de değil — durum «atlandi» ve neden kayıtlı."""
    now = _now()
    stmt = insert(FeedRunModel).values(garden_id=garden_id, kaynak=kaynak, durum="atlandi", deneme=0, baslangic=now, kalp_atisi=now, bitis=now, hata=reason)
    await _safe(factory, stmt.on_conflict_do_update(constraint="uq_feed_run", set_={"durum": "atlandi", "bitis": now, "kalp_atisi": now, "hata": reason}))
    logger.warning("Besleme atlandı (%s, bahçe %s): %s", kaynak, garden_id, reason)


async def _fail(factory: SessionFactory, garden_id: uuid.UUID, kaynak: str, durum: str, message: str) -> int:
    """Durumu `hata`/`kesildi` yapar, denemeyi artırır; yeni deneme sayısını döndürür."""
    try:
        async with factory() as session:
            row = (await session.execute(select(FeedRunModel).where(FeedRunModel.garden_id == garden_id, FeedRunModel.kaynak == kaynak))).scalar_one_or_none()
            if row is None:
                return 1
            row.durum, row.deneme, row.bitis, row.hata = durum, row.deneme + 1, _now(), message
            await session.commit()
            return int(row.deneme)
    except Exception:  # noqa: BLE001
        logger.debug("Besleme hata kaydı yazılamadı", exc_info=True)
        return 1


async def resume_feeds(factory: SessionFactory, *, startup: bool = False, start: Any = None) -> dict[str, int]:
    """Kesilen/başarısız besleme işlerini görünür kılar ve devam ettirir. Açılışta (`startup`) 1 dk, normalde `feed_stale_minutes` kalp atışı yoksa «kesildi» sayılır.

    `start(garden_id)`: işi yeniden başlatan işlev (varsayılan `jobs.feed.start_garden_feed`). Dönüş: kesilen, devam ettirilen, vazgeçilen bahçe sayıları."""
    settings = get_settings()
    now = _now()
    stale_after = 1 if startup else settings.feed_stale_minutes
    out = {"kesilen": 0, "devam": 0, "vazgecilen": 0}
    resume: set[uuid.UUID] = set()
    async with factory() as session:
        runs = (await session.execute(select(FeedRunModel))).scalars().all()
    for run in runs:
        if run.durum == "calisiyor" and is_stale(run.kalp_atisi, now, stale_after):
            attempts = await _fail(factory, run.garden_id, run.kaynak, "kesildi", f"kalp atışı {run.kalp_atisi:%d.%m %H:%M} UTC'den beri yok (süreç düştü)")
            logger.warning("Besleme KESİLDİ (%s, bahçe %s): kalp atışı %s'den beri yok; devam ettirilecek", run.kaynak, run.garden_id, run.kalp_atisi)
            await notify(factory, run.garden_id, run.kaynak, "kesildi", "", attempts)
            out["kesilen"] += 1
            resume.add(run.garden_id)
            continue
        if run.durum == "atlandi" and run.kaynak in ("imerg", "smap") and settings.earthdata_token:
            resume.add(run.garden_id)  # belirteç sonradan tanımlandı (ya da bu süreç belirteçle başladı): atlanan doğrulama çekimi şimdi yapılabilir
            continue
        action = next_action(run.durum, run.deneme, run.bitis, now, retry_max=settings.feed_retry_max, backoff_minutes=settings.feed_retry_backoff_minutes)
        if action == "devam":
            resume.add(run.garden_id)
        elif action == "vazgec":
            out["vazgecilen"] += 1
    if resume:
        if start is None:
            from bahcelab_backend.jobs.feed import start_garden_feed as start
        for garden_id in resume:
            start(garden_id)
            out["devam"] += 1
            logger.info("Besleme kaldığı yerden devam ediyor (bahçe %s)", garden_id)
    return out
