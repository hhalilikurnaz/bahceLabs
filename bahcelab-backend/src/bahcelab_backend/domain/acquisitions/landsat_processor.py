"""Landsat yüzey sıcaklığı ay görevi (ADR 0017): bir bahçe × ay için TÜM sahneleri okur; °C ızgarası (kanonik 10 m, en yakın komşu) + bahçe ve tampon istatistikleri yazar.

Ürün 30 m (ızgarada 3×3 blok), fiziksel çözünürlük 100 m. Bahçe ve 300 m tampon AYRI saklanır: `st_c` (bahçe), `st_tampon` (tampon halkası) — karışık piksel uyarısı için.
İDEMPOTENT: aynı sahne ikinci kez edinilmez (güncel formül sürümüyle). Bulutlu/gölgeli sahne `bulutlu` olarak kaydedilir (bir daha okunmaz).
"""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from datetime import UTC, date, datetime
from typing import Any, Protocol

import numpy as np
from rasterio.features import geometry_mask
from rasterio.warp import Resampling, reproject, transform_geom
from shapely.geometry import mapping, shape
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from bahcelab_backend.config import Settings
from bahcelab_backend.domain.acquisitions.models import (
    ACQ_CLOUDY,
    ACQ_ERROR,
    ACQ_NET,
    MONTH_DONE,
    MONTH_ERROR,
    AcquisitionModel,
)
from bahcelab_backend.domain.acquisitions.repository import AcquisitionRepository
from bahcelab_backend.domain.acquisitions.selection import month_last
from bahcelab_backend.domain.acquisitions.store import PixelStats, encode_grids, pixel_stats
from bahcelab_backend.domain.imagery.landsat import LandsatPiece, LandsatRef
from bahcelab_backend.domain.imagery.provider import ImageryError
from bahcelab_backend.domain.multiyear.grid import CanonicalGrid, canonical_grid, garden_mask
from bahcelab_backend.domain.ndvi.processing import MIN_VALID_RATIO
from bahcelab_backend.shared.storage import StorageBackend

logger = logging.getLogger(__name__)
SessionFactory = async_sessionmaker[AsyncSession]
LANDSAT_SOURCE = "landsat-c2-l2"
FORMULA_VERSION = "landsat-c2l2-st-v1"
BUFFER_M = 300.0
MIN_RING_PIXELS = 5


class LandsatProvider(Protocol):
    def search(self, geometry: dict[str, Any], start: date, end: date) -> list[LandsatRef]: ...
    def read(self, ref: LandsatRef, geometry: dict[str, Any], buffer_m: float = ...) -> LandsatPiece: ...


def landsat_grid_key(garden_id: object, scene_id: str) -> str:
    return f"acq-landsat/{garden_id}/{scene_id}.npz"


def to_canonical(piece: LandsatPiece, grid: CanonicalGrid) -> np.ndarray:
    """30 m pencere → bahçenin kanonik 10 m ızgarası (en yakın komşu; yumuşatılmış ara değer üretilmez)."""
    out = np.full(grid.shape, np.nan, dtype=np.float32)
    reproject(piece.sicaklik_c, out, src_transform=piece.transform, src_crs=piece.crs, dst_transform=grid.transform, dst_crs=grid.crs, resampling=Resampling.nearest, src_nodata=np.nan, dst_nodata=np.nan)
    return out


def ring_values(piece: LandsatPiece, geometry: dict[str, Any], buffer_m: float = BUFFER_M) -> np.ndarray:
    """Tampon halkasının (bahçe çokgeni hariç, `buffer_m` içi) geçerli piksel değerleri (°C)."""
    garden = shape(transform_geom("EPSG:4326", piece.crs, geometry))
    ring = garden.buffer(buffer_m).difference(garden)
    inside = ~geometry_mask([mapping(ring)], out_shape=piece.sicaklik_c.shape, transform=piece.transform)
    values = piece.sicaklik_c[inside]
    return values[np.isfinite(values)]


def ring_stats(values: np.ndarray) -> PixelStats | None:
    if values.size < MIN_RING_PIXELS:
        return None
    p10, p25, p50, p75, p90 = (float(np.percentile(values, q)) for q in (10, 25, 50, 75, 90))
    return PixelStats(float(values.mean()), p50, p10, p25, p75, p90, float(values.min()), float(values.max()), int(values.size))


