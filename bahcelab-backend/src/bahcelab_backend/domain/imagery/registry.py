"""Sağlayıcı kayıt defteri: ad → sağlayıcı. Yapılandırma (`IMAGERY_PROVIDER`) hangisinin kullanılacağını seçer."""

from __future__ import annotations

from collections.abc import Callable

from bahcelab_backend.config import get_settings
from bahcelab_backend.domain.imagery.hls import PlanetaryHlsProvider
from bahcelab_backend.domain.imagery.landsat import PlanetaryLandsatProvider
from bahcelab_backend.domain.imagery.planet import PlanetProvider
from bahcelab_backend.domain.imagery.provider import ImageryProvider, ProviderNotConfigured
from bahcelab_backend.domain.imagery.radar import PlanetaryRadarProvider
from bahcelab_backend.domain.imagery.sentinel2 import Sentinel2L2AProvider

_FACTORIES: dict[str, Callable[[], ImageryProvider]] = {
    "sentinel2-l2a": Sentinel2L2AProvider,
    "planet-scope": PlanetProvider,
}


def get_landsat_provider() -> PlanetaryLandsatProvider:
    """Landsat yüzey sıcaklığı (ADR 0017); testlerde sahte sağlayıcıyla değiştirilir."""
    return PlanetaryLandsatProvider()


def get_hls_provider() -> PlanetaryHlsProvider:
    """HLS v2.0 NDVI (kesintisiz canlılık eğrisi, ADR 0018); testlerde sahte sağlayıcıyla değiştirilir (`HLS_CLIENT`, yalnız API_DEBUG)."""
    settings = get_settings()
    if settings.hls_client:
        if not settings.api_debug:
            raise RuntimeError("HLS_CLIENT yalnızca API_DEBUG=true ortamında kullanılabilir.")
        import importlib

        module, _, name = settings.hls_client.partition(":")
        return getattr(importlib.import_module(module), name)()
    return PlanetaryHlsProvider()


def get_radar_provider() -> PlanetaryRadarProvider:
    """Radar kaynağı (Sentinel-1 RTC, ADR 0016); testlerde sahte sağlayıcıyla değiştirilir."""
    return PlanetaryRadarProvider()


def register(name: str, factory: Callable[[], ImageryProvider]) -> None:
    _FACTORIES[name] = factory


def available() -> list[str]:
    return sorted(_FACTORIES)


def get_imagery_provider(name: str | None = None) -> ImageryProvider:
    chosen = name or get_settings().imagery_provider
    if chosen not in _FACTORIES:
        raise KeyError(f"Bilinmeyen uydu sağlayıcısı: {chosen}")
    provider = _FACTORIES[chosen]()
    if not provider.capabilities.yapilandirildi:
        raise ProviderNotConfigured(f"{provider.capabilities.etiket}: yapılandırılmadı")
    return provider
