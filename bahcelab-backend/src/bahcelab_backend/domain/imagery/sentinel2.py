"""Sentinel-2 L2A (Microsoft Planetary Computer STAC) sağlayıcısı: sahne arama ve COG'dan yalnızca bahçe penceresini okuma.
Bant adları (B04…) yalnızca bu modülde bilinir; dışarıya bant ROLLERİ (`roles.Band`) verilir."""

from __future__ import annotations

import logging
import time
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import date
from typing import Any

import numpy as np
import planetary_computer
import rasterio
from pystac import Item
from pystac_client import Client
from rasterio.enums import Resampling
from rasterio.warp import transform_geom
from rasterio.windows import Window, from_bounds
from rasterio.windows import bounds as window_bounds
from shapely.geometry import shape

from bahcelab_backend.domain.imagery.masks import scl_valid_mask
from bahcelab_backend.domain.imagery.provider import (
    Capabilities,
    ImageryError,
    SceneRef,
    compute_capabilities_indices,
)
from bahcelab_backend.domain.imagery.roles import ALL_ROLES, Band
from bahcelab_backend.domain.ndvi.processing import (
    MIN_VALID_RATIO,
    SceneBands,
    garden_pixel_mask,
    to_reflectance,
)

logger = logging.getLogger(__name__)

STAC_URL = "https://planetarycomputer.microsoft.com/api/stac/v1"
COLLECTION = "sentinel-2-l2a"

# Rol → Sentinel-2 bandı. 10 m: B02 B03 B04 B08 · 20 m (bilinear ile 10 m'ye): B05 B8A B11
ROLE_TO_BAND: dict[str, str] = {
    Band.BLUE: "B02",
    Band.GREEN: "B03",
    Band.RED: "B04",
    Band.REDEDGE: "B05",
    Band.NIR: "B08",
    Band.NIR_NARROW: "B8A",
    Band.SWIR1: "B11",
}
BANDS_10M = ("B02", "B03", "B04", "B08")
BAND_SCL = "SCL"


def with_retry[T](fn: Callable[[], T], attempts: int = 3, delay: float = 1.5) -> T:
    """Geçici ağ hatalarında artan bekleme ile tekrar dener."""
    last: Exception | None = None
    for attempt in range(attempts):
        try:
            return fn()
        except Exception as exc:  # noqa: BLE001 - ağ/GDAL/STAC hataları çok çeşitli
            last = exc
            logger.warning("NDVI kaynağı hatası (deneme %s/%s): %s", attempt + 1, attempts, exc)
            if attempt < attempts - 1:
                time.sleep(delay * (attempt + 1))
    raise ImageryError(
        "Uydu verisi kaynağına (Planetary Computer) ulaşılamadı. "
        "Bağlantınızı kontrol edip biraz sonra tekrar deneyin."
    ) from last


def search_scenes(geometry: dict[str, Any], start: date, end: date, max_cloud: float | None = None) -> list[SceneRef]:
    """Bahçeyi kapsayan Sentinel-2 L2A sahneleri; aynı tarihte birden fazla ise en çok örten seçilir."""

    def _search() -> list[Item]:
        client = Client.open(STAC_URL)
        extra: dict[str, Any] = {"query": {"eo:cloud_cover": {"lte": max_cloud}}} if max_cloud is not None else {}
        search = client.search(
            collections=[COLLECTION],
            intersects=geometry,
            datetime=f"{start.isoformat()}/{end.isoformat()}",
            max_items=600,
            **extra,
        )
        return list(search.items())

    items = with_retry(_search)
    garden = shape(geometry)

    best: dict[date, tuple[float, float, Item]] = {}
    for item in items:
        if item.datetime is None:
            continue
        day = item.datetime.date()
        overlap = (
            shape(item.geometry or {}).intersection(garden).area / garden.area if garden.area else 0.0
        )
        cloud = float(item.properties.get("eo:cloud_cover", 100.0))
        key = (overlap, -cloud)
        if day not in best or key > best[day][:2]:
            best[day] = (overlap, -cloud, item)

    scenes = [
        SceneRef(
            tarih=day,
            scene_id=item.id,
            bulut_orani=float(item.properties["eo:cloud_cover"])
            if "eo:cloud_cover" in item.properties
            else None,
            handle=item,
        )
        for day, (_, _, item) in best.items()
    ]
    return sorted(scenes, key=lambda s: s.tarih)


