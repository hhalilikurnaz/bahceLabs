"""Uydu sağlayıcı SÖZLEŞME testleri (ağ yok): her sağlayıcı aynı kuralları sağlar; ücretli sağlayıcı yalnızca «yapılandırılmadı» der."""

from datetime import date

import numpy as np
import pytest

from bahcelab_backend.domain.imagery import registry
from bahcelab_backend.domain.imagery.planet import PlanetProvider
from bahcelab_backend.domain.imagery.provider import (
    Capabilities,
    ImageryProvider,
    ProviderNotConfigured,
    SceneRef,
)
from bahcelab_backend.domain.imagery.roles import ALL_ROLES, CORE_ROLES, Band
from bahcelab_backend.domain.imagery.sentinel2 import ROLE_TO_BAND, Sentinel2L2AProvider
from bahcelab_backend.domain.ndvi.indices import INDICES

from .support.fake_imagery import FakeImageryProvider
from .test_gardens_api import square

GEOMETRY = square(300)


def providers() -> list[ImageryProvider]:
    return [Sentinel2L2AProvider(), PlanetProvider(), FakeImageryProvider(GEOMETRY)]


def assert_capabilities_contract(caps: Capabilities) -> None:
    assert caps.ad and caps.etiket and caps.cozunurluk_m > 0 and caps.bulut_maskesi
    assert caps.roller <= set(ALL_ROLES), "roller yalnızca bilinen bant rollerinden oluşur"
    assert set(CORE_ROLES) <= caps.roller, "NDVI için kırmızı ve yakın kızılötesi zorunludur"
    assert set(caps.rol_haritasi) == set(caps.roller), (
        "her rolün sağlayıcı bandı bildirilmiş olmalı"
    )
    for (
        index_id,
        definition,
    ) in INDICES.items():  # hesaplanabilir indeksler roller üzerinden tutarlı türetilir
        assert (index_id in caps.desteklenen_indeksler) == (set(definition.bantlar) <= caps.roller)


@pytest.mark.parametrize("provider", providers(), ids=lambda p: p.capabilities.ad)
def test_every_provider_declares_a_consistent_capability_contract(provider):
    assert_capabilities_contract(provider.capabilities)
    assert isinstance(provider.capabilities.yapilandirildi, bool)


def test_sentinel2_maps_every_role_to_a_band_and_supports_all_indices():
    caps = Sentinel2L2AProvider().capabilities
    assert caps.yapilandirildi and caps.cozunurluk_m == 10.0 and caps.bulut_maskesi == "scl"
    assert set(caps.roller) == {str(r) for r in ROLE_TO_BAND} == set(ALL_ROLES)
    assert (
        caps.rol_haritasi["red"] == "B04"
        and caps.rol_haritasi["nir_narrow"] == "B8A"
        and caps.rol_haritasi["swir1"] == "B11"
    )
    assert caps.desteklenen_indeksler == frozenset(INDICES)


def test_planet_is_a_contract_only_placeholder_that_refuses_to_connect():
    planet = PlanetProvider()
    caps = planet.capabilities
    assert caps.yapilandirildi is False and caps.ucretli is True and caps.cozunurluk_m < 10
    assert (
        "ndmi" not in caps.desteklenen_indeksler and "ndvi" in caps.desteklenen_indeksler
    )  # SWIR yok → NDMI hesaplanamaz
    for call in (
        lambda: planet.search_scenes({}, date(2025, 1, 1), date(2025, 2, 1)),
        lambda: planet.first_scene_date({}),
        lambda: planet.read_scene(SceneRef(date(2025, 1, 1), "x", None), {}),
    ):
        with pytest.raises(ProviderNotConfigured):
            call()


def test_registry_refuses_unconfigured_and_unknown_providers():
    assert registry.get_imagery_provider("sentinel2-l2a").capabilities.ad == "sentinel2-l2a"
    with pytest.raises(ProviderNotConfigured):
        registry.get_imagery_provider("planet-scope")
    with pytest.raises(KeyError):
        registry.get_imagery_provider("yok-boyle-bir-saglayici")
    assert {"sentinel2-l2a", "planet-scope"} <= set(registry.available())


def test_fake_provider_satisfies_the_search_and_read_contract():
    fake = FakeImageryProvider(GEOMETRY)
    scenes = fake.search_scenes(GEOMETRY, date(2022, 6, 1), date(2022, 9, 30))
    assert scenes and scenes == sorted(scenes, key=lambda s: s.tarih)
    assert all(date(2022, 6, 1) <= s.tarih <= date(2022, 9, 30) for s in scenes)
    assert len({s.tarih for s in scenes}) == len(scenes), "tarih başına tek sahne"
    data = fake.read_scene(scenes[0], GEOMETRY, {"red", "nir"})
    assert (
        {"red", "nir"} <= set(data.bands)
        and data.valid.dtype == bool
        and data.valid.shape == data.bands["red"].shape
    )
    assert np.isfinite(data.bands["red"]).any()
    assert fake.first_scene_date(GEOMETRY) == date(2018, 6, 20)
    assert Band.RED == "red"


def test_indices_work_from_roles_not_from_provider_band_names():
    from bahcelab_backend.domain.ndvi.indices import compute_index

    ndvi = compute_index(
        "ndvi", {"red": np.array([0.1], np.float32), "nir": np.array([0.5], np.float32)}
    )
    assert ndvi[0] == pytest.approx(0.4 / 0.6)
    with pytest.raises(KeyError):
        compute_index(
            "ndvi", {"B04": np.array([0.1]), "B08": np.array([0.5])}
        )  # Sentinel bant adları artık bilinmez
