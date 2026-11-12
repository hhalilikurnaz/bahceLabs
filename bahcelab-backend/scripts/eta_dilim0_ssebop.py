"""9I Dilim 0 (spike): Landsat C2 L2 + ERA5 ile SSEBop-benzeri ETf/ETa (Earth Engine'siz). Yalnız okur; sonuçlar JSON.

ETf = (Th − Ts) / dT ,  Th = Tc + dT ,  Tc = sahne «soğuk referans» yüzey sıcaklığı,  dT = (Rn − G)·rah / (ρ·cp)   (Senay ve ark. 2013; OpenET-SSEBop mantığı)
ETa = ETf × ET0 (ERA5, FAO-56 çim referansı; OpenET ETr kullanır — fark Dilim 0 belgesinde).
Kullanım: PYTHONPATH=src .venv/bin/python scripts/eta_dilim0_ssebop.py <çıktı.json> <tarih> [<tarih> ...]
"""
from __future__ import annotations

import json
import sys
from datetime import date, timedelta

import httpx
import numpy as np
import planetary_computer
import rasterio
from pystac_client import Client
from rasterio.features import geometry_mask
from rasterio.warp import Resampling, reproject, transform_geom
from rasterio.windows import Window, from_bounds
from shapely.geometry import mapping, shape

from bahcelab_backend.domain.imagery.landsat import qa_valid_mask
from bahcelab_backend.domain.imagery.sentinel2 import _GDAL_ENV, STAC_URL, with_retry

geo = json.loads(open("/tmp/jl-geom.txt").read().split("|")[0])
gj = shape(geo)
LON, LAT = gj.centroid.x, gj.centroid.y
KM = 6000  # bölge penceresi yarı genişliği (m)
RAH = 110.0  # s/m (SSEBop sabiti)
CP = 1013.0  # J/kg/K
ALB = 0.23  # referans albedo (SSEBop sıcak koşul)


def era5(bas: date, bit: date) -> dict:
    r = httpx.get(
        "https://archive-api.open-meteo.com/v1/archive",
        params={"latitude": LAT, "longitude": LON, "start_date": bas.isoformat(), "end_date": bit.isoformat(), "timezone": "auto", "models": "era5",
                "daily": "temperature_2m_max,temperature_2m_min,temperature_2m_mean,shortwave_radiation_sum,et0_fao_evapotranspiration,dew_point_2m_mean,precipitation_sum"},
        timeout=90,
    ).json()
    d = r["daily"]
    out = {t: {k: d[k][i] for k in d if k != "time"} for i, t in enumerate(d["time"])}
    return {"elevation": r["elevation"], "gun": out}


def dT_hesapla(e: dict, z: float) -> dict:
    """Günlük dT (K): sıcak (kuru çıplak) koşulda Rn − G = H; rah = 110 s/m. Rn: ERA5 Rs, albedo 0.23, FAO-56 net uzun dalga (ea ← ERA5 çiy noktası)."""
    rs = float(e["shortwave_radiation_sum"])  # MJ/m²/gün
    tmax, tmin, tmean, td = float(e["temperature_2m_max"]), float(e["temperature_2m_min"]), float(e["temperature_2m_mean"]), float(e["dew_point_2m_mean"])
    ea = 0.6108 * np.exp(17.27 * td / (td + 237.3))  # kPa
    j = date.fromisoformat(e["_tarih"]).timetuple().tm_yday
    phi = np.radians(LAT)
    dr = 1 + 0.033 * np.cos(2 * np.pi * j / 365)
    dec = 0.409 * np.sin(2 * np.pi * j / 365 - 1.39)
    ws = np.arccos(-np.tan(phi) * np.tan(dec))
    ra = 24 * 60 / np.pi * 0.0820 * dr * (ws * np.sin(phi) * np.sin(dec) + np.cos(phi) * np.cos(dec) * np.sin(ws))  # MJ/m²/gün (FAO-56 Denk. 21)
    rso = (0.75 + 2e-5 * z) * ra  # açık gök (Denk. 37)
    oran = float(np.clip(rs / rso, 0.3, 1.0))
    rnl = 4.903e-9 * (((tmax + 273.16) ** 4 + (tmin + 273.16) ** 4) / 2) * (0.34 - 0.14 * np.sqrt(ea)) * (1.35 * oran - 0.35)  # Denk. 39
    rn_hot = rs * (1 - ALB) - rnl  # MJ/m²/gün
    rn_w = rn_hot / 0.0864  # W/m²
    p = 101.3 * ((293 - 0.0065 * z) / 293) ** 5.26  # kPa
    rho = p / (1.01 * (tmean + 273.16) * 0.287)  # kg/m³ (FAO-56)
    dt = rn_w * RAH / (rho * CP)
    return {"rs_mj": rs, "rnl_mj": float(rnl), "rn_hot_wm2": float(rn_w), "rho": float(rho), "dT_K": float(dt), "ta_max_K": tmax + 273.15, "ta_mean_K": tmean + 273.15}


