"""HLS NDVI geçmiş doldurma (ADR 0018): Planetary Computer hls2-s30/l30 (2020→). Yalnız `hls_observations` tablosuna yazar; idempotent (var olan sahne atlanır).

Varsayılan dry-run (mevcut kayıt sayısı). Uygulamak için --apply (pg_dump yedeği + onay).
  python scripts/backfill_hls.py --garden <id> [--baslangic 2020-01-01] --apply --yes
"""

import asyncio
from datetime import UTC, date, datetime

from guard import backup, confirm, log, parser  # type: ignore[import-not-found]
from sqlalchemy import text

from bahcelab_backend.config import get_settings
from bahcelab_backend.database import async_session_factory, engine
from bahcelab_backend.domain.gardens import models as _garden_models  # noqa: F401
from bahcelab_backend.domain.imagery.registry import get_hls_provider
from bahcelab_backend.domain.series.service import sync_hls

SCOPE_SQL = "SELECT g.id, g.ad FROM gardens g JOIN workspace_members m ON m.workspace_id = g.workspace_id JOIN users u ON u.id = m.user_id WHERE u.email = :e"


async def main() -> None:
    import uuid

    ap = parser("HLS NDVI geçmiş doldurma (ADR 0018)")
    ap.add_argument("--baslangic", default=get_settings().hls_start)
    args = ap.parse_args()
    async with async_session_factory() as s:
        rows = (await s.execute(text(SCOPE_SQL), {"e": args.user})).all() if args.user else (await s.execute(text("SELECT id, ad FROM gardens WHERE id = ANY(:ids)"), {"ids": [uuid.UUID(g) for g in args.garden or []]})).all()
        counts = {r[1]: (await s.execute(text("SELECT count(*) FROM hls_observations WHERE garden_id = :g"), {"g": r[0]})).scalar_one() for r in rows}
    if not rows:
        raise SystemExit("Kapsamda bahçe yok.")
    summary = {"bahceler": [r[1] for r in rows], "baslangic": args.baslangic, "mevcut_kayit": counts, "kip": "uygula" if args.apply else "dry-run"}
    if not args.apply:
        log("dry-run", **summary)
        return
    path = backup("hls")
    if not confirm({**summary, "yedek": str(path)}, assume_yes=args.yes):
        log("iptal")
        return
    today = datetime.now(UTC).date()
    for gid, name in ((r[0], r[1]) for r in rows):
        async with async_session_factory() as s:
            result = await sync_hls(s, gid, date.fromisoformat(args.baslangic), today, get_hls_provider())
        log("hls", bahce=name, **result)
    log("bitti")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
