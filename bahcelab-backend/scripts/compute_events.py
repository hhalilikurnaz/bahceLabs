"""Olay motoru geçmiş hesabı (ADR 0018): bahçelerin olaylarını 2015'ten bugüne (+ 7 gün tahmin) kurar ve `events` / `event_sources` tablolarına yazar.

Varsayılan dry-run: kayıtları YAZMAZ, kurulacak olayları sayar ve listeler. Yalnız olay tablolarına yazar (türetilmiş, yeniden üretilebilir); mevcut veriye dokunmaz.
  python scripts/compute_events.py --garden <id> [--apply --yes]
"""

import asyncio
import json
from collections import Counter
from datetime import UTC, datetime

from guard import backup, confirm, log, parser  # type: ignore[import-not-found]
from sqlalchemy import text

from bahcelab_backend.database import async_session_factory, engine
from bahcelab_backend.domain.agro import catalog as cat
from bahcelab_backend.domain.events import rules as er
from bahcelab_backend.domain.events import service as events
from bahcelab_backend.domain.gardens import models as _garden_models  # noqa: F401
from bahcelab_backend.shared.storage import get_storage

SCOPE_SQL = "SELECT g.id, g.ad FROM gardens g JOIN workspace_members m ON m.workspace_id = g.workspace_id JOIN users u ON u.id = m.user_id WHERE u.email = :e"


async def targets(user: str | None, gardens: list[str] | None) -> list[tuple[object, str]]:
    import uuid

    async with async_session_factory() as s:
        rows = (await s.execute(text(SCOPE_SQL), {"e": user})).all() if user else (await s.execute(text("SELECT id, ad FROM gardens WHERE id = ANY(:ids)"), {"ids": [uuid.UUID(g) for g in gardens or []]})).all()
    return [(r[0], r[1]) for r in rows]


async def main() -> None:
    ap = parser("Olay motoru geçmiş hesabı (ADR 0018)")
    args = ap.parse_args()
    found = await targets(args.user, args.garden)
    if not found:
        raise SystemExit("Kapsamda bahçe yok.")
    today = datetime.now(UTC).date()
    rule = cat.load_catalog().olay
    plans = {}
    async with async_session_factory() as s:
        for gid, name in found:
            plans[gid] = er.build_events(await events.collect_signals(s, get_storage(), gid, today), rule)  # type: ignore[arg-type]
            log("plan", bahce=name, olay_sayisi=len(plans[gid]), turler=dict(Counter(e.tur for e in plans[gid])), guven=dict(Counter(e.guven for e in plans[gid])))
    if not args.apply:
        log("dry-run", not_="Yazılmadı; --apply ile uygulayın.")
        return
    path = backup("events")
    if not confirm({"bahceler": [n for _, n in found], "olay": {str(g): len(p) for g, p in plans.items()}, "yedek": str(path)}, assume_yes=args.yes):
        log("iptal")
        return
    async with async_session_factory() as s:
        for gid, name in found:
            result = await events.compute_events_for(s, get_storage(), gid, today)  # type: ignore[arg-type]
            await s.commit()
            log("yazildi", bahce=name, **result)
    log("bitti", ornek=json.dumps({"kaynak": "events"}))
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
