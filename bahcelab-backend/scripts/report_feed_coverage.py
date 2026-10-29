"""Besleme KAPSAMA raporu (SALT OKUNUR): her bahçe ve kaynak için tarih aralığı ve eksik gün sayısı (docs/agro/besleme-kapsami.md).

Beklenen günler çekim kuralıyla aynıdır: ERA5 günlük (2015-01-01 → dün; ERA5-Land ~5 gün gecikmeli, son günler model değerli), IMERG günlük, SMAP `SMAP_STEP` günde bir (validation_start → dün).
HLS sahne tabanlıdır (3–8 günde bir geçiş): eksik gün yerine en uzun boşluk raporlanır.
  python scripts/report_feed_coverage.py --ad jlnnlk --ad "soğuk hava" [--cikti ../docs/agro/besleme-kapsami.md]
"""

import argparse
import asyncio
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import select, text

from bahcelab_backend.config import get_settings
from bahcelab_backend.database import async_session_factory, engine
from bahcelab_backend.domain.feedruns.models import FeedRunModel
from bahcelab_backend.domain.gardens import models as _garden_models  # noqa: F401
from bahcelab_backend.domain.water.era5_sync import ERA5_START, garden_cell
from bahcelab_backend.domain.water.feed import SMAP_STEP
from bahcelab_backend.domain.water.validation import days_between


def span(have: set[date], expected: list[date]) -> tuple[str, int, str]:
    if not have:
        return "—", len(expected), "veri yok"
    missing = [d for d in expected if d not in have]
    tail = (expected[-1] - max(have)).days if expected else 0
    return f"{min(have):%d.%m.%Y} → {max(have):%d.%m.%Y}", len(missing), f"son gün beklenenden {tail} gün önde" if tail > 0 else "güncel"


async def main() -> None:
    ap = argparse.ArgumentParser(description="Besleme kapsama raporu (salt okunur)")
    ap.add_argument("--ad", action="append", required=True)
    ap.add_argument("--cikti")
    args = ap.parse_args()
    today = datetime.now(UTC).date()
    yesterday = today - timedelta(days=1)
    settings = get_settings()
    lines = [
        "# Besleme kapsama raporu", "",
        f"Üretim: {today:%d.%m.%Y}. Her kaynak için çekilen tarih aralığı ve beklenen günlere göre eksik gün sayısı; «son durum» besleme işinin `feed_runs` kaydıdır. "
        "Son günlerdeki küçük eksikler kaynak gecikmesidir (IMERG Late ~14 saat, SMAP ~2–3 gün, ERA5-Land ~5 gün; ERA5 son günleri model değerlidir).", "",
    ]
    async with async_session_factory() as s:
        for ad in args.ad:
            for gid, name in (await s.execute(text("SELECT id, ad FROM gardens WHERE ad ILIKE :a ORDER BY ad"), {"a": f"%{ad}%"})).all():
                cell, _, _ = await garden_cell(s, gid)
                era5 = {r[0] for r in (await s.execute(text("SELECT tarih FROM era5_daily WHERE cell_id = :c AND toprak_kaynak = 'era5_land' AND tarih <= :t"), {"c": cell, "t": yesterday})).all()}
                era5_any = {r[0] for r in (await s.execute(text("SELECT tarih FROM era5_daily WHERE cell_id = :c AND tarih <= :t"), {"c": cell, "t": yesterday})).all()}
                hls = sorted(r[0] for r in (await s.execute(text("SELECT DISTINCT tarih FROM hls_observations WHERE garden_id = :g AND ndvi IS NOT NULL"), {"g": gid})).all())
                val = {k: {r[0] for r in (await s.execute(text("SELECT DISTINCT tarih FROM dogrulama_gozlem WHERE garden_id = :g AND source_id = :k"), {"g": gid, "k": k})).all()} for k in ("imerg-daily", "smap-l3")}
                runs = {r.kaynak: r for r in (await s.execute(select(FeedRunModel).where(FeedRunModel.garden_id == gid))).scalars().all()}
                v_start = date.fromisoformat(settings.validation_start)
                expected_val = {"imerg-daily": days_between(v_start, yesterday), "smap-l3": [d for i, d in enumerate(days_between(v_start, yesterday)) if i % SMAP_STEP == 0]}
                rows = [("ERA5-Land (günlük hava/toprak)", "era5", *span(era5, days_between(ERA5_START, yesterday))), ("ERA5 (model dâhil)", None, *span(era5_any, days_between(ERA5_START, yesterday)))]
                gaps = max((b - a).days for a, b in zip(hls, hls[1:], strict=False)) if len(hls) > 1 else 0
                rows.append(("HLS canlılık (sahne)", "hls", f"{hls[0]:%d.%m.%Y} → {hls[-1]:%d.%m.%Y}" if hls else "—", 0, f"{len(hls)} gözlem; en uzun boşluk {gaps} gün" if hls else "veri yok"))
                rows.append(("IMERG yağış (günlük)", "imerg", *span(val["imerg-daily"], expected_val["imerg-daily"])))
                rows.append(("SMAP toprak nemi (3 günde bir)", "smap", *span(val["smap-l3"], expected_val["smap-l3"])))
                lines += [f"## {name}", "", "| Kaynak | Tarih aralığı | Eksik gün | Not | Son durum (feed_runs) |", "|---|---|---|---|---|"]
                for label, kaynak, rng, miss, note in rows:
                    run = runs.get(kaynak) if kaynak else None
                    state = f"{run.durum}" + (f" (deneme {run.deneme})" if run and run.deneme else "") + (f" · {run.bitis:%d.%m %H:%M}" if run and run.bitis else "") if run else "—"
                    lines.append(f"| {label} | {rng} | {miss} | {note} | {state} |")
                lines.append("")
    out = "\n".join(lines)
    if args.cikti:
        open(args.cikti, "w", encoding="utf-8").write(out)
    else:
        print(out)
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
