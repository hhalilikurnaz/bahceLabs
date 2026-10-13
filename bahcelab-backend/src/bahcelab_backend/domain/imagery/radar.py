"""Sentinel-1 RTC (Planetary Computer `sentinel-1-rtc`, γ⁰ VV/VH, 10 m) sağlayıcısı (ADR 0016).

Sahne = bir GEÇİŞ: aynı göreli yörünge + aynı gün; bahçe iki dilime taşarsa dilimler birleştirilir. Yörünge numarası ve geçiş yönü
(`sat:relative_orbit`, `sat:orbit_state`) kayda yazılır: değişim yalnız AYNI yörünge ve yön içinde karşılaştırılır.
SAS imzası `planetary_computer.sign` ile alınır (anahtar gerekmez).
"""

from __future__ import annotations

import logging
from collections import Counter
from dataclasses import dataclass, field
from datetime import date
from typing import Any

import numpy as np
import planetary_computer
import rasterio
from pystac import Item
from pystac_client import Client
from rasterio.warp import transform_geom
from rasterio.windows import Window, from_bounds
from shapely.geometry import shape

from bahcelab_backend.domain.imagery.provider import ImageryError
from bahcelab_backend.domain.imagery.sentinel2 import _GDAL_ENV, STAC_URL, with_retry

logger = logging.getLogger(__name__)
COLLECTION = "sentinel-1-rtc"
YON_ADI = {"descending": "inis", "ascending": "cikis"}  # arayüzde «iniş» / «çıkış»


@dataclass(frozen=True)
class RadarRef:
    """Aranan bir geçiş (yörünge × gün). `handle`: o geçişin dilimleri (STAC item'ları)."""

    tarih: date
    scene_id: str  # geçişin ilk diliminin kimliği (sıralı) — benzersizlik için
    yorunge: int
    yon: str  # inis | cikis
    platform: str
    handle: Any = field(default=None, compare=False)


@dataclass(frozen=True)
class RadarPiece:
    """Bir dilimden okunan pencere: doğrusal γ⁰ (VH, VV), kendi 10 m ızgarası."""

    vh: np.ndarray
    vv: np.ndarray
    transform: Any
    crs: Any


@dataclass(frozen=True)
class OrbitInfo:
    yorunge: int
    yon: str
    sahne_sayisi: int
    yillik: dict[int, int]


def _yon(item: Item) -> str:
    return YON_ADI.get(str(item.properties.get("sat:orbit_state", "")).lower(), "bilinmiyor")


def _passes(items: list[Item]) -> list[RadarRef]:
    groups: dict[tuple[int, str, date], list[Item]] = {}
    for item in items:
        orbit = item.properties.get("sat:relative_orbit")
        if orbit is None or item.datetime is None:
            continue
        groups.setdefault((int(orbit), _yon(item), item.datetime.date()), []).append(item)
    refs = []
    for (orbit, yon, day), group in groups.items():
        group.sort(key=lambda i: i.id)
        refs.append(RadarRef(tarih=day, scene_id=group[0].id, yorunge=orbit, yon=yon, platform=str(group[0].properties.get("platform", "")).upper(), handle=group))
    return sorted(refs, key=lambda r: (r.tarih, r.yorunge))


def _window(href: str, geometry: dict[str, Any]) -> tuple[Window, Any, Any]:
    with rasterio.Env(**_GDAL_ENV), rasterio.open(href) as src:
        bounds = shape(transform_geom("EPSG:4326", src.crs, geometry)).bounds
        window = from_bounds(*bounds, transform=src.transform).round_offsets(op="floor").round_lengths(op="ceil")
        window = Window(window.col_off - 1, window.row_off - 1, window.width + 2, window.height + 2).intersection(Window(0, 0, src.width, src.height))
        return window, src.window_transform(window), src.crs


def _read_item(item: Item, geometry: dict[str, Any]) -> RadarPiece:
    vh_href = planetary_computer.sign(item.assets["vh"].href)
    vv_href = planetary_computer.sign(item.assets["vv"].href)
    window, transform, crs = _window(vv_href, geometry)
    with rasterio.Env(**_GDAL_ENV):
        with rasterio.open(vh_href) as src:
            vh = src.read(1, window=window).astype(np.float32)
        with rasterio.open(vv_href) as src:
            vv = src.read(1, window=window).astype(np.float32)
    return RadarPiece(vh=vh, vv=vv, transform=transform, crs=crs)


class PlanetaryRadarProvider:
    """Planetary Computer `sentinel-1-rtc`. Ağ çağrıları geçici hatalarda tekrar denenir; kullanıcıya gösterilebilir `ImageryError` verir."""

    source_id = "sentinel1-rtc"

    def search(self, geometry: dict[str, Any], start: date, end: date) -> list[RadarRef]:
        def _search() -> list[Item]:
            client = Client.open(STAC_URL)
            return list(client.search(collections=[COLLECTION], intersects=geometry, datetime=f"{start.isoformat()}/{end.isoformat()}", max_items=3000).items())

        garden = shape(geometry)
        items = [i for i in with_retry(_search) if i.geometry and shape(i.geometry).intersects(garden)]
        return _passes(items)

    def orbit_summary(self, geometry: dict[str, Any], start: date, end: date) -> list[OrbitInfo]:
        """Bahçeyi kapsayan yörüngeler (en sık geçen ilk): geçiş sayısı ve yıl yıl dağılım."""
        refs = self.search(geometry, start, end)
        counts: Counter[tuple[int, str]] = Counter((r.yorunge, r.yon) for r in refs)
        out = []
        for (orbit, yon), n in counts.most_common():
            yearly = Counter(r.tarih.year for r in refs if (r.yorunge, r.yon) == (orbit, yon))
            out.append(OrbitInfo(orbit, yon, n, dict(sorted(yearly.items()))))
        return out

    def read(self, ref: RadarRef, geometry: dict[str, Any]) -> list[RadarPiece]:
        """Geçişin dilimlerini (genelde 1) okur; her dilim kendi penceresiyle."""
        if not ref.handle:
            raise ImageryError("Radar sahnesi okunamadı: kaynak bilgisi yok.")
        pieces: list[RadarPiece] = []
        for item in ref.handle:
            pieces.append(with_retry(lambda it=item: _read_item(it, geometry)))  # type: ignore[misc]
        return pieces
