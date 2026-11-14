"""Dilim 0: MODIS gece LST (MOD/MYD11A1, 1 km, Planetary Computer — ücretsiz, anonim imzalı) örnekleyici. Nokta başına, tarih aralığında, yalnız iyi kaliteli (QC_Night&3==0) piksel.
LST hava sıcaklığı DEĞİLDİR; açık-sakin gecede gece LST ile 2 m gece sıcaklığı yüksek korelasyonludur: burada yalnız NOKTALAR ARASI göreli desen (vadi − ova) bağımsız kanıt olarak kullanılır.
Kullanım: python -m scripts.don_dilim0.modis <çıktı.json> <bas> <bit> lat,lon [lat,lon …]"""

import json
import sys
from datetime import date, timedelta

import numpy as np
import planetary_computer as pc
import pystac_client
import rasterio
from pyproj import Transformer
from rasterio.windows import Window

STAC = "https://planetarycomputer.microsoft.com/api/stac/v1"


def _dene(fn, n=6):  # geçici ağ kesintileri (bağlantı sıfırlama) için üstel bekleme
    import time

    for k in range(n):
        try:
            return fn()
        except Exception:  # noqa: BLE001
            if k == n - 1:
                raise
            time.sleep(3 * 2**k)


def ornekle(noktalar: list[tuple[float, float]], bas: date, bit: date) -> list[dict]:
    cat = pystac_client.Client.open(STAC, modifier=pc.sign_inplace)
    out: list[dict] = []
    gun = bas
    while gun <= bit:
        son = min(gun + timedelta(days=29), bit)
        for col in ("modis-11A1-061",):
            items = _dene(lambda: list(cat.search(collections=[col], intersects={"type": "Point", "coordinates": [noktalar[0][1], noktalar[0][0]]}, datetime=f"{gun}/{son}").items()))
            for it in items:
                a = it.assets["LST_Night_1km"]
                q = it.assets["QC_Night"]
                kayit = {"tarih": (it.properties.get("start_datetime") or it.properties.get("datetime"))[:10], "uydu": "Aqua" if it.id.startswith("MYD") else "Terra", "noktalar": []}
                def oku(a=a, q=q, kayit=kayit) -> None:
                    kayit["noktalar"] = []
                    with rasterio.open(a.href) as ds, rasterio.open(q.href) as dq:
                        tr = Transformer.from_crs(4326, ds.crs, always_xy=True)
                        for lat, lon in noktalar:
                            x, y = tr.transform(lon, lat)
                            r, c = ds.index(x, y)
                            v = ds.read(1, window=Window(c, r, 1, 1))[0, 0]
                            qc = dq.read(1, window=Window(c, r, 1, 1))[0, 0]
                            iyi = v > 0 and (int(qc) & 3) == 0
                            kayit["noktalar"].append(float(v) * 0.02 - 273.15 if iyi else None)

                _dene(oku)
                out.append(kayit)
        gun = son + timedelta(days=1)
    return out


if __name__ == "__main__":
    cikti, bas, bit = sys.argv[1], date.fromisoformat(sys.argv[2]), date.fromisoformat(sys.argv[3])
    nok = [tuple(float(x) for x in a.split(",")) for a in sys.argv[4:]]
    veri = ornekle(nok, bas, bit)
    open(cikti, "w").write(json.dumps({"noktalar": nok, "gecisler": veri}))
    ok = [g for g in veri if all(v is not None for v in g["noktalar"])]
    print("geçiş", len(veri), "tüm noktalarda geçerli", len(ok), "ort. fark(son-ilk)", round(float(np.mean([g["noktalar"][-1] - g["noktalar"][0] for g in ok])), 2) if ok else None)
