"""Komşu halka referansı (ADR 0029 eki): halka maskesi (100–300 m, bahçe hariç) ve ağaçlık piksel ölçümü — saf, sentetik raster."""

import numpy as np
from pyproj import Transformer
from rasterio.transform import from_origin

from bahcelab_backend.domain.agro.catalog import load_catalog
from bahcelab_backend.domain.irrigation import sk_halka as h

K = load_catalog().sistem_kontrol
EPSG = 32636
LON, LAT = 34.38, 36.66
T = Transformer.from_crs("EPSG:4326", f"EPSG:{EPSG}", always_xy=True)
GERI = Transformer.from_crs(f"EPSG:{EPSG}", "EPSG:4326", always_xy=True)
CX, CY = T.transform(LON, LAT)
X0, Y1 = round(CX / 10) * 10 - 500, round(CY / 10) * 10 + 500  # 100×100 piksel, 10 m, bahçe ortada
TR = from_origin(X0, Y1, 10, 10)
SHAPE = (100, 100)


def _bahce(yari_m: float = 40.0) -> dict:
    x, y = round(CX / 10) * 10, round(CY / 10) * 10
    halka = [(x - yari_m, y - yari_m), (x + yari_m, y - yari_m), (x + yari_m, y + yari_m), (x - yari_m, y + yari_m), (x - yari_m, y - yari_m)]
    return {"type": "Polygon", "coordinates": [[list(GERI.transform(px, py)) for px, py in halka]]}


def _uzak(yari: float = 0.0) -> np.ndarray:
    """Her pikselin bahçe merkezine (Chebyshev) uzaklığı (m)."""
    r, c = np.indices(SHAPE)
    x = X0 + (c + 0.5) * 10 - round(CX / 10) * 10
    y = Y1 - (r + 0.5) * 10 - round(CY / 10) * 10
    return np.maximum(np.abs(x), np.abs(y))


def test_halka_maskesi_bahce_ve_ic_100_m_haric_300_m_dahil():
    m = h.halka_maskesi(_bahce(40), f"EPSG:{EPSG}", TR, SHAPE, 100.0, 300.0)
    u = _uzak()
    assert not m[u <= 40].any()  # bahçenin kendisi dışarıda
    assert not m[u <= 110].any()  # bahçe sınırından 100 m'ye kadar dışarıda (köşede yuvarlak büyütme: Chebyshev ≥ 110,7)
    assert m[(u > 150) & (u < 250)].mean() > 0.99  # 100–300 m halka dolu (her yönde; uzak köşeler yuvarlak büyütmeyle kırpılır)
    assert not m[u > 360].any()  # 300 m'nin ötesi dışarıda


def test_halka_olcum_agaclik_ve_gecerli_piksel_kurali():
    m = h.halka_maskesi(_bahce(40), f"EPSG:{EPSG}", TR, SHAPE, 100.0, 300.0)
    ndvi = np.full(SHAPE, 0.7)
    ndmi = np.full(SHAPE, 0.35)
    valid = np.ones(SHAPE, dtype=bool)
    o = h.halka_olcum(ndmi, ndvi, valid, m, K)
    assert o[0] == np.float64(0.35) or abs(o[0] - 0.35) < 1e-6
    assert o[2] == int(m.sum()) and o[3] == int(m.sum())
    # yollar / çıplak toprak (NDVI < 0,5) halkadan çıkar
    ndvi2 = ndvi.copy()
    ndvi2[:, :50] = 0.2
    ndmi2 = ndmi.copy()
    ndmi2[:, :50] = 0.05
    o2 = h.halka_olcum(ndmi2, ndvi2, valid, m, K)
    assert abs(o2[0] - 0.35) < 1e-6 and o2[2] < int(m.sum())  # yalnız ağaçlık pikseller ortalamaya girer
    # bulut/gölge (SCL geçersiz) çıkar; < 30 geçerli ağaçlık piksel → ortalama YOK (işaret üretilmez)
    valid3 = np.zeros(SHAPE, dtype=bool)
    valid3.flat[np.flatnonzero(m)[:12]] = True
    o3 = h.halka_olcum(ndmi, ndvi, valid3, m, K)
    assert o3[0] is None and o3[2] == 12 and o3[3] == int(m.sum())


def test_halka_hash_parametre_degisince_degisir():
    g = _bahce()
    assert h.halka_hash(g, K) == h.halka_hash(g, K)
    assert h.halka_hash(g, K) != h.halka_hash(g, K.model_copy(update={"halka_dis_m": 250.0}))
    assert h.halka_hash(g, K) != h.halka_hash(_bahce(60), K)


def test_dis_cokgen_bahceyi_icerir_ve_300_m_buyur():
    from shapely.geometry import shape

    b = shape(_bahce(40))
    d = shape(h.dis_cokgen(_bahce(40), 300.0))
    assert d.contains(b) and d.area > 20 * b.area
