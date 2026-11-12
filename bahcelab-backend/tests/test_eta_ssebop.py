"""SSEBop saf matematiği: sentetik girdiler, sınır durumları, spike belgesindeki elle hesapla uyum."""

import math

import numpy as np
import pytest

from bahcelab_backend.domain.eta import ssebop as sb

# docs/agro/eta-kaynak-dogrulama.md §2.2 — 2026-06-12 (jlnnlk): Rs 22,44 · Rn_sıcak 165 W/m² · ρ 1,177 · dT 15,20 K
GIRDI = sb.DtGirdi(rs_mj=22.44, tmax_c=24.7, tmin_c=19.5, tmean_c=22.2, cig_c=15.0, yil_gunu=163, enlem=36.6637, yukseklik_m=45.0)


def test_ra_ve_rso_spike_ile_uyumlu():
    assert sb.ra_gunluk(163, 36.6637) == pytest.approx(41.66, abs=0.05)  # belge: Ra 41,66
    s = sb.dt_hesapla(GIRDI, albedo=0.23, rah=110.0, cp=1013.0)
    assert s.rso_mj == pytest.approx(31.28, abs=0.08)  # belge: Rso 31,28
    assert s.rs_rso == pytest.approx(0.72, abs=0.01)


def test_dt_belgedeki_elle_hesapla_ayni_buyukluk():
    s = sb.dt_hesapla(GIRDI, albedo=0.23, rah=110.0, cp=1013.0)
    assert s.rn_sicak_wm2 == pytest.approx(165, abs=8)  # çiy noktası spike'taki ERA5 değerinden farklı olabilir: ±8 W/m²
    assert s.rho == pytest.approx(1.177, abs=0.004)
    assert s.dt_k == pytest.approx(s.rn_sicak_wm2 * 110 / (s.rho * 1013), rel=1e-9)  # tanım


def test_dt_radyasyonla_artar_ve_kis_gece_sifira_yakin():
    az = sb.dt_hesapla(sb.DtGirdi(5.0, 8, 2, 5, 1, 20, 36.66, 45), albedo=0.23, rah=110.0, cp=1013.0)
    cok = sb.dt_hesapla(sb.DtGirdi(25.0, 30, 20, 25, 12, 190, 36.66, 45), albedo=0.23, rah=110.0, cp=1013.0)
    assert cok.dt_k > az.dt_k > 0
    assert sb.dt_hesapla(sb.DtGirdi(0.0, 5, 0, 2, 0, 355, 36.66, 45), albedo=0.23, rah=110.0, cp=1013.0).dt_k >= 0  # negatif dT yok (alt sınır 0)


def test_etf_sinirlari_ve_tanimsiz_dt():
    assert sb.etf_hesapla(300.0, 300.0, 15.0, 1.05)[()] == pytest.approx(1.0)  # Ts = Tc → ETf 1
    assert sb.etf_hesapla(315.0, 300.0, 15.0, 1.05)[()] == pytest.approx(0.0)  # Ts = Th → 0
    assert sb.etf_hesapla(290.0, 300.0, 15.0, 1.05)[()] == pytest.approx(1.05)  # tavan
    assert sb.etf_hesapla(330.0, 300.0, 15.0, 1.05)[()] == pytest.approx(0.0)  # taban
    assert np.isnan(sb.etf_hesapla(300.0, 300.0, 0.2, 1.05)[()])  # dT ≈ 0: tanımsız
    assert sb.etf_hesapla(np.array([300.0, 307.5]), 300.0, 15.0, 1.05) == pytest.approx([1.0, 0.5])


def test_c_faktoru_gidis_donus_ve_rakim_duzeltmesi():
    c = sb.c_faktoru(300.08, 297.85)
    assert sb.tc_hesapla(c, 297.85) == pytest.approx(300.08)
    assert sb.ta_rakim_duzelt(300.0, 545.0, 45.0, 6.5) == pytest.approx(300.0 - 6.5 * 0.5)  # 500 m yukarı → −3,25 K
    assert sb.ta_rakim_duzelt(300.0, 45.0, 45.0, 6.5) == 300.0


def test_belirsizlik_dt_kuculdukce_buyur():
    assert sb.etf_belirsizlik(1.5, 1.0, 15.0) < sb.etf_belirsizlik(1.5, 1.0, 5.0)
    assert math.isnan(sb.etf_belirsizlik(1.5, 1.0, 0.1))
    assert sb.etf_belirsizlik(1.0, 0.0, 10.0) == pytest.approx(0.1)


def test_ic_tampon_orani():
    tum = np.ones((4, 5), dtype=bool)
    ic = np.zeros((4, 5), dtype=bool)
    ic[1:3, 1:4] = True
    assert sb.ic_tampon_maske_orani(ic, tum) == pytest.approx(6 / 20)
    assert sb.ic_tampon_maske_orani(ic, np.zeros((4, 5), dtype=bool)) == 0.0
