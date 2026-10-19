"""Olay motoru (ADR 0018): kaynak kayıtlarından sinyal çıkarır, `rules` ile birleştirir ve `events` / `event_sources` tablolarına yazar.

Olay kaynak kayıtlarını KOPYALAMAZ: radar adayı `change_events.id`, S2 düşüşü `acquisitions.id` (önceki ve son görüntü), hava sinyali `era5_daily` (hücre:tarih)
ile `event_sources` üzerinden referanslanır. Yeniden hesap İDEMPOTENTTİR: olay kimliği (`tur:başlangıç`) sabit kalır, bileşimi değişen olay güncellenir, kalmayan silinir.
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import cast

import numpy as np
from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.domain.acquisitions import masking
from bahcelab_backend.domain.acquisitions.models import ACQ_NET, AcquisitionModel, ChangeEventModel
from bahcelab_backend.domain.acquisitions.processor import SOURCE_ID as S2_SOURCE
from bahcelab_backend.domain.acquisitions.radar_processor import RADAR_SOURCE
from bahcelab_backend.domain.acquisitions.repository import AcquisitionRepository
from bahcelab_backend.domain.acquisitions.store import decode_grids
from bahcelab_backend.domain.agro import catalog as cat
from bahcelab_backend.domain.events import rules as er
from bahcelab_backend.domain.events.models import EventModel, EventSourceModel
from bahcelab_backend.domain.notifications.templates import EVENT_TITLES
from bahcelab_backend.domain.water.era5_sync import garden_cell
from bahcelab_backend.shared.storage import StorageBackend

logger = logging.getLogger(__name__)
FORECAST_DAYS = 7


async def weather_days(session: AsyncSession, cell: uuid.UUID, today: date) -> list[er.HourDay]:
    rows = (
        await session.execute(
            text(
                "SELECT tarih, saatlik->'t2m', saatlik->'yagis', saatlik->'hamle', hava_kaynak, toprak_kaynak FROM era5_daily "
                "WHERE cell_id = :c AND tarih <= :e AND saatlik IS NOT NULL ORDER BY tarih"
            ),
            {"c": cell, "e": today + timedelta(days=FORECAST_DAYS)},
        )
    ).all()
    pad: list[float | None] = [None] * 24
    return [er.HourDay(r[0], cast("list[float | None]", r[1] or pad), cast("list[float | None]", r[2] or pad), cast("list[float | None]", r[3] or pad), r[4] == "model" or r[5] == "model", f"{cell}:{r[0].isoformat()}") for r in rows]


async def s2_candidates(session: AsyncSession, storage: StorageBackend, garden_id: uuid.UUID, rule: cat.OlayKurali) -> list[tuple[er.Signal, bool | None, float]]:
    """Ardışık net S2 çiftleri (≤ `s2_azami_aralik_gun` arayla) için aday düşüşler: (sinyal, sonraki görüntüde sürdü mü [None: sonraki yok], düşen piksel payı).

    Mevsimden arındırma: piksel değeri, pikselin DİĞER yılların aynı ±`s2_pencere_gun` penceresindeki kendi p10'u ile kıyaslanır."""
    repo = AcquisitionRepository(session)
    geometry = await repo.geometry_geojson(garden_id)
    mask = masking.mask_for(geometry) if geometry else None
    scenes = (
        await session.execute(
            select(AcquisitionModel).where(AcquisitionModel.garden_id == garden_id, AcquisitionModel.source_id == S2_SOURCE, AcquisitionModel.durum == ACQ_NET, AcquisitionModel.izgara_yolu.is_not(None)).order_by(AcquisitionModel.tarih)
        )
    ).scalars().all()
    loaded: list[tuple[AcquisitionModel, np.ndarray]] = []
    for acq in scenes:
        if not acq.izgara_yolu or not storage.exists(acq.izgara_yolu):
            continue
        grid = decode_grids(storage.read(acq.izgara_yolu)).get("ndvi")
        if grid is None:
            continue
        loaded.append((acq, er.smooth_valid(masking.apply(grid, mask) if mask is not None else grid, rule.s2_yumusatma)))

    def floor_of(index: int) -> np.ndarray:
        day = loaded[index][0].tarih
        history = [g for a, g in loaded if a.tarih.year != day.year and er.circular_doy_gap(a.tarih, day) <= rule.s2_pencere_gun]
        return er.period_percentile(history, rule)

    out: list[tuple[er.Signal, bool | None, float]] = []
    for i in range(1, len(loaded)):
        (prev, prev_grid), (acq, grid) = loaded[i - 1], loaded[i]
        if (acq.tarih - prev.tarih).days > rule.s2_azami_aralik_gun:
            continue
        floor = floor_of(i)
        if floor.shape != grid.shape:
            continue
        patch = er.s2_patch(prev_grid, grid, floor, rule)
        if patch is None:
            continue
        area_da, delta, mask_patch, share = patch
        persists: bool | None = None
        if i + 1 < len(loaded) and (loaded[i + 1][0].tarih - acq.tarih).days <= rule.s2_azami_aralik_gun:
            nxt_floor = floor_of(i + 1)
            persists = er.s2_persists(loaded[i + 1][1], nxt_floor, mask_patch, rule) if nxt_floor.shape == grid.shape else None
        signal = er.Signal(
            "s2_dusus", prev.tarih + timedelta(days=1), acq.tarih, "orta", alan_da=round(area_da, 2),
            kaynaklar=(er.SourceRef("acquisitions", str(acq.id), "s2_dusus", acq.tarih), er.SourceRef("acquisitions", str(prev.id), "s2_dusus", prev.tarih)),
            ayrinti={"delta_ndvi": round(delta, 3)},
        )
        out.append((signal, persists, share))
    return out


