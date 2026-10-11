"""Sağlayıcı kayıt defteri: ad → sağlayıcı. Yapılandırma (`IMAGERY_PROVIDER`) hangisinin kullanılacağını seçer."""

from __future__ import annotations

from collections.abc import Callable

from bahcelab_backend.config import get_settings
from bahcelab_backend.domain.imagery.planet import PlanetProvider
from bahcelab_backend.domain.imagery.provider import ImageryProvider, ProviderNotConfigured
from bahcelab_backend.domain.imagery.sentinel2 import Sentinel2L2AProvider

_FACTORIES: dict[str, Callable[[], ImageryProvider]] = {
    "sentinel2-l2a": Sentinel2L2AProvider,
    "planet-scope": PlanetProvider,
}


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