async def process_landsat_month(
    factory: SessionFactory,
    provider: LandsatProvider,
    storage: StorageBackend,
    garden_id: uuid.UUID,
    month: date,
    *,
    settings: Settings | None = None,
    force: bool = False,
    today: date | None = None,
) -> str:
    started = time.monotonic()
    today = today or datetime.now(UTC).date()
    async with factory() as session:
        repo = AcquisitionRepository(session)
        if not await repo.claim_month(garden_id, LANDSAT_SOURCE, month, force=force):
            await session.rollback()
            return "atlandi"
        geometry = await repo.geometry_geojson(garden_id)
        await session.commit()
    if geometry is None:
        return "atlandi"

    status, error, net_count, failed = MONTH_DONE, None, 0, 0
    try:
        first, last = month, min(month_last(month), today)
        grid = canonical_grid(geometry)
        mask = garden_mask(grid, geometry)
        refs = await asyncio.to_thread(provider.search, geometry, first, last)
        async with factory() as session:
            known = {a.scene_id: a for a in await AcquisitionRepository(session).acquisitions_between(garden_id, LANDSAT_SOURCE, first, last)}
        for ref in refs:
            prior = known.get(ref.scene_id)
            if prior is not None and prior.formul_surumu == FORMULA_VERSION and prior.durum in (ACQ_NET, ACQ_CLOUDY):
                net_count += prior.durum == ACQ_NET
                continue
            outcome = await _acquire(factory, provider, storage, garden_id, ref, geometry, grid, mask, today)
            net_count += outcome == ACQ_NET
            failed += outcome == ACQ_ERROR
        if failed:
            status, error = MONTH_ERROR, f"{failed} sahne okunamadı; yeniden denenecek."
    except ImageryError as exc:
        status, error = MONTH_ERROR, str(exc)
    except Exception:  # noqa: BLE001
        logger.exception("Landsat ay görevi beklenmedik şekilde başarısız: %s %s", garden_id, month)
        status, error = MONTH_ERROR, "Bu ay işlenirken beklenmeyen bir hata oluştu. Tekrar deneyin."
    async with factory() as session:
        await AcquisitionRepository(session).finish_month(garden_id, LANDSAT_SOURCE, month, status=status, net=net_count, candidates=net_count, error=error, seconds=time.monotonic() - started)
        await session.commit()
    return status


async def _acquire(
    factory: SessionFactory, provider: LandsatProvider, storage: StorageBackend, garden_id: uuid.UUID, ref: LandsatRef, geometry: dict[str, Any], grid: CanonicalGrid, mask: np.ndarray, today: date
) -> str:
    row = AcquisitionModel(garden_id=garden_id, source_id=LANDSAT_SOURCE, scene_id=ref.scene_id, tarih=ref.tarih, bulut_orani=ref.bulut_orani, durum=ACQ_ERROR, gecikme_gun=(today - ref.tarih).days, isleme_surumu=f"L{ref.platform[-1]}" if ref.platform else None, formul_surumu=FORMULA_VERSION)
    stats: dict[str, PixelStats] = {}
    try:
        piece = await asyncio.to_thread(provider.read, ref, geometry, BUFFER_M)
        celsius = to_canonical(piece, grid)
        total = int(mask.sum()) or 1
        ratio = float((mask & np.isfinite(celsius)).sum()) / total
        row.gecerli_oran = round(ratio, 4)
        if ratio < MIN_VALID_RATIO:
            row.durum = ACQ_CLOUDY
        else:
            garden_stat = pixel_stats(celsius, mask)
            if garden_stat is None:
                raise ImageryError("Bahçede geçerli sıcaklık pikseli yok.")
            stats["st_c"] = garden_stat
            if (ring := ring_stats(ring_values(piece, geometry))) is not None:
                stats["st_tampon"] = ring
            data = encode_grids({"st_c": celsius})
            key = landsat_grid_key(garden_id, ref.scene_id)
            storage.save(key, data)
            row.durum, row.izgara_yolu, row.izgara_boyut_bayt = ACQ_NET, key, len(data)
    except Exception as exc:  # noqa: BLE001
        row.durum, row.hata_mesaji = ACQ_ERROR, str(exc)[:300]
        logger.warning("Landsat edinim hatası: sahne=%s: %s", ref.scene_id, exc)
    async with factory() as session:
        await AcquisitionRepository(session).upsert_acquisition(row, stats)
        await session.commit()
    return row.durum