async def radar_signals(session: AsyncSession, garden_id: uuid.UUID) -> list[er.Signal]:
    """Yalnız güven=yüksek (ıslaklık notu olmayan) radar adayları; düşük güvenliler olay olmaz."""
    rows = (await session.execute(select(ChangeEventModel).where(ChangeEventModel.garden_id == garden_id, ChangeEventModel.source_id == RADAR_SOURCE, ChangeEventModel.durum == "aday", ChangeEventModel.guven != "dusuk"))).scalars().all()
    return [er.Signal("radar_degisim", r.tarih, r.tarih, "orta", kaynaklar=(er.SourceRef("change_events", str(r.id), "radar_degisim", r.tarih),), ayrinti={"isaret": r.isaret}) for r in rows]


async def collect_signals(session: AsyncSession, storage: StorageBackend, garden_id: uuid.UUID, today: date) -> list[er.Signal]:
    rule = cat.load_catalog().olay
    cell, _, _ = await garden_cell(session, garden_id)
    days = await weather_days(session, cell, today)
    others = [*er.frost_signals(days, rule), *er.rain_signals(days, rule), *er.wind_signals(days, rule), *await radar_signals(session, garden_id)]
    s2 = [er.classify_s2(sig, persists, share, others, rule, today) for sig, persists, share in await s2_candidates(session, storage, garden_id, rule)]
    return [*others, *s2]


async def compute_events_for(session: AsyncSession, storage: StorageBackend, garden_id: uuid.UUID, today: date | None = None) -> dict[str, int]:
    """Bahçenin tüm olaylarını yeniden kurar (idempotent). Dönüş: olay sayısı, eklenen, güncellenen, silinen."""
    today = today or datetime.now(UTC).date()
    rule = cat.load_catalog().olay
    events = er.build_events(await collect_signals(session, storage, garden_id, today), rule)
    existing = {e.anahtar: e for e in (await session.execute(select(EventModel).where(EventModel.garden_id == garden_id))).scalars().all()}
    added = updated = 0
    for ev in events:
        row = existing.pop(ev.anahtar, None)
        values = {
            "tur": ev.tur, "turler": list(ev.turler), "baslangic": ev.baslangic, "bitis": ev.bitis, "alan_da": ev.alan_da, "guven": ev.guven, "siddet": ev.siddet,
            "katman": ev.katman, "durum": ev.durum, "tahmin": er.is_forecast(ev, today), "ayrinti": ev.ayrinti or None, "formul_surumu": er.FORMULA_VERSION,
        }
        if row is None:
            row = EventModel(garden_id=garden_id, anahtar=ev.anahtar, **values)
            session.add(row)
            await session.flush()
            added += 1
        else:
            for k, v in values.items():
                setattr(row, k, v)
            await session.execute(delete(EventSourceModel).where(EventSourceModel.event_id == row.id))
            updated += 1
        seen: set[tuple[str, str, str]] = set()
        for ref in ev.kaynaklar:
            key = (ref.tablo, ref.kimlik, ref.rol)
            if key in seen:
                continue
            seen.add(key)
            session.add(EventSourceModel(event_id=row.id, kaynak_tablosu=ref.tablo, kaynak_kimligi=ref.kimlik, rol=ref.rol, tarih=ref.tarih))
    for stale in existing.values():
        await session.delete(stale)
    await session.flush()
    return {"olay": len(events), "eklenen": added, "guncellenen": updated, "silinen": len(existing)}


