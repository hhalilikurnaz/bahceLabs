"""Radar ay görevi (ADR 0016): bir bahçe × ay için TÜM geçişleri (üst sınır yok) okur; her geçiş için göstergeleri hesaplar.

Birincil yörünge (bahçeyi en sık geçen): Lee filtreli gösterge ızgarası (float16) + istatistik. Diğer yörüngeler: yalnız istatistik.
Maskelenen (gölge/üst üste binme/geçersiz) piksel oranı her kayda yazılır. İDEMPOTENT: aynı geçiş ikinci kez edinilmez (güncel formül sürümüyle).
"""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from datetime import UTC, date, datetime
from typing import Any, Protocol

import numpy as np
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from bahcelab_backend.config import Settings, get_settings
from bahcelab_backend.domain.acquisitions.models import (
    ACQ_ERROR,
    ACQ_NET,
    MONTH_DONE,
    MONTH_ERROR,
    AcquisitionModel,
)
from bahcelab_backend.domain.acquisitions.repository import AcquisitionRepository
from bahcelab_backend.domain.acquisitions.selection import month_last
from bahcelab_backend.domain.acquisitions.store import encode_grids, radar_grid_key
from bahcelab_backend.domain.agro import catalog as cat
from bahcelab_backend.domain.imagery import radar_math as rm
from bahcelab_backend.domain.imagery.provider import ImageryError
from bahcelab_backend.domain.imagery.radar import OrbitInfo, RadarPiece, RadarRef
from bahcelab_backend.domain.imagery.radar_indicators import radar_grids, radar_stats
from bahcelab_backend.domain.multiyear.grid import (
    CanonicalGrid,
    align_to_grid,
    canonical_grid,
    garden_mask,
)
from bahcelab_backend.shared.storage import StorageBackend

logger = logging.getLogger(__name__)
SessionFactory = async_sessionmaker[AsyncSession]
RADAR_SOURCE = "sentinel1-rtc"


class RadarProvider(Protocol):
    def search(self, geometry: dict[str, Any], start: date, end: date) -> list[RadarRef]: ...
    def orbit_summary(self, geometry: dict[str, Any], start: date, end: date) -> list[OrbitInfo]: ...
    def read(self, ref: RadarRef, geometry: dict[str, Any]) -> list[RadarPiece]: ...


async def ensure_orbits(session: AsyncSession, provider: RadarProvider, garden_id: uuid.UUID, geometry: dict[str, Any], start: date, today: date, *, refresh: bool = False) -> tuple[int, str] | None:
    """Bahçenin yörünge özetini (en sık geçen = birincil) kurar; varsa yeniden kullanır. Dönüş: birincil (yörünge, yön) ya da None (radar yok)."""
    repo = AcquisitionRepository(session)
    if not refresh and (primary := await repo.primary_orbit(garden_id)) is not None:
        return primary
    summary = await asyncio.to_thread(provider.orbit_summary, geometry, start, today)
    await repo.replace_orbits(garden_id, [(o.yorunge, o.yon, o.sahne_sayisi) for o in summary])
    await session.flush()
    return await repo.primary_orbit(garden_id)


def combine_pieces(pieces: list[RadarPiece], grid: CanonicalGrid) -> tuple[np.ndarray, np.ndarray] | None:
    """Dilimleri kanonik ızgaraya hizalar; örtüşen yerlerde ilk geçerli değer. Hizalanamazsa None."""
    vh = np.full(grid.shape, np.nan, dtype=np.float32)
    vv = np.full(grid.shape, np.nan, dtype=np.float32)
    for piece in pieces:
        a = align_to_grid(piece.vh, piece.transform, piece.crs.to_epsg(), grid)
        b = align_to_grid(piece.vv, piece.transform, piece.crs.to_epsg(), grid)
        if a is None or b is None:
            return None
        a = np.where(a == rm.RADAR_NODATA, np.nan, a)
        b = np.where(b == rm.RADAR_NODATA, np.nan, b)
        vh = np.where(np.isfinite(vh), vh, a)
        vv = np.where(np.isfinite(vv), vv, b)
    return vh, vv


