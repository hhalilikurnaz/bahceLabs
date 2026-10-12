"""Belirli bir kullanıcıyı (kendi çalışma alanıyla) ve/veya belirli bahçeleri siler. Varsayılan dry-run.

Kapsam zorunludur: --user (e-posta, birden çok) ve/veya --garden (kimlik, birden çok). Kullanıcı silinirse çalışma alanı ve bahçeleri de
gider; çalışma alanında başka kullanıcı varsa betik durur. Koruma: --keep-garden adlı bahçeler silinemez.
  python scripts/delete_scope.py --user zz2@example.test --garden <id>            # sayılar
  python scripts/delete_scope.py --user zz2@example.test --garden <id> --apply    # yedek + onay + silme
"""

import argparse
import asyncio
import uuid

from guard import backup, confirm, log  # type: ignore[import-not-found]
from sqlalchemy import text

from bahcelab_backend.database import async_session_factory, engine
from bahcelab_backend.domain.ndvi.persist import storage_prefix
from bahcelab_backend.shared.storage import get_storage


async def main() -> None:
    ap = argparse.ArgumentParser(description="Kapsamlı silme (kullanıcı / bahçe)")
    ap.add_argument("--user", action="append", default=[], help="Silinecek kullanıcı e-postası")
    ap.add_argument("--garden", action="append", default=[], help="Silinecek bahçe kimliği")
    ap.add_argument("--keep-garden", action="append", default=["jlnnlk", "soğuk hava"], help="Silinemeyecek bahçe adı")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--yes", action="store_true")
    args = ap.parse_args()
    if not args.user and not args.garden:
        raise SystemExit("Kapsam zorunlu: --user ve/veya --garden")
    async with async_session_factory() as s:
        users = (await s.execute(text("SELECT id, email FROM users WHERE email = ANY(:e)"), {"e": args.user})).all()
        ws: list[uuid.UUID] = []
        for uid, email in users:
            rows = (await s.execute(text("SELECT workspace_id FROM workspace_members WHERE user_id = :u"), {"u": uid})).all()
            for (wid,) in rows:
                members = (await s.execute(text("SELECT count(*) FROM workspace_members WHERE workspace_id = :w"), {"w": wid})).scalar_one()
                if members > 1:
                    raise SystemExit(f"Durduruldu: {email} çalışma alanını başkalarıyla paylaşıyor.")
                ws.append(wid)
        garden_ids = [uuid.UUID(g) for g in args.garden]
        in_ws = (await s.execute(text("SELECT id FROM gardens WHERE workspace_id = ANY(:w)"), {"w": ws})).all()
        all_ids = sorted({*garden_ids, *(r[0] for r in in_ws)})
        names = (await s.execute(text("SELECT id, ad FROM gardens WHERE id = ANY(:g)"), {"g": all_ids})).all()
        guarded = [n for _, n in names if n in args.keep_garden]
        if guarded:
            raise SystemExit(f"Durduruldu: korunan bahçe kapsamda: {guarded}")
        count = lambda t: s.execute(text(f"SELECT count(*) FROM {t} WHERE garden_id = ANY(:g)"), {"g": all_ids})  # noqa: E731
        summary = {
            "kullanicilar": [e for _, e in users], "calisma_alanlari": len(ws), "bahceler": [n for _, n in names],
            "sahne_gozlemi": (await count("scene_observations")).scalar_one(), "indeks_gozlemi": (await count("index_observations")).scalar_one(),
            "kip": "uygula" if args.apply else "dry-run",
        }
        if not args.apply:
            log("dry-run", **summary)
            return
        path = backup("delete-scope")
        if not confirm({**summary, "yedek": str(path)}, assume_yes=args.yes):
            log("iptal")
            return
        await s.execute(text("DELETE FROM gardens WHERE id = ANY(:g)"), {"g": all_ids})
        await s.execute(text("DELETE FROM workspaces WHERE id = ANY(:w)"), {"w": ws})
        await s.execute(text("DELETE FROM users WHERE email = ANY(:e)"), {"e": args.user})
        await s.commit()
    storage = get_storage()
    for gid in all_ids:
        storage.delete_prefix(storage_prefix(gid))
        storage.delete_prefix(f"multiyear/{gid}")
    log("silindi", **summary, yedek=str(path))
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
