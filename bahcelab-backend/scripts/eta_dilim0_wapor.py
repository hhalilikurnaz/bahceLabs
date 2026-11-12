"""9I Dilim 0 (spike): WaPOR v3 L2-AETI-D (100 m, dekadal) jlnnlk penceresi. Gerçek veri: /vsicurl ile küçük pencere okunur. Yalnız okur."""
import json
import sys

import numpy as np
import rasterio
from rasterio.features import geometry_mask
from rasterio.windows import from_bounds
from shapely.geometry import mapping, shape

geo = json.loads(open("/tmp/jl-geom.txt").read().split("|")[0])
g = shape(geo)
liste = json.load(open("/tmp/wapor-l2-list.json"))
sonuc = []
for r in sorted(liste, key=lambda r: r["bas"]):
    if r["bas"] < "2024-11-01":
        continue
    try:
        with rasterio.Env(GDAL_HTTP_MULTIRANGE="YES", GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR"), rasterio.open(r["url"]) as src:
            pad = 0.004
            w = from_bounds(g.bounds[0] - pad, g.bounds[1] - pad, g.bounds[2] + pad, g.bounds[3] + pad, transform=src.transform)
            w = w.round_offsets().round_lengths()
            a = src.read(1, window=w).astype("float64")
            tr = src.window_transform(w)
            nod = src.nodata
            ic = ~geometry_mask([mapping(g)], out_shape=a.shape, transform=tr)
            dk = ~geometry_mask([mapping(g)], out_shape=a.shape, transform=tr, all_touched=True)
            a[(a == nod) | (a < 0)] = np.nan if nod is not None else a[a < 0]
            v = a[ic]; v = v[np.isfinite(v)]
            vd = a[dk]; vd = vd[np.isfinite(vd)]
            pxm = abs(src.transform.a) * 111320 * np.cos(np.radians(36.66))
            sonuc.append({"bas": r["bas"], "bit": r["bit"], "piksel_merkez": int(ic.sum()), "piksel_dokunan": int(dk.sum()), "gecerli_dokunan": int(len(vd)), "aetia_mm_gun": float(np.mean(vd) * 0.1) if len(vd) else None, "piksel_m": round(pxm, 1), "ham_ort": float(np.mean(vd)) if len(vd) else None, "nodata": nod})
            print(sonuc[-1], file=sys.stderr)
    except Exception as e:  # noqa: BLE001
        sonuc.append({"bas": r["bas"], "hata": str(e)[:160]})
        print(sonuc[-1], file=sys.stderr)
json.dump(sonuc, open(sys.argv[1], "w"), ensure_ascii=False, indent=1)
