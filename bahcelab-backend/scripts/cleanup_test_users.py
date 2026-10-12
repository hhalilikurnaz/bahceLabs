"""Uçtan uca test artıklarını siler: YALNIZCA `e2e-*@example.test` kullanıcıları, çalışma alanları, bahçeleri ve dosyaları.

Varsayılan dry-run. Koruma listesi (allowlist): --keep (varsayılan test@bahcelab.com) — bu kullanıcıların çalışma alanına değen
hiçbir kayıt silinmez; kapsamda korunan bir bahçe çıkarsa betik durur.
  python scripts/cleanup_test_users.py                 # sayılar
  python scripts/cleanup_test_users.py --apply         # yedek + onay + silme
"""

import argparse
import asyncio

from guard import backup, confirm, log  # type: ignore[import-not-found]
from sqlalchemy import text

from bahcelab_backend.database import async_session_factory, engine
from bahcelab_backend.domain.ndvi.persist import storage_prefix
from bahcelab_backend.shared.storage import get_storage

PATTERN = "e2e-%@example.test"  # tek izinli kapsam (değiştirilemez)

TARGET_WS = (
    "SELECT DISTINCT m.workspace_id FROM workspace_members m JOIN users u ON u.id = m.user_id WHERE u.email LIKE :p "
    "AND m.workspace_id NOT IN (SELECT m2.workspace_id FROM workspace_members m2 JOIN users u2 ON u2.id = m2.user_id WHERE u2.email = ANY(:keep))"
)


async def main() -> None:
    ap = argparse.ArgumentParser(description="e2e test artıklarını sil")
    ap.add_argument("--keep", action="append", default=None, help="Korunacak e-posta (birden çok); varsayılan test@bahcelab.com")
    ap.add_argument("--keep-garden", action="append", default=["jlnnlk", "soğuk hava"], help="Kapsamda görülürse betiği durduracak bahçe adı")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--yes", action="store_true")
    args = ap.parse_args()
    keep = args.keep or ["test@bahcelab.com"]
    p = {"p": PATTERN, "keep": keep}
    async with async_session_factory() as s:
        ws = [r[0] for r in (await s.execute(text(TARGET_WS), p)).all()]
        gardens = (await s.execute(text("SELECT id, ad FROM gardens WHERE workspace_id = ANY(:w)"), {"w": ws})).all()
        guarded = [n for _, n in gardens if n in args.keep_garden]
        own = (await s.execute(text("SELECT count(*) FROM gardens g JOIN workspace_members m ON m.workspace_id = g.workspace_id JOIN users u ON u.id = m.user_id WHERE u.email = ANY(:keep)"), {"keep": keep})).scalar_one()
        gids = [g for g, _ in gardens]
        summary = {
            "kapsam": PATTERN,
            "korunan_eposta": keep,
            "korunan_kullanici_bahce_sayisi": own,
            "kullanici": (await s.execute(text("SELECT count(*) FROM users WHERE email LIKE :p AND email <> ALL(:keep)"), p)).scalar_one(),
            "calisma_alani": len(ws),
            "bahce": len(gids),
            "sahne_gozlemi": (await s.execute(text("SELECT count(*) FROM scene_observations WHERE garden_id = ANY(:g)"), {"g": gids})).scalar_one(),
            "indeks_gozlemi": (await s.execute(text("SELECT count(*) FROM index_observations WHERE garden_id = ANY(:g)"), {"g": gids})).scalar_one(),
            "kip": "uygula" if args.apply else "dry-run",
        }
        if guarded:
            raise SystemExit(f"Durduruldu: korunan bahçe kapsamda görünüyor: {guarded}")
        if not args.apply:
            log("dry-run", **summary)
            return
        path = backup("cleanup-e2e")
        if not confirm({**summary, "yedek": str(path)}, assume_yes=args.yes):
            log("iptal")
            return
        await s.execute(text("DELETE FROM workspaces WHERE id = ANY(:w)"), {"w": ws})  # bahçe ve bağlı kayıtlar ON DELETE CASCADE
        await s.execute(text("DELETE FROM users WHERE email LIKE :p AND email <> ALL(:keep)"), p)
        await s.commit()
    storage = get_storage()
    for gid in gids:
        storage.delete_prefix(storage_prefix(gid))
        storage.delete_prefix(f"multiyear/{gid}")
    log("silindi", **summary, yedek=str(path))
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
