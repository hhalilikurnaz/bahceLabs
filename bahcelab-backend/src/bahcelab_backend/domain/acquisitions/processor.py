"""Ay görevi (ADR 0015): bir bahçe × ay için en iyi net sahneleri seçer, göstergeleri hesaplar, ızgara + istatistik yazar.

İDEMPOTENT: görev yalnızca bekleyen/hatalı ayı «işleniyor» yapabilen tek işçiye verilir; aynı sahne ikinci kez edinilmez
(`uq_acquisition_scene`). Sağlayıcı ve depolama enjekte edilir (testte ağ yok). Uydurma yok: bulutlu ay eksik kalır.
"""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from datetime import UTC, date, datetime
from typing import Any

import numpy as np
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from bahcelab_backend.config import Settings, get_settings
from bahcelab_backend.domain.acquisitions.models import (
    ACQ_CLOUDY,
    ACQ_ERROR,
    ACQ_NET,
    MONTH_DONE,
    MONTH_ERROR,
    AcquisitionModel,
)
from bahcelab_backend.domain.acquisitions.repository import AcquisitionRepository
from bahcelab_backend.domain.acquisitions.selection import (
    is_spaced,
    month_last,
    next_candidate_order,
)
from bahcelab_backend.domain.acquisitions.store import encode_grids, grid_key, pixel_stats
from bahcelab_backend.domain.imagery.formulas import (
    FORMULA_VERSION,
    ROLES_NEEDED,
    compute_indicators,
)
from bahcelab_backend.domain.imagery.provider import ImageryError, ImageryProvider, SceneRef
from bahcelab_backend.domain.multiyear.grid import align_to_grid, canonical_grid, garden_mask
from bahcelab_backend.domain.ndvi.processing import MIN_VALID_RATIO
from bahcelab_backend.shared.storage import StorageBackend

logger = logging.getLogger(__name__)
SessionFactory = async_sessionmaker[AsyncSession]
SOURCE_ID = "sentinel2-l2a"


async def process_month(
    factory: SessionFactory,
    provider: ImageryProvider,
    storage: StorageBackend,
    garden_id: uuid.UUID,
    month: date,
    *,
    settings: Settings | None = None,
    force: bool = False,
    today: date | None = None,
) -> str:
    """Dönüş: 'tamam' | 'hata' | 'atlandi' (başka işçi aldı / zaten tamam)."""
    cfg = settings or get_settings()
    started = time.monotonic()
    today = today or datetime.now(UTC).date()
    async with factory() as session:
        repo = AcquisitionRepository(session)
        if not await repo.claim_month(garden_id, SOURCE_ID, month, force=force):
            await session.rollback()
            return "atlandi"
        geometry = await repo.geometry_geojson(garden_id)
        await session.commit()
    if geometry is None:  # bahçe arada silinmiş
        return "atlandi"

    status, error, net_count, tried = MONTH_DONE, None, 0, 0
    try:
        first, last = month, min(month_last(month), today)
        grid = canonical_grid(geometry)
        mask = garden_mask(grid, geometry)
        refs = await asyncio.to_thread(provider.search_scenes, geometry, first, last, cfg.acq_max_cloud)
        async with factory() as session:
            known = {a.scene_id: a for a in await AcquisitionRepository(session).acquisitions_between(garden_id, SOURCE_ID, first, last)}
        accepted = sorted(a.tarih for a in known.values() if a.durum == ACQ_NET and a.formul_surumu == FORMULA_VERSION)
        # Formül sürümü eskiyse (ya da hata kaydıysa) sahne yeniden okunur; güncel net edinimler bütçeye sayılır
        candidates = next_candidate_order([(r.tarih, r.bulut_orani, r.scene_id) for r in refs])
        by_id = {r.scene_id: r for r in refs}
        for tarih, _cloud, scene_id in candidates:
            if len(accepted) >= cfg.acq_scenes_per_month or tried >= cfg.acq_max_candidates_per_month:
                break
            prior = known.get(scene_id)
            if prior is not None and (prior.durum == ACQ_CLOUDY or (prior.durum == ACQ_NET and prior.formul_surumu == FORMULA_VERSION)):
                continue  # daha önce denendi: bulutlu sahne tekrar okunmaz; güncel net sahne zaten sayıldı
            if not is_spaced(tarih, accepted, cfg.acq_min_gap_days):
                continue
            tried += 1
            row = await _acquire(factory, provider, storage, garden_id, by_id[scene_id], geometry, grid, mask, today)
            if row == ACQ_NET:
                accepted.append(tarih)
        net_count = len(accepted)
    except ImageryError as exc:
        status, error = MONTH_ERROR, str(exc)
    except Exception:  # noqa: BLE001
        logger.exception("Ay görevi beklenmedik şekilde başarısız: %s %s", garden_id, month)
        status, error = MONTH_ERROR, "Bu ay işlenirken beklenmeyen bir hata oluştu. Tekrar deneyin."

    async with factory() as session:
        await AcquisitionRepository(session).finish_month(garden_id, SOURCE_ID, month, status=status, net=net_count, candidates=tried, error=error, seconds=time.monotonic() - started)
        await session.commit()
    return status


async def _acquire(
    factory: SessionFactory, provider: ImageryProvider, storage: StorageBackend, garden_id: uuid.UUID, ref: SceneRef, geometry: dict[str, Any], grid: Any, mask: np.ndarray, today: date
) -> str:
    """Bir sahneyi okur; net ise ızgara + istatistik yazar. Dönüş: 'net' | 'bulutlu' | 'hata'."""
    row = AcquisitionModel(garden_id=garden_id, source_id=SOURCE_ID, scene_id=ref.scene_id, tarih=ref.tarih, bulut_orani=ref.bulut_orani, durum=ACQ_ERROR, gecikme_gun=(today - ref.tarih).days)
    stats: dict[str, Any] = {}
    try:
        scene = await asyncio.to_thread(provider.read_scene, ref, geometry, set(ROLES_NEEDED))
        row.isleme_surumu = scene.isleme_surumu
        if not scene.bands:  # SCL ile bulutlu: ek bantlar hiç okunmadı
            row.durum = ACQ_CLOUDY
        else:
            indicators = compute_indicators(scene)
            aligned = {name: align_to_grid(values, scene.transform, scene.crs.to_epsg(), grid) for name, values in indicators.items()}
            if any(a is None for a in aligned.values()):
                raise ImageryError("Sahne kanonik ızgaraya hizalanamadı.")
            grids = {name: a for name, a in aligned.items() if a is not None}
            total = int(mask.sum()) or 1
            ratio = float((mask & np.isfinite(grids["ndvi"])).sum()) / total
            row.gecerli_oran = round(ratio, 4)
            if ratio < MIN_VALID_RATIO:
                row.durum = ACQ_CLOUDY
            else:
                data = encode_grids(grids)
                key = grid_key(garden_id, ref.scene_id)
                storage.save(key, data)
                row.durum, row.izgara_yolu, row.izgara_boyut_bayt, row.formul_surumu = ACQ_NET, key, len(data), FORMULA_VERSION
                stats = {name: s for name, g in grids.items() if (s := pixel_stats(g, mask)) is not None}
    except Exception as exc:  # noqa: BLE001 - tek sahne hatası ayı durdurmaz
        row.durum, row.hata_mesaji = ACQ_ERROR, str(exc)[:300]
        logger.warning("Edinim hatası: sahne=%s: %s", ref.scene_id, exc)
    async with factory() as session:
        await AcquisitionRepository(session).upsert_acquisition(row, stats)
        await session.commit()
    return row.durum
