from datetime import date, timedelta

import pytest

from bahcelab_backend.domain.eta import kalibrasyon as k
from bahcelab_backend.domain.eta import meteo as m


def test_uzun_donem_c_medyan_ve_yetersizlik():
    c = {date(2025, 7, 1) + timedelta(days=7 * i): 1.0 + 0.01 * (i % 3) for i in range(6)}  # Temmuz–Ağustos
    r = k.uzun_donem_c(c, 7, 1, 5)
    assert r is not None and r.n >= 5 and 1.0 <= r.deger <= 1.02 and r.yayilim >= 0
    assert k.uzun_donem_c(c, 2, 1, 5) is None  # Şubat: sahne yok → varsayılan c UYDURULMAZ
    assert k.uzun_donem_c(c, 7, 1, 50) is None


def test_c_aykiri_deger_medyani_bozmaz():
    c = {date(2025, 7, d): 1.0 for d in range(1, 10)} | {date(2025, 7, 20): 1.6}
    assert k.uzun_donem_c(c, 7, 0, 5).deger == pytest.approx(1.0)  # type: ignore[union-attr]


def _seri(farklar: list[float], bas=date(2025, 6, 1)) -> dict[date, float]:
    out, v, t = {}, 0.7, bas
    for f in farklar:
        out[t] = v
        v += f
        t += timedelta(days=7)
    out[t] = v
    return out


def test_tutarlilik_kapisi_gecer_ve_kalir():
    kw = dict(esik=0.15, max_gun=10, min_cift=8, yagis_esik_mm=5.0, aylar=[6, 7, 8, 9])
    iyi = k.tutarlilik(_seri([0.02, -0.03, 0.05, -0.04, 0.02, -0.01, 0.03, -0.02, 0.01, 0.02]), {}, **kw)
    assert iyi.kapi_acik and iyi.p90 is not None and iyi.p90 <= 0.15 and iyi.cift >= 8
    kotu = k.tutarlilik(_seri([0.5, -0.55, 0.45, -0.4, 0.5, -0.5, 0.4, -0.45, 0.3, 0.2]), {}, **kw)  # Dilim 0: 0,33 ↔ 0,90 türü sıçramalar
    assert not kotu.kapi_acik and kotu.p90 is not None and kotu.p90 > 0.15


def test_tutarlilik_yetersiz_cift_kapali_ve_yagis_ciftleri_eler():
    kw = dict(esik=0.15, max_gun=10, min_cift=8, yagis_esik_mm=5.0, aylar=[6, 7, 8, 9])
    az = k.tutarlilik(_seri([0.01, 0.02, 0.01]), {}, **kw)
    assert not az.kapi_acik and az.p90 is None and "yetersiz" in az.neden
    seri = _seri([0.01] * 12)
    yagis = {t: 30.0 for t in seri}  # her aralıkta yağış → hiç çift sayılmaz
    assert k.tutarlilik(seri, yagis, **kw).cift == 0
    assert k.tutarlilik(_seri([0.01] * 12, date(2025, 11, 1)), {}, **kw).cift == 0  # kuru mevsim dışı


def test_aylik_ta_sapma_yalniz_yeterli_eslesme():
    era = {date(2025, 7, d): 30.0 for d in range(1, 26)} | {date(2025, 8, 1): 31.0}
    obs = {date(2025, 7, d): 33.0 for d in range(1, 26)} | {date(2025, 8, 1): 34.0}
    s = m.aylik_ta_sapma(era, obs, 20)
    assert s[7][0] == pytest.approx(3.0) and s[7][2] == 25
    assert 8 not in s  # tek gün: uydurma düzeltme yok
