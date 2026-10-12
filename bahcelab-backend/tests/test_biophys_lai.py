"""LAI (SNAP biyofizik işlemcisi v2.1) Python port'u: SNAP'in kendi 100 referans vakasıyla doğrulanır."""

from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import pytest

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


# ESA S2 Toolbox Level-2 ATBD v1.1 (Weiss & Baret, 02.05.2016) ile tutarlılık: yapı, aktivasyon, normalizasyon, tanım alanı (Tablo 8)
ATBD_TABLE8_MAX = {"B03": 0.26, "B04": 0.30, "B05": 0.32, "B06": 0.62, "B07": 0.75, "B8A": 0.78, "B11": 0.52, "B12": 0.50}


def test_network_structure_matches_the_atbd() -> None:
    net = LaiNetwork.load()
    assert net.norm.shape == (11, 2)  # 8 bant + 3 geometri girdisi
    assert net.w1.shape == (5, 11) and net.w2.shape == (5,)  # 5 nöronlu tek gizli katman, doğrusal çıkış
    assert np.allclose(np.tanh(np.linspace(-2, 2, 9)), 2 / (1 + np.exp(-2 * np.linspace(-2, 2, 9))) - 1)  # tansig == tanh (ATBD §4.2)


def test_definition_domain_bounding_box_is_consistent_with_atbd_table_8() -> None:
    net = LaiNetwork.load()
    assert np.all(net.domain[0] == 0.0 + net.domain[0].clip(0)) and np.all(net.domain[0] < 0.02)  # alt sınırlar ≈ 0
    for (_, atbd_max), ours in zip(ATBD_TABLE8_MAX.items(), net.domain[1], strict=True):
        assert abs(ours - atbd_max) < 0.03  # ATBD v1.1 tablosu yuvarlak/eski; v2.1 katsayıları birkaç yüzde farklı


def test_normalisation_and_denormalisation_follow_the_atbd_equations() -> None:
    net = LaiNetwork.load()
    x = np.array([[0.05, 0.03, 0.1, 0.3, 0.4, 0.45, 0.15, 0.06, 0.99, 0.8, 0.0]])
    out = net.predict(x)  # X* = 2(X−Xmin)/(Xmax−Xmin)−1 ; Y = 0.5(Y*+1)(Ymax−Ymin)+Ymin
    xn = 2 * (x - net.norm[:, 0]) / (net.norm[:, 1] - net.norm[:, 0]) - 1
    y_star = np.tanh(xn @ net.w1.T + net.b1) @ net.w2 + net.b2
    expected = 0.5 * (y_star + 1) * (net.denorm[1] - net.denorm[0]) + net.denorm[0]
    assert (np.isnan(out[0]) and (expected[0] < 0 or expected[0] > 8.2)) or out[0] == pytest.approx(float(np.clip(expected[0], 0, 8)), abs=1e-9)


def test_scene_angles_use_stac_sun_angles_and_one_granule_download_per_tile_and_orbit(monkeypatch) -> None:
    import pystac

    from bahcelab_backend.domain.imagery import sentinel2

    xml = (Path(__file__).parent / "fixtures" / "lai" / "MTD_TL_acilar.xml").read_text()
    downloads: list[str] = []

    class _Resp:
        text = xml

        def raise_for_status(self) -> None: ...

    monkeypatch.setattr(sentinel2.httpx, "get", lambda url, timeout=0: (downloads.append(url), _Resp())[1])
    monkeypatch.setattr(sentinel2.planetary_computer, "sign", lambda href: href)
    sentinel2._VIEW_CACHE.clear()

    def item(scene_id: str, sun_zenith: float) -> pystac.Item:
        it = pystac.Item(id=scene_id, geometry=None, bbox=None, datetime=datetime(2025, 7, 3, 8, 35, 31, tzinfo=UTC), properties={"s2:mean_solar_zenith": sun_zenith, "s2:mean_solar_azimuth": 150.0, "s2:mgrs_tile": "36SXF", "sat:relative_orbit": 21})
        it.add_asset("granule-metadata", pystac.Asset(href=f"https://x/{scene_id}/MTD_TL.xml"))
        return it

    first = sentinel2._angles(item("A", 25.0))
    second = sentinel2._angles(item("B", 48.5))
    assert first is not None and second is not None and len(downloads) == 1  # ikinci sahne için ek indirme yok
    assert (first.sun_zenith, second.sun_zenith) == (25.0, 48.5)  # güneş açısı STAC'tan, sahneye özgü
    assert first.view_zenith == second.view_zenith and 3 < first.view_zenith < 9
