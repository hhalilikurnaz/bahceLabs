"""Sentinel-2 L2A arşivinin bir bahçe için gerçek başlangıcını ve yıl başına sahne sayısını ölçer (rapor için).
Kullanım: python scripts/measure_archive.py <boylam> <enlem>   (ağ gerekir; Planetary Computer STAC)"""

import sys
from datetime import date

from pystac_client import Client

STAC_URL = "https://planetarycomputer.microsoft.com/api/stac/v1"


def main(lng: float, lat: float) -> None:
    d = 0.0005
    geometry = {"type": "Polygon", "coordinates": [[[lng - d, lat - d], [lng + d, lat - d], [lng + d, lat + d], [lng - d, lat + d], [lng - d, lat - d]]]}
    client = Client.open(STAC_URL)
    first = None
    print("| Yıl | Tarih sayısı | Bulut ≤ %30 | Bulut ≤ %10 | Analiz penceresi (Haz–Eyl) bulut ≤ %30 |\n|---|---|---|---|---|")
    for year in range(2015, date.today().year + 1):
        items = list(client.search(collections=["sentinel-2-l2a"], intersects=geometry, datetime=f"{year}-01-01/{year}-12-31", max_items=800).items())
        by_day: dict[date, float] = {}
        for item in items:
            if item.datetime is None:
                continue
            day = item.datetime.date()
            cloud = float(item.properties.get("eo:cloud_cover", 100.0))
            by_day[day] = min(cloud, by_day.get(day, 100.0))
        if by_day and first is None:
            first = min(by_day)
        window = [c for d, c in by_day.items() if 6 <= d.month <= 9]
        print(f"| {year} | {len(by_day)} | {sum(1 for c in by_day.values() if c <= 30)} | {sum(1 for c in by_day.values() if c <= 10)} | {sum(1 for c in window if c <= 30)} |")
    print(f"\nİlk sahne tarihi: {first}")


if __name__ == "__main__":
    main(float(sys.argv[1]), float(sys.argv[2]))
