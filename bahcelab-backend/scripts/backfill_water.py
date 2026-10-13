"""Su ve sıcaklık dilimi geçmiş doldurma (ADR 0017): ERA5-Land/ERA5/model, Landsat yüzey sıcaklığı, SMAP/IMERG/CHIRPS doğrulama gözlemleri.

Varsayılan dry-run (mevcut kayıt sayıları). Yeni tablolara yazar; mevcut verilere dokunmaz; idempotenttir (upsert / atlama).
  python scripts/backfill_water.py --garden <id> --kaynak era5 [--baslangic 2015-01-01] --apply --yes
Gizli anahtar (EARTHDATA_TOKEN) yalnız ortamdan/.env.local'dan okunur ve hiçbir yere yazılmaz.
"""

import asyncio
import time
import uuid
from datetime import UTC, date, datetime, timedelta

from guard import backup, confirm, log, parser  # type: ignore[import-not-found]
from sqlalchemy import text

from bahcelab_backend.database import async_session_factory, engine
from bahcelab_backend.domain.gardens import models as _garden_models  # noqa: F401
from bahcelab_backend.domain.water.era5 import Era5Client
from bahcelab_backend.domain.water.era5_sync import ERA5_START, garden_cell, sync_cell
from bahcelab_backend.domain.water.validation_sync import CHIRPS, IMERG, SMAP, sync_validation

SCOPE_SQL = "SELECT g.id, g.ad FROM gardens g JOIN workspace_members m ON m.workspace_id = g.workspace_id JOIN users u ON u.id = m.user_id WHERE u.email = :e"


async def resolve(user: str | None, gardens: list[str] | None) -> list[tuple[uuid.UUID, str]]:
    async with async_session_factory() as s:
        if user:
            rows = (await s.execute(text(SCOPE_SQL), {"e": user})).all()
        else:
            rows = (await s.execute(text("SELECT id, ad FROM gardens WHERE id = ANY(:ids)"), {"ids": [uuid.UUID(g) for g in gardens or []]})).all()
    return [(r[0], r[1]) for r in rows]


async def report_era5(garden_id: uuid.UUID, name: str, seconds: float | None) -> None:
    async with async_session_factory() as s:
        cell, lat, lng = await garden_cell(s, garden_id)
        await s.commit()
        rows = (
            await s.execute(
                text(
                    "SELECT extract(year FROM tarih)::int y, count(*) gun, count(*) FILTER (WHERE toprak_kaynak='era5_land') era5_nem, count(*) FILTER (WHERE toprak_kaynak='model') model_nem, "
                    "count(*) FILTER (WHERE hava_kaynak='era5_land') era5_hava, count(*) FILTER (WHERE yagis_mm IS NULL) yagis_yok FROM era5_daily WHERE cell_id = :c GROUP BY 1 ORDER BY 1"
                ),
                {"c": cell},
            )
        ).all()
    log("rapor", bahce=name, hucre=[lat, lng], sure_sn=None if seconds is None else round(seconds, 1), yillar=[{"yil": r[0], "gun": r[1], "era5_nem": r[2], "model_nem": r[3], "era5_hava": r[4], "yagis_yok": r[5]} for r in rows])


async def run_era5(targets: list[tuple[uuid.UUID, str]], start: date) -> None:
    done: set[uuid.UUID] = set()
    client = Era5Client()
    for gid, name in targets:
        t0 = time.monotonic()
        async with async_session_factory() as s:
            cell, lat, lng = await garden_cell(s, gid)
            await s.commit()
            if cell not in done:
                result = await sync_cell(s, client, cell, lat, lng, start, datetime.now(UTC).date())
                await s.commit()
                done.add(cell)
                log("hucre", bahce=name, hucre=[lat, lng], **result)
        await report_era5(gid, name, time.monotonic() - t0)


SOURCE_OF = {"smap": SMAP, "imerg": IMERG, "chirps": CHIRPS}


async def report_validation(garden_id: uuid.UUID, name: str, seconds: float | None, kaynak: str) -> None:
    async with async_session_factory() as s:
        rows = (await s.execute(text("SELECT extract(year FROM tarih)::int y, count(DISTINCT tarih) gun, count(*) FILTER (WHERE deger IS NULL) bos FROM dogrulama_gozlem WHERE garden_id = :g AND source_id = :s GROUP BY 1 ORDER BY 1"), {"g": garden_id, "s": SOURCE_OF[kaynak]})).all()
    log("rapor", bahce=name, kaynak=kaynak, sure_sn=None if seconds is None else round(seconds, 1), yillar=[{"yil": r[0], "gun": r[1], "bos_deger": r[2]} for r in rows])


async def run_validation(targets: list[tuple[uuid.UUID, str]], kaynak: str, start: date, end: date) -> None:
    for gid, name in targets:
        t0 = time.monotonic()
        async with async_session_factory() as s:
            result = await sync_validation(s, gid, SOURCE_OF[kaynak], start, end)
        log("dogrulama", bahce=name, kaynak=kaynak, **result)
        await report_validation(gid, name, time.monotonic() - t0, kaynak)


async def main() -> None:
    ap = parser("Su ve sıcaklık geçmiş doldurma (ADR 0017)")
    ap.add_argument("--kaynak", choices=("era5", "smap", "imerg", "chirps"), required=True)
    ap.add_argument("--baslangic", default=None, help="varsayılan: era5 2015-01-01; doğrulama kaynakları 2022-01-01")
    ap.add_argument("--bitis", default=None, help="doğrulama kaynakları için; varsayılan: dün")
    args = ap.parse_args()
    targets = await resolve(args.user, args.garden)
    if not targets:
        raise SystemExit("Kapsamda bahçe yok.")
    start = date.fromisoformat(args.baslangic or (ERA5_START.isoformat() if args.kaynak == "era5" else "2022-01-01"))
    summary = {"bahceler": [n for _, n in targets], "kaynak": args.kaynak, "baslangic": start.isoformat(), "kip": "uygula" if args.apply else "dry-run"}
    if not args.apply:
        log("dry-run", **summary)
        for gid, name in targets:
            await (report_era5(gid, name, None) if args.kaynak == "era5" else report_validation(gid, name, None, args.kaynak))
        return
    path = backup("water")
    if not confirm({**summary, "yedek": str(path)}, assume_yes=args.yes):
        log("iptal")
        return
    if args.kaynak == "era5":
        await run_era5(targets, start)
    else:
        await run_validation(targets, args.kaynak, start, date.fromisoformat(args.bitis) if args.bitis else datetime.now(UTC).date() - timedelta(days=1))
    log("bitti", saat=datetime.now(UTC).isoformat(timespec="seconds"))
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
