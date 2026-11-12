"""WaPOR v3 L1-AETI-D (küresel, dekadal, 300 m, mm/gün) BAĞLAM serisi + ECOSTRESS V003 `ETdaily` DOĞRULAMA serisi. İkisi de iç ekran içindir.
WaPOR L2 (100 m, ulusal) Türkiye'yi KAPSAMAZ (Dilim 0, docs/agro/eta-kaynak-dogrulama.md §4) — kullanılmaz.
"""

from __future__ import annotations

import calendar
import logging
import os
from datetime import date
from pathlib import Path
from typing import Any

import numpy as np
import rasterio
from rasterio.features import geometry_mask
from rasterio.windows import from_bounds
from shapely.geometry import mapping, shape

from bahcelab_backend.domain.eta.provider import BaglamNoktasi, DogrulamaNoktasi

logger = logging.getLogger(__name__)
WAPOR_URL = "https://storage.googleapis.com/fao-gismgr-wapor-3-data/DATA/WAPOR-3/MAPSET/L1-AETI-D/WAPOR-3.L1-AETI-D.{y}-{m:02d}-D{k}.tif"
WAPOR_OLCEK = 0.1  # mapset ölçeği: ham × 0,1 = mm/gün
WAPOR_NODATA = -9999.0


def dekadlar(bas: date, bit: date) -> list[tuple[date, date, str]]:
    """[bas, bit] ile örtüşen dekadlar (başlangıç, bitiş, kod). Kod kalıbı: YYYY-MM-D1|D2|D3 (katalog liste uç noktası eksik sayfalar; kodla erişilir)."""
    out = []
    y, m = bas.year, bas.month
    while (y, m) <= (bit.year, bit.month):
        son = calendar.monthrange(y, m)[1]
        for k, (a, b) in enumerate(((1, 10), (11, 20), (21, son)), 1):
            d0, d1 = date(y, m, a), date(y, m, b)
            if d1 >= bas and d0 <= bit:
                out.append((d0, d1, WAPOR_URL.format(y=y, m=m, k=k)))
        m += 1
        if m > 12:
            y, m = y + 1, 1
    return out


def _istatistik(src: Any, g: Any, pad: float = 0.004) -> tuple[int, int, float | None, float]:
    w = from_bounds(g.bounds[0] - pad, g.bounds[1] - pad, g.bounds[2] + pad, g.bounds[3] + pad, transform=src.transform).round_offsets().round_lengths()
    a = src.read(1, window=w).astype("float64")
    tr = src.window_transform(w)
    dk = ~geometry_mask([mapping(g)], out_shape=a.shape, transform=tr, all_touched=True)
    a[(a == WAPOR_NODATA) | (a < 0)] = np.nan
    v = a[dk]
    v = v[np.isfinite(v)]
    piksel_m = abs(src.transform.a) * 111320 * float(np.cos(np.radians(g.centroid.y)))
    return int(dk.sum()), int(len(v)), (float(v.mean() * WAPOR_OLCEK) if len(v) else None), piksel_m


class WaporL1BaglamSaglayici:
    kaynak_id = "wapor-l1"

    def seri(self, geometry: dict[str, Any], bas: date, bit: date) -> list[BaglamNoktasi]:
        g = shape(geometry)
        out: list[BaglamNoktasi] = []
        for d0, d1, url in dekadlar(bas, bit):
            try:
                with rasterio.Env(GDAL_HTTP_MULTIRANGE="YES", GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR"), rasterio.open(url) as src:
                    dok, gec, et, pm = _istatistik(src, g)
                out.append(BaglamNoktasi(d0, d1, et, dok, gec, round(pm, 1)))
            except Exception as e:  # noqa: BLE001 - henüz yayımlanmamış dekad (≈ 2–3 hafta gecikme) 404 verir
                logger.info("WaPOR L1 dekad atlandı (%s): %s", d0, str(e)[:80])
        return out


class EcostressDogrulamaSaglayici:
    """ECO_L3T_JET V003 (varsa) — `ETdaily` (mm/gün). Earthdata belirteci (EARTHDATA_TOKEN) gerekir; yoksa boş seri döner."""

    kaynak_id = "ecostress-v003"

    def seri(self, geometry: dict[str, Any], bas: date, bit: date) -> list[DogrulamaNoktasi]:
        if not os.environ.get("EARTHDATA_TOKEN"):
            return []
        import earthaccess  # ağır içe aktarma yalnız burada

        earthaccess.login(strategy="environment")
        g = shape(geometry)
        kutu = (g.bounds[0] - 0.01, g.bounds[1] - 0.01, g.bounds[2] + 0.01, g.bounds[3] + 0.01)
        out: list[DogrulamaNoktasi] = []
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            for gr in earthaccess.search_data(short_name="ECO_L3T_JET", version="003", bounding_box=kutu, temporal=(bas.isoformat(), bit.isoformat()), count=500):
                links = [lk for lk in gr.data_links() if lk.endswith("_ETdaily.tif")]
                if not links:
                    continue
                f = earthaccess.download(links, tmp)
                from rasterio.warp import transform_geom

                with rasterio.open(f[0]) as src:
                    gm = shape(transform_geom("EPSG:4326", src.crs, geometry))
                    a = src.read(1).astype("float64")
                    ic = ~geometry_mask([mapping(gm)], out_shape=a.shape, transform=src.transform)
                    dk = ~geometry_mask([mapping(gm)], out_shape=a.shape, transform=src.transform, all_touched=True)
                    v = a[ic]
                    nod = src.nodata
                    v = v[np.isfinite(v) & ((v != nod) if nod is not None else True)]
                ur = gr["umm"]["GranuleUR"]
                t = date.fromisoformat(gr["umm"]["TemporalExtent"]["RangeDateTime"]["BeginningDateTime"][:10])
                out.append(DogrulamaNoktasi(t, ur[:96], float(v.mean()) if len(v) else None, int(len(v)), int(dk.sum())))
                Path(f[0]).unlink(missing_ok=True)
        return out
