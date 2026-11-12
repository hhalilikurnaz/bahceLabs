"""9I Dilim 0 (spike): jlnnlk için son 24 ayın Landsat 8/9 C2 L2 sahneleri ve bulutsuz (QA_PIXEL) geçiş sayısı. Yalnız okur (veritabanı/dosya yazmaz).
Kullanım: PYTHONPATH=src .venv/bin/python scripts/eta_dilim0_landsat.py <çıktı.json> [geojson-dosyası]"""
from __future__ import annotations

import json
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta

import planetary_computer
import rasterio
from pystac_client import Client
from rasterio.features import geometry_mask
from rasterio.warp import transform_geom
from shapely.geometry import mapping, shape

from bahcelab_backend.domain.imagery.landsat import qa_valid_mask
from bahcelab_backend.domain.imagery.sentinel2 import _GDAL_ENV, STAC_URL, with_retry

geo = json.loads(open(sys.argv[2] if len(sys.argv) > 2 else "/tmp/jl-geom.txt").read().split("|")[0])
BUGUN = date(2026, 11, 12)
BAS = BUGUN - timedelta(days=730)


def ara():
    c = Client.open(STAC_URL)
    return list(c.search(collections=["landsat-c2-l2"], intersects=geo, datetime=f"{BAS}/{BUGUN}", query={"platform": {"in": ["landsat-8", "landsat-9"]}}).items())


items = with_retry(ara)
print("sahne (öğe) sayısı:", len(items), file=sys.stderr)


def oku(it):
    try:
        href = planetary_computer.sign(it.assets["qa_pixel"].href)
        with rasterio.Env(**_GDAL_ENV), rasterio.open(href) as src:
            g = shape(transform_geom("EPSG:4326", src.crs, geo))
            kutu = g.buffer(60).bounds
            from rasterio.windows import Window, from_bounds
            w = from_bounds(*kutu, transform=src.transform).round_offsets(op="floor").round_lengths(op="ceil").intersection(Window(0, 0, src.width, src.height))
            qa = src.read(1, window=w)
            tr = src.window_transform(w)
            ic = ~geometry_mask([mapping(g)], out_shape=qa.shape, transform=tr, all_touched=False)
            iç15 = ~geometry_mask([mapping(g.buffer(-15))], out_shape=qa.shape, transform=tr, all_touched=False)
        gecerli = qa_valid_mask(qa)
        n = int(ic.sum())
        n15 = int(iç15.sum())
        return {
            "id": it.id,
            "tarih": it.datetime.date().isoformat(),
            "platform": it.properties.get("platform"),
            "yol_satir": f"{it.properties.get('landsat:wrs_path')}/{it.properties.get('landsat:wrs_row')}",
            "bulut_sahne": it.properties.get("eo:cloud_cover"),
            "piksel_30m": n,
            "gecerli_oran": float((gecerli & ic).sum() / n) if n else None,
            "piksel_ic15": n15,
            "gecerli_oran_ic15": float((gecerli & iç15).sum() / n15) if n15 else None,
            "lwir11": "lwir11" in it.assets,
        }
    except Exception as e:  # noqa: BLE001
        return {"id": it.id, "tarih": it.datetime.date().isoformat(), "hata": str(e)[:160]}


with ThreadPoolExecutor(6) as ex:
    sonuc = list(ex.map(oku, items))
json.dump(sorted(sonuc, key=lambda r: r["tarih"]), open(sys.argv[1], "w"), ensure_ascii=False, indent=1)
print("tamam", len(sonuc), "hatalı", sum(1 for r in sonuc if "hata" in r), file=sys.stderr)
