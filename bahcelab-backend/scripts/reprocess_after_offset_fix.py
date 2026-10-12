"""Uydu indekslerini sahnenin kendi radyometrisiyle (ürün meta verisi) yeniden işler; çok yıllık analizi de yeniden kurar.

Varsayılan dry-run. Örnek:
  python scripts/reprocess_after_offset_fix.py --user test@bahcelab.com            # yalnız sayılar
  python scripts/reprocess_after_offset_fix.py --user test@bahcelab.com --apply    # yedek + onay + işlem
"""

import asyncio
import time
import uuid

from guard import backup, confirm, log, parser  # type: ignore[import-not-found]
from sqlalchemy import text

from bahcelab_backend.database import async_session_factory, engine
from bahcelab_backend.domain.gardens import models as _garden_models  # noqa: F401  (FK çözümü için)
from bahcelab_backend.domain.imagery.registry import get_imagery_provider
from bahcelab_backend.domain.multiyear import models as _multiyear_models  # noqa: F401
from bahcelab_backend.domain.multiyear.runner import ImmediateYearQueue, YearRunner
from bahcelab_backend.domain.multiyear.service import MultiyearService
from bahcelab_backend.domain.ndvi.persist import storage_prefix
from bahcelab_backend.domain.ndvi.repository import NdviRepository
from bahcelab_backend.domain.ndvi.runner import run_job
from bahcelab_backend.shared.storage import get_storage

SCOPE_SQL = (
    "SELECT g.id, g.ad, g.workspace_id FROM gardens g JOIN workspace_members m ON m.workspace_id = g.workspace_id "
    "JOIN users u ON u.id = m.user_id WHERE u.email = :e"
)


async def resolve(user: str | None, gardens: list[str] | None) -> list[tuple[uuid.UUID, str, uuid.UUID]]:
    async with async_session_factory() as s:
        if user:
            rows = (await s.execute(text(SCOPE_SQL), {"e": user})).all()
        else:
            rows = (await s.execute(text("SELECT id, ad, workspace_id FROM gardens WHERE id = ANY(:ids)"), {"ids": [uuid.UUID(g) for g in gardens or []]})).all()
    return [(r[0], r[1], r[2]) for r in rows]


async def counts(ids: list[uuid.UUID]) -> dict[str, int]:
    async with async_session_factory() as s:
        q = lambda t: s.execute(text(f"SELECT count(*) FROM {t} WHERE garden_id = ANY(:ids)"), {"ids": ids})  # noqa: E731
        return {t: int((await q(t)).scalar_one()) for t in ("scene_observations", "index_observations", "multiyear_years", "multiyear_results")}


async def main() -> None:
    args = parser("Uydu indekslerini yeniden işle (radyometri düzeltmesi)").parse_args()
    targets = await resolve(args.user, args.garden)
    if not targets:
        raise SystemExit("Kapsamda bahçe yok.")
    summary = {"bahceler": [f"{n} ({g})" for g, n, _ in targets], **await counts([g for g, _, _ in targets]), "kip": "uygula" if args.apply else "dry-run"}
    if not args.apply:
        log("dry-run", **summary)
        return
    path = backup("reprocess")
    if not confirm({**summary, "yedek": str(path)}, assume_yes=args.yes):
        log("iptal")
        return
    storage = get_storage()
    provider = get_imagery_provider()
    for gid, name, workspace_id in targets:
        started = time.monotonic()
        async with async_session_factory() as session:
            repo = NdviRepository(session)
            await repo.delete_observations(gid)
            for table in ("multiyear_results", "multiyear_years", "multiyear_runs"):
                await session.execute(text(f"DELETE FROM {table} WHERE garden_id = :g"), {"g": gid})
            storage.delete_prefix(storage_prefix(gid))
            storage.delete_prefix(f"multiyear/{gid}")
            job = await repo.create_job(gid, "yeniden")
            await session.commit()
        if job is not None:
            await run_job(job.id)
        async with async_session_factory() as session:
            queue = ImmediateYearQueue(YearRunner(async_session_factory, provider, storage))
            status = await MultiyearService(session, workspace_id, provider, storage, queue).start(gid)
        log("bahce-tamam", bahce=name, kimlik=gid, sure_sn=round(time.monotonic() - started, 1), cok_yillik=status.durum, yil=status.tamamlanan)
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
