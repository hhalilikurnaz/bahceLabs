"""Bant ROLLERİ: indeks hesapları sağlayıcının bant adlarını (Sentinel-2 B04…) değil bu rolleri bilir.
Her sağlayıcı kendi bantlarını rollere eşler (`ImageryProvider.capabilities.role_map`)."""

from __future__ import annotations

from enum import StrEnum


class Band(StrEnum):
    BLUE = "blue"
    GREEN = "green"
    RED = "red"
    REDEDGE = "rededge"  # kırmızı kenar (Sentinel-2 B05, 20 m)
    NIR = "nir"  # geniş yakın kızılötesi (B08, 10 m)
    NIR_NARROW = "nir_narrow"  # dar yakın kızılötesi (B8A, 20 m)
    SWIR1 = "swir1"  # kısa dalga kızılötesi (B11, 20 m)
    REDEDGE2 = "rededge2"  # kırmızı kenar 2 (B06, 20 m) — LAI girdisi
    REDEDGE3 = "rededge3"  # kırmızı kenar 3 (B07, 20 m) — LAI girdisi
    SWIR2 = "swir2"  # kısa dalga kızılötesi 2 (B12, 20 m) — LAI girdisi


ALL_ROLES: tuple[str, ...] = tuple(b.value for b in Band)
# Sahnenin "bulutlu mu" kararı ve NDVI için her zaman gereken çekirdek roller
CORE_ROLES: tuple[str, ...] = (Band.RED.value, Band.NIR.value)
TRUE_COLOR_ROLES: tuple[str, ...] = (Band.RED.value, Band.GREEN.value, Band.BLUE.value)