async def process_radar_month(
    factory: SessionFactory,
    provider: RadarProvider,
    storage: StorageBackend,
    garden_id: uuid.UUID,
    month: date,
    *,
    settings: Settings | None = None,
    force: bool = False,
    today: date | None = None,
) -> str:
    """Dönüş: 'tamam' | 'hata' | 'atlandi'."""
    cfg = settings or get_settings()
    started = time.monotonic()
    today = today or datetime.now(UTC).date()
    async with factory() as session:
        repo = AcquisitionRepository(session)
        if not await repo.claim_month(garden_id, RADAR_SOURCE, month, force=force):
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
        async with factory() as session:
            primary = await ensure_orbits(session, provider, garden_id, geometry, date.fromisoformat(cfg.acq_radar_start), today)
            await session.commit()
        refs = await asyncio.to_thread(provider.search, geometry, first, last)
        async with factory() as session:
            known = {a.scene_id: a for a in await AcquisitionRepository(session).acquisitions_between(garden_id, RADAR_SOURCE, first, last)}
        for ref in refs:
            prior = known.get(ref.scene_id)
            if prior is not None and prior.durum == ACQ_NET and prior.formul_surumu == rm.FORMULA_VERSION:
                net_count += 1
                continue
            outcome = await _acquire(factory, provider, storage, garden_id, ref, geometry, grid, mask, today, is_primary=primary == (ref.yorunge, ref.yon))
            if outcome == ACQ_NET:
                net_count += 1
            elif outcome == ACQ_ERROR:
                failed += 1
        if failed:  # okunamayan geçiş varsa ay «hata» kalır: kaldığı yerden devam eder, yalnız eksik geçişler yeniden okunur
            status, error = MONTH_ERROR, f"{failed} geçiş okunamadı; yeniden denenecek."
    except ImageryError as exc:
        status, error = MONTH_ERROR, str(exc)
    except Exception:  # noqa: BLE001
        logger.exception("Radar ay görevi beklenmedik şekilde başarısız: %s %s", garden_id, month)
        status, error = MONTH_ERROR, "Bu ay işlenirken beklenmeyen bir hata oluştu. Tekrar deneyin."

    async with factory() as session:
        await AcquisitionRepository(session).finish_month(garden_id, RADAR_SOURCE, month, status=status, net=net_count, candidates=net_count, error=error, seconds=time.monotonic() - started)
        await session.commit()
    return status


async def _acquire(
    factory: SessionFactory, provider: RadarProvider, storage: StorageBackend, garden_id: uuid.UUID, ref: RadarRef, geometry: dict[str, Any], grid: CanonicalGrid, mask: np.ndarray, today: date, *, is_primary: bool
) -> str:
    rule = cat.load_catalog().radar
    item = (ref.handle or [None])[0]
    baseline = str(getattr(item, "properties", {}).get("s1:orbit_source", "")) or None if item is not None else None
    row = AcquisitionModel(
        garden_id=garden_id, source_id=RADAR_SOURCE, scene_id=ref.scene_id, tarih=ref.tarih, durum=ACQ_ERROR, gecikme_gun=(today - ref.tarih).days,
        yorunge=ref.yorunge, gecis_yonu=ref.yon, isleme_surumu=baseline[:10] if baseline else None,
    )
    stats: dict[str, Any] = {}
    try:
        pieces = await asyncio.to_thread(provider.read, ref, geometry)
        combined = combine_pieces(pieces, grid)
        if combined is None:
            raise ImageryError("Radar sahnesi kanonik ızgaraya hizalanamadı.")
        vh, vv = combined
        valid = rm.valid_mask(vh, vv, shadow_vh_db=rule.golge_vh_alt_db, overlay_vv_db=rule.ust_uste_vv_ust_db)
        total = int(mask.sum()) or 1
        masked = 1.0 - float((mask & valid).sum()) / total
        row.maskeli_oran, row.gecerli_oran = round(masked, 4), round(1.0 - masked, 4)
        stats = radar_stats(vh, vv, valid, mask)
        if not stats:
            row.hata_mesaji = "Bahçenin tamamı maskeli ya da kapsam dışı."
        else:
            row.durum, row.formul_surumu = ACQ_NET, rm.FORMULA_VERSION
            if is_primary:  # birincil yörünge: Lee filtreli gösterge ızgarası saklanır; diğerleri yalnız istatistik
                data = encode_grids(radar_grids(vh, vv, valid, size=rule.lee_pencere, looks=rule.lee_bakis))
                key = radar_grid_key(garden_id, ref.scene_id)
                storage.save(key, data)
                row.izgara_yolu, row.izgara_boyut_bayt = key, len(data)
    except Exception as exc:  # noqa: BLE001
        row.durum, row.hata_mesaji = ACQ_ERROR, str(exc)[:300]
        logger.warning("Radar edinim hatası: sahne=%s: %s", ref.scene_id, exc)
    async with factory() as session:
        await AcquisitionRepository(session).upsert_acquisition(row, stats)
        await session.commit()
    return row.durum
