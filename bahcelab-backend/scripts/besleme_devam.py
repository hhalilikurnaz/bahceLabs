"""Besleme işlerini (ERA5 → HLS → IMERG/SMAP) kaldığı yerden sürdürür ve durumu gösterir. Uygulama içindeki bekçinin elle tetiklenen eşi.

Varsayılan dry-run: bahçelerin `feed_runs` durumunu ve kaynak başına eksik günleri gösterir, HİÇBİR ŞEY çekmez. `--apply --yes` ile `run_garden_feed` çalışır:
idempotenttir (var olan gün/sahne atlanır, parça parça kaydedilir), iş düşerse `feed_runs` + bildirim + log görünür kılar. Yalnız ekler; mevcut veriyi silmez.
  python scripts/besleme_devam.py --garden <id> [--garden <id>] [--apply --yes]
"""

import asyncio
import uuid

from guard import backup, confirm, log, parser  # type: ignore[import-not-found]
from sqlalchemy import select, text

from bahcelab_backend.database import async_session_factory, engine
from bahcelab_backend.domain.feedruns.models import FeedRunModel
from bahcelab_backend.domain.gardens import models as _garden_models  # noqa: F401
from bahcelab_backend.jobs.feed import run_garden_feed

SCOPE_SQL = "SELECT g.id, g.ad FROM gardens g JOIN workspace_members m ON m.workspace_id = g.workspace_id JOIN users u ON u.id = m.user_id WHERE u.email = :e"


async def targets(user: str | None, gardens: list[str] | None) -> list[tuple[uuid.UUID, str]]:
    async with async_session_factory() as s:
        rows = (await s.execute(text(SCOPE_SQL), {"e": user})).all() if user else (await s.execute(text("SELECT id, ad FROM gardens WHERE id = ANY(:ids)"), {"ids": [uuid.UUID(g) for g in gardens or []]})).all()
    return [(r[0], r[1]) for r in rows]


async def main() -> None:
    args = parser("Besleme işlerini kaldığı yerden sürdür").parse_args()
    found = await targets(args.user, args.garden)
    if not found:
        raise SystemExit("Kapsamda bahçe yok.")
    async with async_session_factory() as s:
        for gid, name in found:
            for r in (await s.execute(select(FeedRunModel).where(FeedRunModel.garden_id == gid).order_by(FeedRunModel.kaynak))).scalars().all():
                log("durum", bahce=name, kaynak=r.kaynak, durum=r.durum, deneme=r.deneme, kalp_atisi=r.kalp_atisi, hata=r.hata)
    if not args.apply:
        log("dry-run", not_="Hiçbir şey çekilmedi; --apply --yes ile kaldığı yerden devam edilir.")
        return
    path = backup("besleme")
    if not confirm({"bahceler": [n for _, n in found], "yedek": str(path)}, assume_yes=args.yes):
        log("iptal")
        return
    for gid, name in found:
        result = await run_garden_feed(gid)
        log("bitti", bahce=name, sonuc=str(result))
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