def sahne(gun: date):
    cl = Client.open(STAC_URL)
    items = with_retry(lambda: list(cl.search(collections=["landsat-c2-l2"], intersects=geo, datetime=f"{gun}/{gun}", query={"platform": {"in": ["landsat-8", "landsat-9"]}}).items()))
    return items


def oku_pencere(item, ref_src=None):
    href = {k: planetary_computer.sign(item.assets[k].href) for k in ("lwir11", "red", "nir08", "qa_pixel")}
    with rasterio.Env(**_GDAL_ENV), rasterio.open(href["lwir11"]) as s:
        c = shape(transform_geom("EPSG:4326", s.crs, mapping(gj.centroid))).coords[0]
        w = from_bounds(c[0] - KM, c[1] - KM, c[0] + KM, c[1] + KM, transform=s.transform).round_offsets().round_lengths()
        w = w.intersection(Window(0, 0, s.width, s.height))
        crs, tr = s.crs, s.window_transform(w)
        dn = s.read(1, window=w)
    arr = {}
    for k in ("red", "nir08", "qa_pixel"):
        with rasterio.Env(**_GDAL_ENV), rasterio.open(href[k]) as s2:
            arr[k] = s2.read(1, window=w)
    return dn, arr, crs, tr, item


def dem_pencere(shape_hw, crs, tr):
    cl = Client.open(STAC_URL)
    wgs = shape(transform_geom(crs, "EPSG:4326", mapping(shape({"type": "Point", "coordinates": rasterio.transform.xy(tr, shape_hw[0] // 2, shape_hw[1] // 2)}).buffer(KM * 1.2))))
    its = list(cl.search(collections=["cop-dem-glo-30"], intersects=mapping(wgs)).items())
    out = np.full(shape_hw, np.nan, dtype="float32")
    for it in its:
        with rasterio.Env(**_GDAL_ENV), rasterio.open(planetary_computer.sign(it.assets["data"].href)) as s:
            tmp = np.full(shape_hw, np.nan, dtype="float32")
            reproject(rasterio.band(s, 1), tmp, dst_transform=tr, dst_crs=crs, resampling=Resampling.bilinear, dst_nodata=np.nan)
            out = np.where(np.isfinite(tmp), tmp, out)
    return out


def isle(gun_s: str, E: dict, dem_cache: dict) -> dict:
    gun = date.fromisoformat(gun_s)
    items = sahne(gun)
    # bahçeyi tam kapsayan ve en çok geçerli pikseli olan sahne
    best = None
    for it in items:
        try:
            dn, arr, crs, tr, _ = oku_pencere(it)
        except Exception:  # noqa: BLE001
            continue
        g = shape(transform_geom("EPSG:4326", crs, geo))
        ic = ~geometry_mask([mapping(g)], out_shape=dn.shape, transform=tr)
        if ic.sum() == 0:
            continue
        gec = qa_valid_mask(arr["qa_pixel"])
        oran = float((gec & ic).sum() / ic.sum())
        if best is None or oran > best[0]:
            best = (oran, it, dn, arr, crs, tr, g, ic)
    if best is None:
        return {"tarih": gun_s, "hata": "sahne yok"}
    oran, it, dn, arr, crs, tr, g, ic = best
    band = it.assets["lwir11"].extra_fields["raster:bands"][0]
    lst = np.where(dn == 0, np.nan, dn * band["scale"] + band["offset"])  # K
    sr = lambda x: np.where(x == 0, np.nan, x * 0.0000275 - 0.2)  # noqa: E731
    red, nir = sr(arr["red"].astype("float64")), sr(arr["nir08"].astype("float64"))
    ndvi = (nir - red) / (nir + red)
    gec = qa_valid_mask(arr["qa_pixel"]) & np.isfinite(lst) & np.isfinite(ndvi)
    key = (str(crs), tr.to_gdal())
    if key not in dem_cache:
        dem_cache[key] = dem_pencere(lst.shape, crs, tr)
    dem = dem_cache[key]
    zg = float(np.nanmean(dem[ic])) if np.isfinite(dem[ic]).any() else E["elevation"]
    ic15 = ~geometry_mask([mapping(g.buffer(-15))], out_shape=lst.shape, transform=tr)
    e = dict(E["gun"][gun_s]); e["_tarih"] = gun_s
    dT = dT_hesapla(e, zg)
    # soğuk referans: yoğun yeşil (NDVI ≥ 0.7), bahçeyle ±150 m içinde, geçerli piksel
    soguk = gec & (ndvi >= 0.7) & np.isfinite(dem) & (np.abs(dem - zg) <= 150) & ~ic
    n_soguk = int(soguk.sum())
    res = {"tarih": gun_s, "sahne": it.id, "platform": it.properties.get("platform"), "bahce_gecerli_oran": oran, "dem_bahce_m": zg, "n_soguk_piksel": n_soguk, **{k: v for k, v in dT.items()}, "et0_mm": e["et0_fao_evapotranspiration"], "t_ort_C": e["temperature_2m_mean"], "t_max_C": e["temperature_2m_max"]}
    if n_soguk < 200:
        res["hata"] = f"soğuk referans piksel yetersiz ({n_soguk})"
        return res
    lc = lst[soguk]
    tc = {"medyan": float(np.median(lc)), "p25": float(np.percentile(lc, 25)), "p10": float(np.percentile(lc, 10))}
    res["tc_K"] = tc
    res["lst_bahce_K"] = float(np.nanmean(np.where(gec & ic, lst, np.nan)))
    res["lst_bahce_ic15_K"] = float(np.nanmean(np.where(gec & ic15, lst, np.nan))) if (gec & ic15).any() else None
    res["ndvi_bahce"] = float(np.nanmean(np.where(gec & ic, ndvi, np.nan)))
    res["ndvi_bahce_ic15"] = float(np.nanmean(np.where(gec & ic15, ndvi, np.nan))) if (gec & ic15).any() else None
    res["n_bahce_piksel"], res["n_bahce_gecerli"], res["n_ic15"] = int(ic.sum()), int((gec & ic).sum()), int(ic15.sum())
    for ad, t in tc.items():
        etf = np.clip(1 - (lst - t) / dT["dT_K"], 0, 1.05)
        res[f"etf_{ad}"] = float(np.nanmean(np.where(gec & ic, etf, np.nan)))
        res[f"etf_{ad}_ic15"] = float(np.nanmean(np.where(gec & ic15, etf, np.nan))) if (gec & ic15).any() else None
        res[f"eta_{ad}_mm"] = res[f"etf_{ad}"] * e["et0_fao_evapotranspiration"]
    # bölge dağılımı (bağlam): NDVI sınıfı başına ETf (medyan Tc)
    etf_m = np.clip(1 - (lst - tc["medyan"]) / dT["dT_K"], 0, 1.05)
    res["bolge_etf_ndvi"] = {f"{a}-{b}": (float(np.nanmean(etf_m[gec & (ndvi >= a) & (ndvi < b)])) if (gec & (ndvi >= a) & (ndvi < b)).any() else None) for a, b in ((0, .2), (.2, .4), (.4, .6), (.6, .8), (.8, 1.1))}
    return res


if __name__ == "__main__":
    tarihler = sys.argv[2:]
    bas = date.fromisoformat(min(tarihler)) - timedelta(days=1)
    bit = date.fromisoformat(max(tarihler)) + timedelta(days=1)
    E = era5(bas, bit)
    print("ERA5 yükseklik", E["elevation"], file=sys.stderr)
    cache: dict = {}
    sonuc = []
    for t in tarihler:
        r = isle(t, E, cache)
        sonuc.append(r)
        print(json.dumps(r, ensure_ascii=False)[:600], file=sys.stderr)
    json.dump({"era5_yukseklik_m": E["elevation"], "sahneler": sonuc}, open(sys.argv[1], "w"), ensure_ascii=False, indent=1)