@dataclass(frozen=True)
class EventView:
    id: uuid.UUID
    tur: str
    turler: list[str]
    baslangic: date
    bitis: date
    alan_da: float | None  # motorun ölçtüğü ya da radar kaynağından okunan en büyük alan
    guven: str
    siddet: str | None
    katman: str | None
    tahmin: bool
    kaynak_sayisi: int
    durum: str = "olay"
    neden: str | None = None
    ayrinti: dict[str, float | str | None] | None = None
    anahtar: str = ""


NAMES = {**{k: v.capitalize() for k, v in EVENT_TITLES.items()}, "s2_dusus": "Ani düşüş (optik)", "radar_degisim": "Radar değişimi", "s2_suphe": "Atmosfer şüphesi"}


def event_name(e: EventView) -> str:
    """Kullanıcıya gösterilen olay adı (birleşen don + optik iz tek iz olarak adlandırılır)."""
    name = "Don + optik hasar izi" if e.tur == "don" and "s2_dusus" in e.turler else NAMES.get(e.tur, e.tur)
    return name + (" (doğrulama bekliyor)" if e.durum == "bekliyor" else "")


async def list_events(session: AsyncSession, garden_id: uuid.UUID, *, since: date | None = None, until: date | None = None, suphe: bool = False) -> list[EventView]:
    """Olaylar (yeniden eskiye). Radar alanı `change_events`ten OKUNUR (kopyalanmaz)."""
    states = ("suphe",) if suphe else ("olay", "bekliyor")  # bekliyor: doğrulama bekleyen S2 düşüşü (olay listesinde, kendi rozetiyle)
    query = select(EventModel).where(EventModel.garden_id == garden_id, EventModel.durum.in_(states))
    if since is not None:
        query = query.where(EventModel.bitis >= since)
    if until is not None:
        query = query.where(EventModel.baslangic <= until)
    rows = (await session.execute(query.order_by(EventModel.baslangic.desc()))).scalars().all()
    ids = [r.id for r in rows]
    sources = (await session.execute(select(EventSourceModel).where(EventSourceModel.event_id.in_(ids)))).scalars().all() if ids else []
    radar_ids = [uuid.UUID(s.kaynak_kimligi) for s in sources if s.kaynak_tablosu == "change_events"]
    radar_area = {r.id: r.alan_m2 / er.DA_M2 for r in (await session.execute(select(ChangeEventModel).where(ChangeEventModel.id.in_(radar_ids)))).scalars().all()} if radar_ids else {}
    count: dict[uuid.UUID, int] = {}
    areas: dict[uuid.UUID, list[float]] = {}
    for s in sources:
        count[s.event_id] = count.get(s.event_id, 0) + 1
        if s.kaynak_tablosu == "change_events" and uuid.UUID(s.kaynak_kimligi) in radar_area:
            areas.setdefault(s.event_id, []).append(radar_area[uuid.UUID(s.kaynak_kimligi)])
    return [
        EventView(
            r.id, r.tur, list(r.turler), r.baslangic, r.bitis, max([a for a in [r.alan_da, *areas.get(r.id, [])] if a is not None], default=None), r.guven, r.siddet, r.katman, r.tahmin,
            count.get(r.id, 0), r.durum, str((r.ayrinti or {}).get("s2_dusus.neden")) if (r.ayrinti or {}).get("s2_dusus.neden") else None, r.ayrinti, r.anahtar,
        )
        for r in rows
    ]
