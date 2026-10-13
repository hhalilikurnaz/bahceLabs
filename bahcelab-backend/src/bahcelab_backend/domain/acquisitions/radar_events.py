"""Radar değişim olaylarını kurar (ADR 0016): birincil yörüngenin uygun sahneleri → `change_events`. Bildirim üretmez (9F tüketir)."""

from __future__ import annotations

import uuid
from datetime import date, timedelta
from typing import Any

import numpy as np
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.config import get_settings
from bahcelab_backend.domain.acquisitions import radar_changes as rc
from bahcelab_backend.domain.acquisitions.models import (
    ACQ_NET,
    AcquisitionModel,
    AcquisitionStatModel,
    ChangeEventModel,
)
from bahcelab_backend.domain.acquisitions.radar_processor import RADAR_SOURCE
from bahcelab_backend.domain.acquisitions.repository import AcquisitionRepository
from bahcelab_backend.domain.acquisitions.store import decode_grids
from bahcelab_backend.domain.agro import catalog as cat
from bahcelab_backend.domain.imagery import radar_math as rm
from bahcelab_backend.shared.storage import StorageBackend

PIXEL_M2 = 100.0


def band_limits(rows: list[Any]) -> dict[int, rc.BandLimits]:
    """Ay → normal bandın dış sınırı: p10–p90 yeterliyse o, değilse p25–p75; ikisi de yetersizse ay yok (kalıcı sapma «bant_yok»)."""
    out: dict[int, rc.BandLimits] = {}
    for b in rows:
        if b.onluk_yeterli and b.p10 is not None and b.p90 is not None:
            out[b.ay] = rc.BandLimits(float(b.p10), float(b.p90))
        elif b.ceyrek_yeterli and b.p25 is not None and b.p75 is not None:
            out[b.ay] = rc.BandLimits(float(b.p25), float(b.p75))
    return out


async def _daily_rain(session: AsyncSession, center: tuple[float, float], days: list[date]) -> list[float | None]:
    """Önbellekteki günlük yağış (mm); hücre ya da gün yoksa None (uydurma yok)."""
    from bahcelab_backend.domain.weather.service import snap

    step = get_settings().weather_cell_degrees
    lat, lng = snap(center[0], step), snap(center[1], step)
    cell = (await session.execute(text("SELECT id FROM weather_cells WHERE enlem = :a AND boylam = :b"), {"a": lat, "b": lng})).scalar_one_or_none()
    if cell is None:
        return [None for _ in days]
    rows = (await session.execute(text("SELECT tarih, yagis_mm FROM weather_daily WHERE cell_id = :c AND tarih = ANY(:d)"), {"c": cell, "d": days})).all()
    by_day = {r[0]: r[1] for r in rows}
    return [by_day.get(d) for d in days]


async def compute_change_events_for(session: AsyncSession, storage: StorageBackend, garden_id: uuid.UUID) -> int:
    """Tüm geçmişi yeniden değerlendirir (idempotent). Dönüş: yazılan olay sayısı (aday + gürültü)."""
    repo = AcquisitionRepository(session)
    primary = await repo.primary_orbit(garden_id)
    if primary is None:
        return 0
    radar_rule = cat.load_catalog().radar
    rule = rc.ChangeRule(radar_rule.anlamli_degisim_db, radar_rule.anlamli_alan_orani, radar_rule.ani_baseline_sahne, radar_rule.art_arda_sahne)
    acquisitions = (
        await session.execute(
            select(AcquisitionModel, AcquisitionStatModel.ortalama)
            .join(AcquisitionStatModel, (AcquisitionStatModel.acquisition_id == AcquisitionModel.id) & (AcquisitionStatModel.indeks == "vh_db"))
            .where(
                AcquisitionModel.garden_id == garden_id, AcquisitionModel.source_id == RADAR_SOURCE, AcquisitionModel.durum == ACQ_NET,
                AcquisitionModel.yorunge == primary[0], AcquisitionModel.gecis_yonu == primary[1], AcquisitionModel.izgara_yolu.is_not(None),
                AcquisitionModel.maskeli_oran <= radar_rule.azami_maske_orani,  # bahçenin >%30'u maskeliyse sahne değişim hesabına girmez
            )
            .order_by(AcquisitionModel.tarih)
        )
    ).all()
    limits = band_limits([b for b in await repo.bands(garden_id, RADAR_SOURCE) if b.indeks == "vh_db"])
    samples: list[rc.SceneSample] = []
    for acq, mean_db in acquisitions:
        if not acq.izgara_yolu or not storage.exists(acq.izgara_yolu):
            continue
        grid = decode_grids(storage.read(acq.izgara_yolu)).get("vh_db")
        if grid is None:
            continue
        samples.append(rc.SceneSample(acq.tarih, acq.scene_id, grid, float(mean_db), limits.get(acq.tarih.month)))
    results = rc.evaluate_series(samples, rule)

    center = await repo.garden_center(garden_id)
    rows: list[ChangeEventModel] = []
    for r in results:
        days = [r.tarih - timedelta(days=2), r.tarih - timedelta(days=1), r.tarih]  # ≈ önceki 48 saat (günlük çözünürlük)
        wet, rain = rc.wet_note(await _daily_rain(session, center, days) if center else [None], radar_rule.yagis_esigi_mm)
        rows.append(
            ChangeEventModel(
                garden_id=garden_id, source_id=RADAR_SOURCE, scene_id=r.scene_id, tarih=r.tarih, yorunge=primary[0], gecis_yonu=primary[1], durum=r.durum, isaret=r.isaret,
                alan_orani=r.alan_orani, alan_m2=round(r.alan_pikseli * PIXEL_M2, 1), buyukluk_db=r.buyukluk_db, bahce_delta_db=None if np.isnan(r.bahce_delta_db) else r.bahce_delta_db,
                kalici_sapma=r.kalici_sapma, art_arda=r.art_arda, islaklik_olabilir=wet, yagis_mm=rain, formul_surumu=rm.FORMULA_VERSION,
            )
        )
    await repo.replace_change_events(garden_id, RADAR_SOURCE, rows)
    return len(rows)
