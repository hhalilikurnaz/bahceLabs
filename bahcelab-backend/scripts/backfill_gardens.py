"""Seçili bahçeler için geçmiş doldurmayı (2015'ten bugüne, ay başına en iyi 2 net sahne) çalıştırır; süreyi, depolamayı ve yıl yıl sahne sayısını raporlar.

Varsayılan dry-run (yalnız plan ve mevcut sayılar). Yeni tablolara yazar; mevcut sahne gözlemlerine dokunmaz. İdempotenttir: tamam aylar atlanır.
  python scripts/backfill_gardens.py --garden <id> --garden <id>            # plan
  python scripts/backfill_gardens.py --garden <id> --garden <id> --apply    # yedek + onay + doldurma
"""

import asyncio
import time
import uuid
from datetime import UTC, datetime

from guard import backup, confirm, log, parser  # type: ignore[import-not-found]
from sqlalchemy import text

from bahcelab_backend.config import get_settings
from bahcelab_backend.database import async_session_factory, engine
from bahcelab_backend.domain.acquisitions.backfill import (
    BackfillRunner,
    BackfillService,
)
from bahcelab_backend.domain.acquisitions.processor import SOURCE_ID
from bahcelab_backend.domain.acquisitions.repository import AcquisitionRepository
from bahcelab_backend.domain.gardens import models as _garden_models  # noqa: F401
from bahcelab_backend.domain.imagery.registry import get_imagery_provider
from bahcelab_backend.shared.storage import get_storage

SCOPE_SQL = (
    "SELECT g.id, g.ad FROM gardens g JOIN workspace_members m ON m.workspace_id = g.workspace_id JOIN users u ON u.id = m.user_id WHERE u.email = :e"
)


async def resolve(user: str | None, gardens: list[str] | None) -> list[tuple[uuid.UUID, str]]:
    async with async_session_factory() as s:
        if user:
            rows = (await s.execute(text(SCOPE_SQL), {"e": user})).all()
        else:
            rows = (await s.execute(text("SELECT id, ad FROM gardens WHERE id = ANY(:ids)"), {"ids": [uuid.UUID(g) for g in gardens or []]})).all()
    return [(r[0], r[1]) for r in rows]


async def report(garden_id: uuid.UUID, name: str, seconds: float | None) -> None:
    async with async_session_factory() as s:
        repo = AcquisitionRepository(s)
        size, scenes = await repo.storage_bytes(garden_id)
        rows = (
            await s.execute(
                text(
                    "SELECT extract(year FROM tarih)::int y, count(*) FILTER (WHERE durum='net') net, count(*) FILTER (WHERE durum='bulutlu') bulutlu, count(*) FILTER (WHERE durum='hata') hata "
                    "FROM acquisitions WHERE garden_id = :g GROUP BY 1 ORDER BY 1"
                ),
                {"g": garden_id},
            )
        ).all()
        months = (await s.execute(text("SELECT durum, count(*) FROM backfill_months WHERE garden_id = :g GROUP BY 1"), {"g": garden_id})).all()
    log("rapor", bahce=name, sure_sn=None if seconds is None else round(seconds, 1), net_sahne=scenes, depolama_mb=round(size / 1e6, 2), ay_durumlari=dict(months), yillar=[{"yil": r[0], "net": r[1], "bulutlu": r[2], "hata": r[3]} for r in rows])


async def main() -> None:
    args = parser("Geçmiş doldurma (ADR 0015)").parse_args()
    targets = await resolve(args.user, args.garden)
    if not targets:
        raise SystemExit("Kapsamda bahçe yok.")
    settings = get_settings()
    summary = {"bahceler": [n for _, n in targets], "baslangic": settings.acq_start, "ay_basina_sahne": settings.acq_scenes_per_month, "asgari_aralik_gun": settings.acq_min_gap_days, "kip": "uygula" if args.apply else "dry-run"}
    if not args.apply:
        log("dry-run", **summary)
        for gid, name in targets:
            await report(gid, name, None)
        return
    path = backup("backfill")
    if not confirm({**summary, "yedek": str(path)}, assume_yes=args.yes):
        log("iptal")
        return
    runner = BackfillRunner(async_session_factory, get_imagery_provider(), get_storage(), settings)
    sem = asyncio.Semaphore(settings.acq_parallel_months)

    class _Queue:
        done = 0
        total = 0

        async def enqueue_month(self, garden_id: uuid.UUID, month) -> None:  # type: ignore[no-untyped-def]
            self.total += 1

    queue = _Queue()
    for gid, name in targets:
        started = time.monotonic()
        async with async_session_factory() as session:
            service = BackfillService(session, runner.provider, runner.storage, queue, settings)  # type: ignore[arg-type]
            await service.start(gid)
            pending = await service.repo.pending_months(gid, SOURCE_ID)
        log("basliyor", bahce=name, ay=len(pending))

        async def one(month, gid=gid, name=name):  # type: ignore[no-untyped-def]
            async with sem:
                t = time.monotonic()
                outcome = await runner.run_month(gid, month)
                log("ay", bahce=name, ay=str(month), sonuc=outcome, sn=round(time.monotonic() - t, 1))

        await asyncio.gather(*(one(m) for m in pending))
        await report(gid, name, time.monotonic() - started)
    log("bitti", saat=datetime.now(UTC).isoformat(timespec="seconds"))
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