BASELINE_WITH_OFFSET = 4.0  # işleme sürümü 04.00 ve sonrası (2022-01-25'ten itibaren): BOA_ADD_OFFSET = −1000 sayısal değer
BOA_OFFSET_REFLECTANCE = -0.1


def _processing_baseline(item: Item) -> float | None:
    try:
        return float(str(item.properties.get("s2:processing_baseline", "")))
    except ValueError:
        return None


def _band_scale_offset(item: Item, asset_key: str) -> tuple[float, float]:
    """Ölçek ve ofset: varlıkta `raster:bands` varsa o; yoksa işleme sürümüne göre (≥ 04.00 → −0,1). Ofset atlanırsa her bant +0,1 yüksek
    çıkar ve NDVI 2022 sonrası görüntülerde ≈ 0,2 düşük hesaplanır (yıllar arası düzey kayması)."""
    bands = item.assets[asset_key].extra_fields.get("raster:bands")
    if bands:
        return float(bands[0].get("scale", 0.0001)), float(bands[0].get("offset", 0.0))
    baseline = _processing_baseline(item)
    return 0.0001, BOA_OFFSET_REFLECTANCE if baseline is not None and baseline >= BASELINE_WITH_OFFSET else 0.0


_GDAL_ENV = {
    "GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_DIR",
    "CPL_VSIL_CURL_ALLOWED_EXTENSIONS": ".tif,.tiff",
    "GDAL_HTTP_MAX_RETRY": "3",
    "GDAL_HTTP_RETRY_DELAY": "1",
    "VSI_CACHE": "TRUE",
}
_READ_THREADS = 4


@dataclass(frozen=True)
class _Window:
    """Referans (B04, 10 m) penceresi: tüm bantlar aynı coğrafi alandan, aynı 10 m ızgarasına okunur."""

    window: Window
    transform: Any
    shape: tuple[int, int]
    bounds: tuple[float, float, float, float]  # referans bandın yerel koordinatlarında
    crs: Any


def _reference_window(href: str, geometry: dict[str, Any]) -> _Window:
    with rasterio.open(href) as ref:
        bounds = shape(transform_geom("EPSG:4326", ref.crs, geometry)).bounds
        window = from_bounds(*bounds, transform=ref.transform)
        window = window.round_offsets(op="floor").round_lengths(op="ceil")
        window = Window(window.col_off - 1, window.row_off - 1, window.width + 2, window.height + 2)
        window = window.intersection(Window(0, 0, ref.width, ref.height))
        return _Window(
            window=window,
            transform=ref.window_transform(window),
            shape=(int(window.height), int(window.width)),
            bounds=window_bounds(window, ref.transform),
            crs=ref.crs,
        )


def _read_one(href: str, ref: _Window, band: str) -> np.ndarray:
    """Tek bandı referans ızgarasına okur: 10 m doğrudan, 20 m bilinear, SCL nearest."""
    with rasterio.Env(**_GDAL_ENV), rasterio.open(href) as src:
        if band in BANDS_10M:
            return src.read(1, window=ref.window)
        window = from_bounds(*ref.bounds, transform=src.transform)
        resampling = Resampling.nearest if band == BAND_SCL else Resampling.bilinear
        return src.read(1, window=window, out_shape=ref.shape, resampling=resampling)


def first_scene_date(geometry: dict[str, Any]) -> date | None:
    """Konum için arşivdeki en eski Sentinel-2 L2A sahnesinin tarihi."""

    def _search() -> date | None:
        client = Client.open(STAC_URL)
        search = client.search(collections=[COLLECTION], intersects=geometry, sortby=[{"field": "datetime", "direction": "asc"}], max_items=1)
        for item in search.items():
            return item.datetime.date() if item.datetime else None
        return None

    return with_retry(_search)


