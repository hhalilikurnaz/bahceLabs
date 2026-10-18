"""Durum v2 girdilerini veritabanından toplar (ADR 0018): S2 geçmişi (aynı takvim ayı), kök bölgesi doluluğu (Su), olaylar, Landsat ısı bandı, risk/uyarı."""

from __future__ import annotations

import uuid
from datetime import date, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.domain.acquisitions.processor import SOURCE_ID
from bahcelab_backend.domain.acquisitions.repository import AcquisitionRepository
from bahcelab_backend.domain.agro import catalog as cat
from bahcelab_backend.domain.agro import status_v2 as sv
from bahcelab_backend.domain.agro.tiers import AktifRisk
from bahcelab_backend.domain.events import service as events
from bahcelab_backend.domain.water.schemas import SuYaniti
from bahcelab_backend.domain.water.service import WaterService


async def index_inputs(session: AsyncSession, garden_id: uuid.UUID) -> dict[str, sv.IndexInput | None]:
    """Her indeks için son net değer ve AYNI takvim ayındaki, FARKLI yıllardaki geçmiş sahne değerleri (bahçenin kendi dönem normu)."""
    rows = await AcquisitionRepository(session).net_with_stats(garden_id, SOURCE_ID)
    out: dict[str, sv.IndexInput | None] = {}
    for index in ("ndvi", "ndmi", "ndre"):
        series = [(a.tarih, st.medyan) for a, stats in rows for st in stats if st.indeks == index and st.medyan is not None]
        if not series:
            out[index] = None
            continue
        latest_day, latest_value = series[-1]
        history = [float(v) for d, v in series if d.month == latest_day.month and d.year != latest_day.year]
        out[index] = sv.IndexInput(float(latest_value), latest_day, history)
    return out


def heat_input(water: SuYaniti) -> sv.HeatInput | None:
    """Son Landsat geçişi (en az bir nokta varsa): aynı ay bandının üst sınırı hava farkı cinsinden verilir."""
    if not water.sicaklik.noktalar:
        return None
    p = water.sicaklik.noktalar[-1]
    band = (p.normal.p10_c, p.normal.alt_c, p.normal.ust_c, p.normal.p90_c) if p.normal else None
    return sv.HeatInput(p.tarih, p.fark_c, p.normal.ust_c if p.normal else None, p.karisik_piksel, band)


async def collect(
    session: AsyncSession, workspace_id: uuid.UUID, garden_id: uuid.UUID, today: date, risks: list[AktifRisk], red_alert: bool
) -> tuple[sv.StatusInputs, SuYaniti]:
    water = await WaterService(session, workspace_id).su(garden_id, today)
    idx = await index_inputs(session, garden_id)
    recent = await events.list_events(session, garden_id, since=today - timedelta(days=cat.load_catalog().durum_v2.ani_pencere_gun), until=today)
    changes = [sv.ChangeSignal("s2", e.bitis) for e in recent if "s2_dusus" in e.turler and not e.tahmin] + [sv.ChangeSignal("radar", e.bitis) for e in recent if "radar_degisim" in e.turler and not e.tahmin]
    inputs = sv.StatusInputs(
        today, idx["ndvi"], idx["ndmi"], idx["ndre"], water.profil.kok_bolgesi_doluluk, water.profil.bugun_tarihi, changes, heat_input(water), risks, red_alert,
        doluluk_bant=tuple(water.profil.kok_bolgesi_bant) if water.profil.kok_bolgesi_bant and len(water.profil.kok_bolgesi_bant) == 4 else None,  # type: ignore[arg-type]
    )
    return inputs, water
