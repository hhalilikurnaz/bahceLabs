"""Microsoft Planetary Computer STAC: sahne arama ve COG'dan yalnızca bahçe penceresini okuma."""

from __future__ import annotations

import logging
import time
from collections.abc import Callable
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

from bahcelab_backend.domain.ndvi.processing import SceneData, to_reflectance

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


def _read_scene(scene: Scene, geometry: dict[str, Any]) -> SceneData:
    item = scene.item
    href = {key: planetary_computer.sign(item.assets[key].href) for key in ("B04", "B08", "SCL")}

    with rasterio.open(href["B04"]) as b04:
        crs = b04.crs
        bounds = shape(transform_geom("EPSG:4326", crs, geometry)).bounds
        window = from_bounds(*bounds, transform=b04.transform)
        window = window.round_offsets(op="floor").round_lengths(op="ceil")
        window = Window(window.col_off - 1, window.row_off - 1, window.width + 2, window.height + 2)
        window = window.intersection(Window(0, 0, b04.width, b04.height))
        transform = b04.window_transform(window)
        bounds_native = window_bounds(
            window, b04.transform
        )  # SCL penceresi aynı coğrafi alandan türetilir
        red_dn = b04.read(1, window=window)

    with rasterio.open(href["B08"]) as b08:
        nir_dn = b08.read(1, window=window)

    with rasterio.open(href["SCL"]) as scl_src:  # 20 m; 10 m ızgarasına nearest ile örneklenir
        scl_window = from_bounds(*bounds_native, transform=scl_src.transform)
        scl = scl_src.read(
            1,
            window=scl_window,
            out_shape=red_dn.shape,
            resampling=Resampling.nearest,
        )

    red_scale, red_offset = _band_scale_offset(item, "B04")
    nir_scale, nir_offset = _band_scale_offset(item, "B08")
    return SceneData(
        red=to_reflectance(red_dn, red_scale, red_offset),
        nir=to_reflectance(nir_dn, nir_scale, nir_offset),
        scl=scl.astype(np.uint8),
        transform=transform,
        crs=crs,
    )


def read_scene(scene: Scene, geometry: dict[str, Any]) -> SceneData:
    """COG'lardan yalnızca bahçe penceresini okur (rasterio windowed read); geçici hatalarda tekrar dener."""
    env = {
        "GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_DIR",
        "CPL_VSIL_CURL_ALLOWED_EXTENSIONS": ".tif,.tiff",
        "GDAL_HTTP_MAX_RETRY": "3",
        "GDAL_HTTP_RETRY_DELAY": "1",
        "VSI_CACHE": "TRUE",
    }

    def _read() -> SceneData:
        with rasterio.Env(**env):
            return _read_scene(scene, geometry)

    return with_retry(_read)