def _read_scene(scene: SceneRef, geometry: dict[str, Any], roles: set[str]) -> SceneBands:
    item = scene.handle
    wanted = sorted({ROLE_TO_BAND[r] for r in roles} | {"B04", "B08"})
    hrefs = {key: planetary_computer.sign(item.assets[key].href) for key in [*wanted, BAND_SCL]}

    with rasterio.Env(**_GDAL_ENV):
        ref = _reference_window(hrefs["B04"], geometry)

    # Önce yalnızca SCL: bahçede geçerli piksel oranı düşükse (bulutlu) ek bantlar hiç indirilmez
    scl = _read_one(hrefs[BAND_SCL], ref, BAND_SCL).astype(np.uint8)
    geometry_utm = transform_geom("EPSG:4326", ref.crs, geometry)
    in_garden = garden_pixel_mask(geometry_utm, scl.shape, ref.transform)
    if in_garden.any() and (in_garden & scl_valid_mask(scl)).sum() / in_garden.sum() < MIN_VALID_RATIO:
        return SceneBands(bands={}, valid=scl_valid_mask(scl), transform=ref.transform, crs=ref.crs)

    # Tüm bantlar aynı anda okunur (ağ beklemesi baskın): sahne başına tek okuma turu
    with ThreadPoolExecutor(max_workers=_READ_THREADS) as pool:
        futures = {key: pool.submit(_read_one, hrefs[key], ref, key) for key in wanted}
        arrays = {key: future.result() for key, future in futures.items()}

    band_to_role = {v: k for k, v in ROLE_TO_BAND.items()}
    reflectance: dict[str, np.ndarray] = {}
    for key in wanted:
        scale, offset = _band_scale_offset(item, key)
        reflectance[str(band_to_role[key])] = to_reflectance(arrays[key], scale, offset)
    return SceneBands(
        bands=reflectance,
        valid=scl_valid_mask(scl),
        transform=ref.transform,
        crs=ref.crs,
    )


def read_scene(scene: SceneRef, geometry: dict[str, Any], roles: set[str] | None = None) -> SceneBands:
    """COG'lardan yalnızca bahçe penceresini okur (rasterio windowed read); geçici hatalarda tekrar dener.

    `roles`: okunacak bant rolleri (varsayılan: tüm indeksler ve gerçek renk için gerekenler).
    """
    needed = set(roles) if roles is not None else set(ALL_ROLES)
    return with_retry(lambda: _read_scene(scene, geometry, needed))


class Sentinel2L2AProvider:
    """Sentinel-2 L2A, 10 m, Planetary Computer (anahtarsız). Bulut maskesi: SCL."""

    _CAPS = Capabilities(
        ad="sentinel2-l2a",
        etiket="Sentinel-2 L2A (10 m)",
        cozunurluk_m=10.0,
        roller=frozenset(str(r) for r in ROLE_TO_BAND),
        rol_haritasi={str(r): b for r, b in ROLE_TO_BAND.items()},
        bulut_maskesi="scl",
        yapilandirildi=True,
        ucretli=False,
        notlar="Açık veri; 5 günlük (iki uydu) yeniden ziyaret, bulut maskesi SCL.",
        desteklenen_indeksler=compute_capabilities_indices(frozenset(str(r) for r in ROLE_TO_BAND)),
    )

    @property
    def capabilities(self) -> Capabilities:
        return self._CAPS

    def search_scenes(self, geometry: dict[str, Any], start: date, end: date, max_cloud: float | None = None) -> list[SceneRef]:
        return search_scenes(geometry, start, end, max_cloud)

    def first_scene_date(self, geometry: dict[str, Any]) -> date | None:
        return first_scene_date(geometry)

    def read_scene(self, scene: SceneRef, geometry: dict[str, Any], roles: set[str] | None = None) -> SceneBands:
        return read_scene(scene, geometry, roles)
