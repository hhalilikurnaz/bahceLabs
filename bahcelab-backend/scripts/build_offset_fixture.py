"""GELİŞTİRİCİ ARACI (ağ gerekir): ofset süreklilik testi için gerçek sahne fikstürü üretir.
2022-01-25 (işleme sürümü 04.00) öncesi ve sonrası iki net sahneden bahçe penceresinin kırmızı/NIR ham sayısal değerlerini ve ürün
meta verisinin radyometri bölümünü `tests/fixtures/offset/` altına yazar. Kullanım: python scripts/build_offset_fixture.py <boylam> <enlem>"""

import json
import math
import re
import sys
from datetime import date
from pathlib import Path

import httpx
import numpy as np
import planetary_computer
import rasterio
from pyproj import Geod
from pystac_client import Client
from rasterio.warp import transform_geom
from rasterio.windows import from_bounds
from shapely.geometry import shape

OUT = Path(__file__).resolve().parent.parent / "tests" / "fixtures" / "offset"
STAC = "https://planetarycomputer.microsoft.com/api/stac/v1"


def square(lng: float, lat: float, side: float = 120.0) -> dict:
    g = Geod(ellps="WGS84")
    ring = [list(g.fwd(lng, lat, az, side * math.sqrt(2) / 2)[:2]) for az in (225, 315, 45, 135)]
    return {"type": "Polygon", "coordinates": [[*ring, ring[0]]]}


def pick(client: Client, geom: dict, start: str, end: str):
    items = [i for i in client.search(collections=["sentinel-2-l2a"], intersects=geom, datetime=f"{start}/{end}", query={"eo:cloud_cover": {"lt": 5}}, max_items=40).items()]
    return sorted(items, key=lambda i: i.properties["eo:cloud_cover"])[0]


def radiometry_excerpt(xml: str) -> str:
    keep = re.findall(r"<BOA_QUANTIFICATION_VALUE[^>]*>[^<]*</BOA_QUANTIFICATION_VALUE>|<BOA_ADD_OFFSET [^>]*>[^<]*</BOA_ADD_OFFSET>|<PROCESSING_BASELINE>[^<]*</PROCESSING_BASELINE>", xml)
    return "<n1:Level-2A_User_Product>\n" + "\n".join(keep) + "\n</n1:Level-2A_User_Product>\n"


def main(lng: float, lat: float) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    geom = square(lng, lat)
    client = Client.open(STAC)
    meta = {}
    for name, (a, b) in {"once": ("2021-11-01", "2022-01-20"), "sonra": ("2022-01-26", "2022-04-15")}.items():
        item = planetary_computer.sign(pick(client, geom, a, b))
        xml = httpx.get(item.assets["product-metadata"].href, timeout=60).text
        (OUT / f"{name}_MTD.xml").write_text(radiometry_excerpt(xml), encoding="utf-8")
        arrays = {}
        for band in ("B04", "B08"):
            with rasterio.open(item.assets[band].href) as src:
                bounds = shape(transform_geom("EPSG:4326", src.crs, geom)).bounds
                arrays[band] = src.read(1, window=from_bounds(*bounds, transform=src.transform)).astype(np.uint16)
        np.savez_compressed(OUT / f"{name}.npz", **arrays)
        meta[name] = {"id": item.id, "tarih": str(item.datetime.date() if item.datetime else date.min), "bulut": item.properties["eo:cloud_cover"], "surum": item.properties.get("s2:processing_baseline")}
    (OUT / "sahneler.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(meta, ensure_ascii=False))


if __name__ == "__main__":
    main(float(sys.argv[1]), float(sys.argv[2]))
