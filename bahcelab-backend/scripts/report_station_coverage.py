"""İstasyon KAPSAMA raporu (SALT OKUNUR, ağ): bahçe çevresindeki Meteostat istasyonları, gözlem aralığı/oranı ve verinin tazeliği (docs/agro/istasyon-kapsami.md).

Gözlem = değer kaynağı yerinde ölçüm (`OBSERVED_SOURCES`, ör. GHCN-Daily); tahmin/model (`metno_forecast` …) gözlem sayılmaz. Oran = 2015-01-01'den (ya da istasyonun ilk gözleminden) SON GÖZLEM gününe kadar takvim günlerinin gözlemli payı.
  python scripts/report_station_coverage.py --lat 36.664 --lng 34.380 [--km 80] [--ek-km 200] [--cikti ../docs/agro/istasyon-kapsami.md]
"""

import argparse
import asyncio
import csv
import gzip
import io
import json
from datetime import UTC, date, datetime

import httpx

from bahcelab_backend.domain.evidence.providers import (
    BULK,
    DATA_HOST,
    OBSERVED_SOURCES,
    haversine_km,
)

START = date(2015, 1, 1)


async def station_stats(client: httpx.AsyncClient, sid: str, today: date) -> dict:
    tmin_days: set[date] = set()
    prcp_days: set[date] = set()
    sources: dict[str, int] = {}
    modified = None
    for year in range(START.year, today.year + 1):
        r = await client.get(f"{DATA_HOST}/{year}/{sid}.csv.gz", timeout=60)
        if r.status_code == 404:
            continue
        r.raise_for_status()
        modified = r.headers.get("last-modified") or modified
        for row in csv.DictReader(io.StringIO(gzip.decompress(r.content).decode())):
            day = date(int(row["year"]), int(row["month"]), int(row["day"]))
            for field, bag in (("tmin", tmin_days), ("prcp", prcp_days)):
                src = row.get(f"{field}_source") or ""
                if row.get(field) not in ("", None):
                    sources[src] = sources.get(src, 0) + 1
                    if src in OBSERVED_SOURCES:
                        bag.add(day)
    all_obs = tmin_days | prcp_days
    if not all_obs:
        return {"var": False, "modified": modified, "kaynaklar": sources}
    first, last = max(min(all_obs), START), max(all_obs)
    span = (last - first).days + 1
    return {"var": True, "ilk": first, "son": last, "tmin": len([d for d in tmin_days if first <= d <= last]) / span, "prcp": len([d for d in prcp_days if first <= d <= last]) / span, "modified": modified, "kaynaklar": sources}


def row_of(km: float, s: dict, st: dict, today: date) -> str:
    inv = (s.get("inventory") or {}).get("daily") or {}
    rakim = (s.get("location") or {}).get("elevation")
    legacy = f"{inv.get('start')} → {inv.get('end')}" if inv.get("start") else "günlük envanter yok"
    if not st["var"]:
        return f"| {s['id']} | {s['name']['en']} | {km:.1f} | {rakim} | gözlem yok | — | — | — | {legacy} |"
    return f"| {s['id']} | {s['name']['en']} | {km:.1f} | {rakim} | {st['ilk']} → {st['son']} (son gözlem {(today - st['son']).days} gün önce) | %{st['tmin'] * 100:.0f} | %{st['prcp'] * 100:.0f} | {st['modified']} | {legacy} |"


async def main(lat: float, lng: float, km: float, ek_km: float, out: str | None) -> None:
    today = datetime.now(UTC).date()
    async with httpx.AsyncClient() as client:
        lite = await client.get(f"{BULK}/stations/lite.json.gz", timeout=60)
        lite.raise_for_status()
        listed = lite.headers.get("last-modified")
        stations = json.loads(gzip.decompress(lite.content))
        head = await client.head(f"{BULK}/daily/17340.csv.gz", timeout=30)
        legacy_modified = head.headers.get("last-modified")
        near = sorted(((haversine_km(lat, lng, s["location"]["latitude"], s["location"]["longitude"]), s) for s in stations if (s.get("location") or {}).get("latitude") is not None), key=lambda x: x[0])
        lines = [f"# İstasyon kapsamı ({today})", "", f"Merkez: {lat:.3f}N {lng:.3f}E · kaynak: Meteostat (istasyon listesi `bulk.meteostat.net/v2/stations/lite.json.gz`, son güncelleme {listed}; günlük veri `data.meteostat.net/daily/<yıl>/<id>.csv.gz`).", "Gözlem = yerinde ölçüm kaynağı (GHCN-Daily vb.); tahmin/model değeri sayılmaz. Oran: 2015'ten (ya da ilk gözlemden) son gözleme kadar takvim günlerinin gözlemli payı.", ""]
        for title, lo, hi in ((f"## {km:.0f} km içi (ön doğrulamada KULLANILAN alan)", 0, km), (f"## {km:.0f}–{ek_km:.0f} km (yalnız bilgi; kullanılmıyor)", km, ek_km)):
            lines += [title, "", "| Kimlik | Ad | Uzaklık km | Rakım m | Gözlem aralığı | tmin gözlem oranı | yağış gözlem oranı | Veri dosyası son değişiklik | Eski envanter (günlük) |", "|---|---|---:|---:|---|---:|---:|---|---|"]
            chosen = [(d, s) for d, s in near if lo < d <= hi or (lo == 0 and d <= hi)]
            for d, s in chosen:
                if not ((s.get("inventory") or {}).get("daily") or {}).get("start"):
                    continue
                lines.append(row_of(d, s, await station_stats(client, s["id"], today), today))
            if len(lines[-1].split("|")) < 5:
                lines.append("| — | istasyon yok | | | | | | | |")
            lines.append("")
        lines += ["## Tazelik", "", f"- Eski toplu dosya `bulk.meteostat.net/v2/daily/17340.csv.gz` son değişiklik: **{legacy_modified}** (bugün {today}); yeni sunucu `data.meteostat.net` dosyaları güncel (yukarıdaki son değişiklik sütunu).", "- «Eski envanter» sütunu eski listenin (Mart 2026'da dondu) günlük aralığıdır; gerçek son gözlem günü yeni dosyalardan hesaplanır."]
    text = "\n".join(lines) + "\n"
    if out:
        with open(out, "w", encoding="utf-8") as fh:
            fh.write(text)
    print(text)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--lat", type=float, required=True)
    ap.add_argument("--lng", type=float, required=True)
    ap.add_argument("--km", type=float, default=80)
    ap.add_argument("--ek-km", type=float, default=200)
    ap.add_argument("--cikti")
    a = ap.parse_args()
    asyncio.run(main(a.lat, a.lng, a.km, a.ek_km, a.cikti))
