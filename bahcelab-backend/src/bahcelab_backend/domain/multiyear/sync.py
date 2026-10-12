"""Çok yıllık yıl kompozitleri — TEK VERİ HATTI (ADR 0015): yıllık kompozit artık sahneden değil, geçmiş doldurmanın sakladığı net
edinimlerden (gösterge ızgaraları) kurulur. Analiz penceresindeki (ör. Haz–Eyl) net edinimlerin NDVI ızgaralarının piksel medyanıdır.

İDEMPOTENT: pencerenin ayları tamamlanmadan yıl kurulmaz; aynı edinim kümesiyle tekrar çağrı yeniden hesaplamaz.
"""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, date, datetime
from typing import Any

import numpy as np
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.domain.acquisitions.models import (
    ACQ_CLOUDY,
    ACQ_NET,
    MONTH_DONE,
    MONTH_ERROR,
    AcquisitionModel,
    BackfillMonthModel,
)
from bahcelab_backend.domain.acquisitions.processor import SOURCE_ID
from bahcelab_backend.domain.acquisitions.store import decode_grids
from bahcelab_backend.domain.multiyear.composite import median_composite, window_dates
from bahcelab_backend.domain.multiyear.models import MultiyearYearModel
from bahcelab_backend.domain.multiyear.processor_io import composite_key, encode_array
from bahcelab_backend.domain.multiyear.sufficiency import window_months
from bahcelab_backend.shared.storage import StorageBackend

logger = logging.getLogger(__name__)


async def window_state(session: AsyncSession, garden_id: uuid.UUID, year: int, month_start: int, month_end: int) -> str:
    """Pencere ayları: 'tamam' (hepsi bitti) | 'hata' (bitenlerden sonra hatalı ay var) | 'bekliyor' (hâlâ bekleyen/işleyen ay)."""
    first, last = window_dates(year, month_start, month_end)
    months = [date(y, m, 1) for y, m in window_months(first, last)]
    rows = (
        await session.execute(select(BackfillMonthModel.ay, BackfillMonthModel.durum).where(BackfillMonthModel.garden_id == garden_id, BackfillMonthModel.source_id == SOURCE_ID, BackfillMonthModel.ay.in_(months)))
    ).all()
    states = {r[0]: r[1] for r in rows}
    if any(m not in states or states[m] not in (MONTH_DONE, MONTH_ERROR) for m in months):
        return "bekliyor"
    return "hata" if any(states[m] == MONTH_ERROR for m in months) else "tamam"


async def sync_year(session: AsyncSession, storage: StorageBackend, garden_id: uuid.UUID, row: MultiyearYearModel, rule: Any) -> tuple[str, bool]:
    """Bir yılın kompozitini edinimlerden kurar ve yıl satırını günceller. Dönüş: (yıl durumu, kompozit değişti mi)."""
    state = await window_state(session, garden_id, row.yil, rule.ay_baslangic, rule.ay_bitis)
    if state != "tamam":
        row.durum = "hata" if state == "hata" else "bekliyor"
        row.hata_mesaji = "Bu yılın bazı ayları çekilemedi; «Yeniden dene» ile devam edebilirsiniz." if state == "hata" else None
        await session.flush()
        return row.durum, False
    first, last = window_dates(row.yil, rule.ay_baslangic, rule.ay_bitis)
    acquisitions = (
        await session.execute(
            select(AcquisitionModel).where(AcquisitionModel.garden_id == garden_id, AcquisitionModel.source_id == SOURCE_ID, AcquisitionModel.tarih >= first, AcquisitionModel.tarih <= last, AcquisitionModel.durum.in_((ACQ_NET, ACQ_CLOUDY))).order_by(AcquisitionModel.tarih)
        )
    ).scalars().all()
    net = [a for a in acquisitions if a.durum == ACQ_NET and a.izgara_yolu]
    dates = [a.tarih.isoformat() for a in net]
    if row.durum == "tamam" and row.sahne_tarihleri == dates and (row.kompozit_yolu is None or storage.exists(row.kompozit_yolu)):
        return "tamam", False  # aynı edinim kümesi: yeniden hesaplanmaz (idempotent)
    maps: list[np.ndarray] = []
    for a in net:
        grids = decode_grids(storage.read(a.izgara_yolu or ""))
        if rule.indeks in grids:
            maps.append(grids[rule.indeks])
    composite = median_composite(maps)
    key = composite_key(garden_id, row.yil) if composite is not None else None
    if composite is not None and key is not None:
        storage.save(key, encode_array(composite.values))
    elif row.kompozit_yolu:
        storage.delete(row.kompozit_yolu)
    row.durum, row.hata_mesaji = "tamam", None
    row.sahne_sayisi, row.aday_sayisi, row.sahne_tarihleri, row.kompozit_yolu = len(net), len(acquisitions), dates, key
    row.bitis = datetime.now(UTC)
    await session.flush()
    return "tamam", True


async def year_counts(session: AsyncSession, garden_id: uuid.UUID) -> dict[int, tuple[int, int]]:
    """{yıl: (net sahne, bulutlu sahne)} — TÜM aylar (yılda ~22 net sahne); Analiz'deki yıl tablosu bunu gösterir."""
    rows = (
        await session.execute(
            select(func.extract("year", AcquisitionModel.tarih).label("y"), AcquisitionModel.durum, func.count()).where(AcquisitionModel.garden_id == garden_id, AcquisitionModel.source_id == SOURCE_ID).group_by(text("y"), AcquisitionModel.durum)
        )
    ).all()
    out: dict[int, tuple[int, int]] = {}
    for year, state, count in rows:
        net, cloudy = out.get(int(year), (0, 0))
        out[int(year)] = (net + int(count), cloudy) if state == ACQ_NET else (net, cloudy + int(count)) if state == ACQ_CLOUDY else (net, cloudy)
    return out
