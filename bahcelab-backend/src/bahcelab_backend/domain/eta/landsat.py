"""Landsat 8/9 C2 L2 → termal ETa girdileri (Planetary Computer). `TermalSahneSaglayici`: LST (ST_B10), ST_QA belirsizliği, NDVI (SR_B5/B4),
QA_PIXEL maskesi, Copernicus DEM. Ürün 30 m'ye yeniden örneklenmiştir; FİZİKSEL termal çözünürlük 100 m (`termal_m`).
"""

from __future__ import annotations

import logging
from datetime import date
from typing import Any

import numpy as np
import planetary_computer
import rasterio
from pystac import Item
from pystac_client import Client
from rasterio.features import geometry_mask
from rasterio.warp import Resampling, reproject, transform_geom
from rasterio.windows import Window, from_bounds
from shapely.geometry import mapping, shape

from bahcelab_backend.domain.eta.provider import SahneRef, TermalSahne
from bahcelab_backend.domain.imagery.landsat import qa_valid_mask
from bahcelab_backend.domain.imagery.sentinel2 import _GDAL_ENV, STAC_URL, with_retry

logger = logging.getLogger(__name__)
COLLECTION = "landsat-c2-l2"


class LandsatTermalSaglayici:
    kaynak_id = "landsat-ssebop"
    termal_m = 100.0

    def ara(self, geometry: dict[str, Any], bas: date, bit: date) -> list[SahneRef]:
        def _ara() -> list[Item]:
            return list(Client.open(STAC_URL).search(collections=[COLLECTION], intersects=geometry, datetime=f"{bas}/{bit}", query={"platform": {"in": ["landsat-8", "landsat-9"]}}).items())

        out = []
        for it in with_retry(_ara):
            if it.datetime is None or "lwir11" not in it.assets:
                continue
            out.append(SahneRef(it.datetime.date(), it.id, str(it.properties.get("platform", "")), it))
        return sorted(out, key=lambda r: (r.tarih, r.sahne_id))

    def oku(self, ref: SahneRef, geometry: dict[str, Any], *, ic_tampon_m: float, pencere_yari_m: float) -> TermalSahne:
        return with_retry(lambda: _oku(ref, geometry, ic_tampon_m, pencere_yari_m))


_DEM_ONBELLEK: dict[tuple[Any, ...], np.ndarray] = {}


def _dem(shape_hw: tuple[int, int], crs: Any, tr: Any, orta_xy: tuple[float, float], yari_m: float) -> np.ndarray:
    anahtar = (str(crs), tuple(round(x, 3) for x in tr.to_gdal()), shape_hw)
    if anahtar in _DEM_ONBELLEK:  # aynı WRS-2 karesi/pencere her sahnede aynı ızgara: DEM bir kez okunur
        return _DEM_ONBELLEK[anahtar]
    pt = shape(transform_geom(crs, "EPSG:4326", mapping(shape({"type": "Point", "coordinates": orta_xy}).buffer(yari_m * 1.2))))
    its = list(Client.open(STAC_URL).search(collections=["cop-dem-glo-30"], intersects=mapping(pt)).items())
    out = np.full(shape_hw, np.nan, dtype="float32")
    for it in its:
        with rasterio.Env(**_GDAL_ENV), rasterio.open(planetary_computer.sign(it.assets["data"].href)) as s:
            tmp = np.full(shape_hw, np.nan, dtype="float32")
            reproject(rasterio.band(s, 1), tmp, dst_transform=tr, dst_crs=crs, resampling=Resampling.bilinear, dst_nodata=np.nan)
            out = np.where(np.isfinite(tmp), tmp, out)
    _DEM_ONBELLEK[anahtar] = out
    return out


def _oku(ref: SahneRef, geometry: dict[str, Any], ic_tampon_m: float, yari_m: float) -> TermalSahne:
    item: Item = ref.handle
    g_wgs = shape(geometry)
    href = {k: planetary_computer.sign(item.assets[k].href) for k in ("lwir11", "red", "nir08", "qa_pixel") if k in item.assets}
    st_qa = planetary_computer.sign(item.assets["st_qa"].href) if "st_qa" in item.assets else None
    with rasterio.Env(**_GDAL_ENV), rasterio.open(href["lwir11"]) as s:
        c = shape(transform_geom("EPSG:4326", s.crs, mapping(g_wgs.centroid))).coords[0]
        w = from_bounds(c[0] - yari_m, c[1] - yari_m, c[0] + yari_m, c[1] + yari_m, transform=s.transform).round_offsets().round_lengths()
        w = w.intersection(Window(0, 0, s.width, s.height))
        crs, tr = s.crs, s.window_transform(w)
        dn = s.read(1, window=w)
        scale, offset = (item.assets["lwir11"].extra_fields.get("raster:bands") or [{}])[0].get("scale", 0.00341802), (item.assets["lwir11"].extra_fields.get("raster:bands") or [{}])[0].get("offset", 149.0)
    arr: dict[str, np.ndarray] = {}
    for k in ("red", "nir08", "qa_pixel"):
        with rasterio.Env(**_GDAL_ENV), rasterio.open(href[k]) as s2:
            arr[k] = s2.read(1, window=w)
    sigma = None
    if st_qa:
        with rasterio.Env(**_GDAL_ENV), rasterio.open(st_qa) as s3:
            sigma = np.where(s3.read(1, window=w).astype("float64") <= 0, np.nan, s3.read(1, window=w).astype("float64") * 0.01)  # ST_QA ölçek 0,01 K
    lst = np.where(dn == 0, np.nan, dn * float(scale) + float(offset))
    sr = lambda x: np.where(x == 0, np.nan, x.astype("float64") * 0.0000275 - 0.2)  # noqa: E731
    red, nir = sr(arr["red"]), sr(arr["nir08"])
    with np.errstate(invalid="ignore", divide="ignore"):
        ndvi = (nir - red) / (nir + red)
    gecerli = qa_valid_mask(arr["qa_pixel"]) & np.isfinite(lst) & np.isfinite(ndvi)
    g = shape(transform_geom("EPSG:4326", crs, geometry))
    bahce = ~geometry_mask([mapping(g)], out_shape=lst.shape, transform=tr)
    ic = ~geometry_mask([mapping(g.buffer(-ic_tampon_m))], out_shape=lst.shape, transform=tr) if g.buffer(-ic_tampon_m).area > 0 else np.zeros_like(bahce)
    dem = _dem(lst.shape, crs, tr, (float(c[0]), float(c[1])), yari_m)
    return TermalSahne(ref=ref, termal_m=100.0, lst_k=lst, sigma_lst_k=sigma, ndvi=ndvi, gecerli=gecerli, dem_m=dem, bahce=bahce, ic=ic, piksel_m=30.0)
