"""9I Dilim 0 (spike): termal piksel çözünürlüğü gerçeği. Bahçe poligonu üzerine rastgele konumlu/yönlü kare ızgara (Monte Carlo) bindirilir:
tam içeride piksel sayısı, kesişen piksel sayısı, «saflık» = bahçe alanı / kesişen piksellerin toplam alanı (bahçe dışından gelen sinyal payı = 1 − saflık).
Kullanım: PYTHONPATH=src .venv/bin/python scripts/eta_dilim0_cozunurluk.py <çıktı.json>"""
import json
import sys

import numpy as np
from pyproj import Transformer
from shapely import affinity
from shapely.geometry import Polygon, box, shape

geo = json.loads(open("/tmp/jl-geom.txt").read().split("|")[0])
g = shape(geo)
t = Transformer.from_crs("EPSG:4326", "EPSG:32636", always_xy=True)
gm = Polygon([t.transform(*c) for c in g.exterior.coords])  # metre
rng = np.random.default_rng(42)


def olc(poly: Polygon, hedef_alan_m2: float | None) -> Polygon:
    if hedef_alan_m2 is None:
        return poly
    c = poly.centroid
    k = np.sqrt(hedef_alan_m2 / poly.area)
    return affinity.scale(poly, k, k, origin=c)


def deneme(poly: Polygon, px: float, n: int = 2000) -> dict:
    ic, kes, saf = [], [], []
    c = poly.centroid
    for _ in range(n):
        ox, oy = rng.uniform(0, px, 2)
        ang = rng.uniform(0, 90)
        # poligonu ızgaraya göre döndür/kaydır (ızgara eksen hizalı)
        p = affinity.translate(affinity.rotate(poly, ang, origin=c), ox - c.x % px, oy - c.y % px)
        minx, miny, maxx, maxy = p.bounds
        sayi_tam = sayi_kes = 0
        alan_kes = 0.0
        for i in range(int(np.floor(minx / px)), int(np.ceil(maxx / px)) + 1):
            for j in range(int(np.floor(miny / px)), int(np.ceil(maxy / px)) + 1):
                b = box(i * px, j * px, (i + 1) * px, (j + 1) * px)
                if not b.intersects(p):
                    continue
                sayi_kes += 1
                alan_kes += px * px
                if p.contains(b):
                    sayi_tam += 1
        ic.append(sayi_tam); kes.append(sayi_kes); saf.append(p.area / alan_kes)
    return {"tam_ic_ort": float(np.mean(ic)), "tam_ic_en_az_1_olasilik": float(np.mean(np.array(ic) >= 1)), "kesisen_ort": float(np.mean(kes)), "kesisen_aralik": [int(min(kes)), int(max(kes))], "saflik_ort": float(np.mean(saf)), "saflik_p10": float(np.percentile(saf, 10)), "saflik_p90": float(np.percentile(saf, 90))}


sonuc = {"jlnnlk_alan_m2": gm.area, "boyutlar": {}}
for ad, alan in (("jlnnlk (gerçek)", None), ("5 dekar (örnek)", 5000.0), ("40 dekar (örnek)", 40000.0), ("100 dekar (örnek)", 100000.0)):
    p = olc(gm, alan)
    sonuc["boyutlar"][ad] = {"alan_m2": p.area, **{f"{px} m": deneme(p, px, 800 if px <= 100 else 400) for px in (30, 70, 100, 300)}}
    print(ad, {k: (round(v['tam_ic_ort'], 2), round(v['kesisen_ort'], 1), round(v['saflik_ort'], 2)) for k, v in sonuc["boyutlar"][ad].items() if isinstance(v, dict)}, file=sys.stderr)
json.dump(sonuc, open(sys.argv[1], "w"), ensure_ascii=False, indent=1)
