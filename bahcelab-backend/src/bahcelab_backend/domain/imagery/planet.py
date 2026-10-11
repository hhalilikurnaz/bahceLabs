"""Yüksek çözünürlüklü ücretli sağlayıcı (PlanetScope) için YER TUTUCU: yalnızca sözleşme (arayüz) ve «yapılandırılmadı» durumu.
Gerçek bağlantı YOKTUR; ticari sözleşme ve anahtar olunca arama/okuma bu sınıfta uygulanır, başka hiçbir yer değişmez (ADR 0011)."""

from __future__ import annotations

from datetime import date
from typing import Any

from bahcelab_backend.domain.imagery.provider import (
    Capabilities,
    ProviderNotConfigured,
    SceneRef,
    compute_capabilities_indices,
)
from bahcelab_backend.domain.imagery.roles import Band

_ROLES = frozenset(str(r) for r in (Band.BLUE, Band.GREEN, Band.RED, Band.REDEDGE, Band.NIR))  # 8 bantlı PlanetScope alt kümesi
_MESSAGE = "PlanetScope bu kurulumda yapılandırılmadı (ticari sözleşme ve anahtar gerekir)."


class PlanetProvider:
    _CAPS = Capabilities(
        ad="planet-scope",
        etiket="PlanetScope (3 m, ücretli)",
        cozunurluk_m=3.0,
        roller=_ROLES,
        rol_haritasi={"blue": "blue", "green": "green", "red": "red", "rededge": "rededge", "nir": "nir"},
        bulut_maskesi="udm2",
        yapilandirildi=False,
        ucretli=True,
        notlar="Yalnızca sözleşme testi; SWIR bandı yok (NDMI hesaplanamaz).",
        desteklenen_indeksler=compute_capabilities_indices(_ROLES),
    )

    @property
    def capabilities(self) -> Capabilities:
        return self._CAPS

    def search_scenes(self, geometry: dict[str, Any], start: date, end: date, max_cloud: float | None = None) -> list[SceneRef]:
        raise ProviderNotConfigured(_MESSAGE)

    def first_scene_date(self, geometry: dict[str, Any]) -> date | None:
        raise ProviderNotConfigured(_MESSAGE)

    def read_scene(self, scene: SceneRef, geometry: dict[str, Any], roles: set[str] | None = None) -> Any:
        raise ProviderNotConfigured(_MESSAGE)
