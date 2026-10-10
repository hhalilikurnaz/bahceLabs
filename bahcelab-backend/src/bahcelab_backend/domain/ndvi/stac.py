"""Microsoft Planetary Computer STAC: sahne arama ve COG'dan yalnızca bahçe penceresini okuma."""

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

from bahcelab_backend.domain.ndvi.indices import ALL_BANDS, BAND_SCL, BANDS_10M
from bahcelab_backend.domain.ndvi.processing import SceneBands, to_reflectance

logger = logging.getLogger(__name__)

STAC_URL = "https://planetarycomputer.microsoft.com/api/stac/v1"
COLLECTION = "sentinel-2-l2a"


class NdviSourceError(Exception):
    """Uydu verisi kaynağına ulaşılamadı veya okunamadı (kullanıcıya gösterilebilir mesaj taşır)."""


@dataclass(frozen=True)
class Scene:
    tarih: date
    scene_id: str
    bulut_orani: float | None
    item: Item


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
    raise NdviSourceError(
        "Uydu verisi kaynağına (Planetary Computer) ulaşılamadı. "
        "Bağlantınızı kontrol edip biraz sonra tekrar deneyin."
    ) from last


def search_scenes(geometry: dict[str, Any], start: date, end: date) -> list[Scene]:
    """Bahçeyi kapsayan Sentinel-2 L2A sahneleri; aynı tarihte birden fazla ise en çok örten seçilir."""

    def _search() -> list[Item]:
        client = Client.open(STAC_URL)
        search = client.search(
            collections=[COLLECTION],
            intersects=geometry,
            datetime=f"{start.isoformat()}/{end.isoformat()}",
            max_items=600,
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
            shape(item.geometry).intersection(garden).area / garden.area if garden.area else 0.0
        )
        cloud = float(item.properties.get("eo:cloud_cover", 100.0))
        key = (overlap, -cloud)
        if day not in best or key > best[day][:2]:
            best[day] = (overlap, -cloud, item)

    scenes = [
        Scene(
            tarih=day,
            scene_id=item.id,
            bulut_orani=float(item.properties["eo:cloud_cover"])
            if "eo:cloud_cover" in item.properties
            else None,
            item=item,
        )
        for day, (_, _, item) in best.items()
    ]
    return sorted(scenes, key=lambda s: s.tarih)


def _band_scale_offset(item: Item, asset_key: str) -> tuple[float, float]:
    bands = item.assets[asset_key].extra_fields.get("raster:bands") or [{}]
    return float(bands[0].get("scale", 0.0001)), float(bands[0].get("offset", 0.0))


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


def _read_scene(scene: Scene, geometry: dict[str, Any], bands: set[str]) -> SceneBands:
    item = scene.item
    wanted = sorted(set(bands) | {"B04", "B08"})
    hrefs = {key: planetary_computer.sign(item.assets[key].href) for key in [*wanted, BAND_SCL]}

    with rasterio.Env(**_GDAL_ENV):
        ref = _reference_window(hrefs["B04"], geometry)

    # Tüm bantlar aynı anda okunur (ağ beklemesi baskın): sahne başına tek okuma turu
    with ThreadPoolExecutor(max_workers=_READ_THREADS) as pool:
        futures = {key: pool.submit(_read_one, hrefs[key], ref, key) for key in [*wanted, BAND_SCL]}
        arrays = {key: future.result() for key, future in futures.items()}

    reflectance: dict[str, np.ndarray] = {}
    for key in wanted:
        scale, offset = _band_scale_offset(item, key)
        reflectance[key] = to_reflectance(arrays[key], scale, offset)
    return SceneBands(
        bands=reflectance,
        scl=arrays[BAND_SCL].astype(np.uint8),
        transform=ref.transform,
        crs=ref.crs,
    )


def read_scene(scene: Scene, geometry: dict[str, Any], bands: set[str] | None = None) -> SceneBands:
    """COG'lardan yalnızca bahçe penceresini okur (rasterio windowed read); geçici hatalarda tekrar dener.

    `bands`: okunacak bantlar (varsayılan: tüm indeksler ve gerçek renk için gerekenler).
    """
    needed = set(bands) if bands is not None else set(ALL_BANDS)
    return with_retry(lambda: _read_scene(scene, geometry, needed))
