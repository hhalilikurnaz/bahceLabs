"""Kesintisiz canlılık eğrisi servisi (ADR 0018): gözlemleri toplar (S2 + HLS), eğriyi kurar, radar boşluk işaretlerini ekler. HLS gözlemlerini çeker (idempotent)."""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.domain.acquisitions.models import (
    ACQ_NET,
    AcquisitionModel,
    AcquisitionStatModel,
    ChangeEventModel,
)
from bahcelab_backend.domain.acquisitions.processor import SOURCE_ID as S2_SOURCE
from bahcelab_backend.domain.acquisitions.radar_processor import RADAR_SOURCE
from bahcelab_backend.domain.agro import catalog as cat
from bahcelab_backend.domain.imagery.hls import PlanetaryHlsProvider, summarize
from bahcelab_backend.domain.series import curve as cv
from bahcelab_backend.domain.series.models import HlsObservationModel

logger = logging.getLogger(__name__)
CHUNK_DAYS = 31
PARALLEL = 4


async def garden_geometry(session: AsyncSession, garden_id: uuid.UUID) -> dict[str, Any] | None:
    import json

    raw = (await session.execute(text("SELECT ST_AsGeoJSON(geom) FROM gardens WHERE id = :g"), {"g": garden_id})).scalar_one_or_none()
    return json.loads(raw) if raw else None


async def sync_hls(session: AsyncSession, garden_id: uuid.UUID, start: date, end: date, provider: Any | None = None) -> dict[str, int]:
    """[start, end] HLS sahnelerini okur ve bahçe NDVI ortancasını yazar. Var olan sahne atlanır (idempotent); en yeni parça önce."""
    provider = provider or PlanetaryHlsProvider()
    geometry = await garden_geometry(session, garden_id)
    if geometry is None:
        return {"aranan": 0, "yazilan": 0}
    have = {r[0] for r in (await session.execute(select(HlsObservationModel.scene_id).where(HlsObservationModel.garden_id == garden_id))).all()}
    await session.commit()  # okuma işlemi açık kalmasın: uzun süren sahne okumaları sırasında kilit tutulmaz
    searched = written = 0
    chunks: list[tuple[date, date]] = []
    cursor = start
    while cursor <= end:
        chunks.append((cursor, min(end, cursor + timedelta(days=CHUNK_DAYS - 1))))
        cursor += timedelta(days=CHUNK_DAYS)
    for a, b in reversed(chunks):
        refs = [r for r in await asyncio.to_thread(provider.search, geometry, a, b) if r.scene_id not in have]
        searched += len(refs)
        sem = asyncio.Semaphore(PARALLEL)

        async def one(ref: Any) -> dict[str, Any] | None:
            async with sem:
                try:
                    piece = await asyncio.to_thread(provider.read, ref, geometry)
                except Exception as exc:  # noqa: BLE001 - tek sahne hatası diğerlerini durdurmaz; satır yazılmaz, sonraki çalışmada yeniden denenir
                    logger.warning("HLS sahnesi okunamadı %s: %s", ref.scene_id, type(exc).__name__)
                    return None
            value = summarize(piece, geometry)
            return {
                "garden_id": garden_id, "scene_id": ref.scene_id, "source_id": ref.kaynak, "tarih": ref.tarih, "ndvi": value.ndvi, "gecerli_oran": value.gecerli_oran,
                "gecerli_piksel": value.gecerli_piksel, "toplam_piksel": value.toplam_piksel, "bulut_orani": ref.bulut_orani,
            }

        rows = [r for r in await asyncio.gather(*(one(r) for r in refs)) if r is not None]
        if rows:
            stmt = insert(HlsObservationModel).values(rows)
            await session.execute(stmt.on_conflict_do_nothing(index_elements=["garden_id", "scene_id"]))
            written += len(rows)
        await session.commit()
        have |= {r["scene_id"] for r in rows}
    return {"aranan": searched, "yazilan": written}


async def observations_for(session: AsyncSession, garden_id: uuid.UUID, rule: cat.EgriKurali) -> tuple[list[cv.Obs], list[date]]:
    """Gözlemler: S2 (bahçe NDVI ortancası × geçerli oran) + HLS (eşik üstü geçerli oranlı). İkinci dönüş: radar geçiş günleri (birincil yörünge, net)."""
    out: list[cv.Obs] = []
    s2 = (
        await session.execute(
            select(AcquisitionModel.tarih, AcquisitionStatModel.medyan, AcquisitionModel.gecerli_oran)
            .join(AcquisitionStatModel, (AcquisitionStatModel.acquisition_id == AcquisitionModel.id) & (AcquisitionStatModel.indeks == "ndvi"))
            .where(AcquisitionModel.garden_id == garden_id, AcquisitionModel.source_id == S2_SOURCE, AcquisitionModel.durum == ACQ_NET)
        )
    ).all()
    out += [cv.Obs(d, float(v), rule.w_s2 * float(q if q is not None else 1.0), "s2") for d, v, q in s2 if v is not None]
    hls = (await session.execute(select(HlsObservationModel).where(HlsObservationModel.garden_id == garden_id, HlsObservationModel.ndvi.is_not(None), HlsObservationModel.gecerli_oran >= rule.hls_min_gecerli_oran))).scalars().all()
    out += [cv.Obs(h.tarih, float(h.ndvi), rule.w_hls * h.gecerli_oran, "hls") for h in hls if h.ndvi is not None]
    radar_days = [r[0] for r in (await session.execute(select(AcquisitionModel.tarih).where(AcquisitionModel.garden_id == garden_id, AcquisitionModel.source_id == RADAR_SOURCE, AcquisitionModel.durum == ACQ_NET))).all()]
    return out, radar_days


async def curve_for(session: AsyncSession, garden_id: uuid.UUID, start: date, end: date | None = None) -> dict[str, Any]:
    rule = cat.load_catalog().egri
    end = end or datetime.now(UTC).date()
    observations, radar_days = await observations_for(session, garden_id, rule)
    points, sigma = await asyncio.to_thread(cv.build_curve, observations, start, end, rule)  # Whittaker çözümü CPU işidir: olay döngüsünü (ve açık oturumları) bloke etmesin
    change_days = {r[0] for r in (await session.execute(select(ChangeEventModel.tarih).where(ChangeEventModel.garden_id == garden_id, ChangeEventModel.source_id == RADAR_SOURCE, ChangeEventModel.durum == "aday", ChangeEventModel.guven != "dusuk"))).all()}
    optical_days = [o.tarih for o in observations]
    marks = cv.radar_marks([d for d in radar_days if start <= d <= end], change_days, optical_days, end, rule)
    shown = [o for o in observations if start <= o.tarih <= end]
    return {"noktalar": points, "gozlemler": shown, "radar_isaretleri": marks, "sigma": sigma, "kural": rule}
