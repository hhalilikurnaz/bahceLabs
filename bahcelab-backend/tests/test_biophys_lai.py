"""LAI (SNAP biyofizik işlemcisi v2.1) Python port'u: SNAP'in kendi 100 referans vakasıyla doğrulanır."""

from pathlib import Path

import numpy as np

from bahcelab_backend.domain.imagery.biophys import LaiNetwork, lai_from_bands

CASES = np.loadtxt(Path(__file__).parent / "fixtures" / "lai" / "LAI_TestCases", delimiter=",")  # 11 girdi + beklenen LAI


def test_port_matches_snap_reference_outputs_for_all_cases() -> None:
    net = LaiNetwork.load()
    out = net.predict(CASES[:, :11])
    expected = CASES[:, 11]
    ok = np.isfinite(out)
    assert ok.sum() >= 95  # referans vakalar tanım alanındadır
    assert np.max(np.abs(out[ok] - expected[ok])) < 1e-3  # SNAP çıktısı 5 anlamlı basamakla verilir


def test_out_of_domain_inputs_are_invalid_not_guessed() -> None:
    net = LaiNetwork.load()
    row = CASES[0].copy()[:11].reshape(1, 11)
    bad = row.copy()
    bad[0, 0] = 0.9  # B03 yansıtımı tanım alanı dışında
    assert np.isnan(net.predict(bad)[0]) and np.isfinite(net.predict(row)[0])


def test_extreme_outputs_are_thresholded_or_invalid() -> None:
    net = LaiNetwork.load()
    low, high = net.extreme_cases()
    assert low == 0.0 and high == 8.0
    values = net.apply_extremes(np.array([-0.1, -0.5, 0.0, 4.0, 8.1, 9.0]))
    assert values[0] == 0.0 and np.isnan(values[1]) and values[2] == 0.0 and values[3] == 4.0 and values[4] == 8.0 and np.isnan(values[5])


def test_lai_from_bands_uses_angles_and_20m_blocks() -> None:
    # 4×4 piksel: SNAP referans vakasını her piksele koy; 20 m blok ortalaması sabit girdi için aynı sonucu verir
    case = CASES[1]
    names = ["green", "red", "rededge", "rededge2", "rededge3", "nir_narrow", "swir1", "swir2"]
    bands = {n: np.full((4, 4), case[i], dtype=np.float32) for i, n in enumerate(names)}
    # cos(vz)=case[8], cos(sz)=case[9], cos(raz)=case[10] → açılar
    vz, sz = np.degrees(np.arccos(case[8])), np.degrees(np.arccos(case[9]))
    raz = np.degrees(np.arccos(case[10]))
    lai = lai_from_bands(bands, sun_zenith=sz, sun_azimuth=raz, view_zenith=vz, view_azimuth=0.0, parity=(0, 0))
    assert lai.shape == (4, 4) and np.allclose(lai, case[11], atol=2e-3)


def test_granule_angles_parse_sun_and_mean_view_angles() -> None:
    from bahcelab_backend.domain.imagery.angles import parse_granule_angles

    angles = parse_granule_angles((Path(__file__).parent / "fixtures" / "lai" / "MTD_TL_acilar.xml").read_text())
    assert 40 < angles.sun_zenith < 50 and 160 < angles.sun_azimuth < 166  # kayıtlı gerçek granül (Mersin, Ekim 2026)
    assert 3 < angles.view_zenith < 9 and 270 < angles.view_azimuth < 295
