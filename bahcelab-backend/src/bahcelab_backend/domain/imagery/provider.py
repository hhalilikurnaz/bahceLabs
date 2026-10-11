"""Takılıp çıkarılabilir uydu kaynağı arayüzü (ADR 0011).

Sağlayıcı değiştirmek = yeni bir `ImageryProvider` uygulaması + `registry`'ye kayıt. İşleme hattı (indeksler, bölgeler)
yalnızca bu arayüzü ve bant rollerini bilir. Sağlayıcı şunları bildirir: çözünürlük, hangi roller var, bulut maskesi türü,
arşiv başlangıcı, yapılandırılmış mı. Hesaplanabilir indeksler roller üzerinden türetilir (`capabilities.computable_indices`).
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import date
from typing import Any, Protocol

from bahcelab_backend.domain.imagery.roles import Band


class ImageryError(Exception):
    """Uydu kaynağına ulaşılamadı veya okunamadı (kullanıcıya gösterilebilir mesaj taşır)."""


class ProviderNotConfigured(ImageryError):
    """Sağlayıcı bu kurulumda yapılandırılmamış (anahtar/sözleşme yok)."""


@dataclass(frozen=True)
class SceneRef:
    """Aranan bir sahne. `handle` sağlayıcıya özgü opak nesnedir (STAC item, API kimliği…); yalnızca aynı sağlayıcı okur."""

    tarih: date
    scene_id: str
    bulut_orani: float | None
    handle: Any = None


@dataclass(frozen=True)
class Capabilities:
    ad: str  # kısa kod: "sentinel2-l2a"
    etiket: str  # kullanıcıya gösterilen ad
    cozunurluk_m: float
    roller: frozenset[str]  # sağlanan Band değerleri
    rol_haritasi: Mapping[str, str]  # rol → sağlayıcının bant adı (ör. "red" → "B04")
    bulut_maskesi: str  # "scl", "udm2", … (bilgi amaçlı)
    yapilandirildi: bool
    ucretli: bool = False
    notlar: str = ""
    desteklenen_indeksler: frozenset[str] = field(default_factory=frozenset)

    def can_compute(self, index_roles: tuple[str, ...]) -> bool:
        return set(index_roles) <= set(self.roller)


class ImageryProvider(Protocol):
    @property
    def capabilities(self) -> Capabilities: ...

    def search_scenes(self, geometry: dict[str, Any], start: date, end: date, max_cloud: float | None = None) -> list[SceneRef]:
        """Bahçeyi kapsayan sahneler (tarih başına en iyisi), tarihe göre sıralı."""
        ...

    def first_scene_date(self, geometry: dict[str, Any]) -> date | None:
        """Bu konum için arşivdeki en eski sahne tarihi (yoksa None)."""
        ...

    def read_scene(self, scene: SceneRef, geometry: dict[str, Any], roles: set[str] | None = None) -> Any:
        """Yalnızca bahçe penceresini okur; `SceneBands` (rol → yansıtım, `valid` bulut/gölge maskesi, ızgara) döner.
        Bulutluysa (sağlayıcının kendi maskesiyle) `bands` boş olabilir."""
        ...


def compute_capabilities_indices(roles: frozenset[str]) -> frozenset[str]:
    """Rollerden hesaplanabilen indeks kimlikleri."""
    from bahcelab_backend.domain.ndvi.indices import (
        INDICES,  # gecikmeli: döngüsel içe aktarmayı önler
    )

    return frozenset(i for i, d in INDICES.items() if set(d.bantlar) <= set(roles))


__all__ = [
    "Band",
    "Capabilities",
    "ImageryError",
    "ImageryProvider",
    "ProviderNotConfigured",
    "SceneRef",
    "compute_capabilities_indices",
]
