"""9I Dilim 0 (spike): ECOSTRESS L3T JET (V002/V003) granüllerini jlnnlk için indirir ve bahçe poligonu üzerinde ETdaily istatistiği çıkarır. Yalnız okur."""
import json
import sys
from pathlib import Path

import earthaccess
import numpy as np
import rasterio
from rasterio.features import geometry_mask
from rasterio.warp import transform_geom
from shapely.geometry import mapping, shape

geo = json.loads(open("/tmp/jl-geom.txt").read().split("|")[0])
out = Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
earthaccess.login(strategy="environment")
sonuc = []
for ver in ("002", "003"):
    for g in earthaccess.search_data(short_name="ECO_L3T_JET", version=ver, bounding_box=(34.36, 36.65, 34.40, 36.68), temporal=("2024-11-12", "2026-11-12"), count=100):
        links = g.data_links()
        want = [lk for lk in links if lk.split("_")[-1] in ("ETdaily.tif", "cloud.tif", "water.tif", "ETuncertainty.tif", "ETinstUncertainty.tif")]
        files = earthaccess.download(want, str(out))
        by = {Path(f).name.split("_")[-1][:-4]: str(f) for f in files}
        r = {"surum": ver, "id": g["umm"]["GranuleUR"], "t": g["umm"]["TemporalExtent"]["RangeDateTime"]["BeginningDateTime"]}
        try:
            with rasterio.open(by["ETdaily"]) as src:
                gm = shape(transform_geom("EPSG:4326", src.crs, geo))
                arr = src.read(1).astype("float64")
                nod = src.nodata
                ic = ~geometry_mask([mapping(gm)], out_shape=arr.shape, transform=src.transform, all_touched=False)
                dokun = ~geometry_mask([mapping(gm)], out_shape=arr.shape, transform=src.transform, all_touched=True)
                v = arr[ic]
                v = v[np.isfinite(v) & (v != nod if nod is not None else True)]
                vd = arr[dokun]; vd = vd[np.isfinite(vd)]
                r.update(piksel_merkez=int(ic.sum()), piksel_dokunan=int(dokun.sum()), gecerli=int(len(v)), et_ort_mm=float(np.mean(v)) if len(v) else None, et_min=float(np.min(v)) if len(v) else None, et_max=float(np.max(v)) if len(v) else None, cozunurluk_m=abs(src.transform.a))
            if "cloud" in by:
                with rasterio.open(by["cloud"]) as c:
                    cl = c.read(1)
                    r["bulut_piksel"] = int(np.sum(cl[ic] > 0))
        except Exception as e:  # noqa: BLE001
            r["hata"] = str(e)[:150]
        sonuc.append(r)
        print(r, file=sys.stderr)
json.dump(sonuc, open(out / "ozet.json", "w"), ensure_ascii=False, indent=1)
