"""Bağımsız dış kanıt servisi: istasyon gözlemini eşitler (iş) ve olaylar için ön-yargı üretir (okuma). Ön-yargı türetilmiştir; çiftçinin doğrulamasının yerine geçmez, saklanmaz."""

from __future__ import annotations

import json
import logging
import uuid
from dataclasses import dataclass, field
from datetime import date

from shapely.geometry import shape
from sqlalchemy import delete, select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from bahcelab_backend.domain.agro import catalog as cat
from bahcelab_backend.domain.evidence import rules
from bahcelab_backend.domain.evidence.catalog_file import load_public_records
from bahcelab_backend.domain.evidence.models import StationDailyModel, StationModel
from bahcelab_backend.domain.evidence.providers import (
    StationProvider,
    get_station_provider,
    haversine_km,
)
from bahcelab_backend.domain.evidence.types import OnYargi, PublicRecord, Station, StationDay
from bahcelab_backend.domain.gardens.models import GardenModel
from bahcelab_backend.shared.clock import today_istanbul

logger = logging.getLogger(__name__)
HISTORY_START = date(2015, 1, 1)


async def sync_stations(factory: async_sessionmaker[AsyncSession], provider: StationProvider | None = None, today: date | None = None) -> dict[str, int]:
    """Bahçelere en yakın istasyonların GERÇEK gözlem günlerini yazar (idempotent: upsert). Model/dolgu satırları yazılmaz. Sağlayıcı hatası bir istasyonu atlar, diğerlerini durdurmaz."""
    rule = cat.load_catalog().dis_kanit
    provider = provider or get_station_provider()
    today = today or today_istanbul()
    async with factory() as session:
        centers = [shape(json.loads(raw)).centroid for raw in (await session.execute(text("SELECT ST_AsGeoJSON(geom) FROM gardens"))).scalars().all()]
    stations: dict[str, Station] = {}
    for c in centers:
        try:
            for st in await provider.nearest(float(c.y), float(c.x), max_km=rule.istasyon_azami_km, limit=rule.istasyon_sayisi):
                stations.setdefault(st.id, st)
        except Exception:  # noqa: BLE001
            logger.exception("İstasyon listesi alınamadı")
    written = failed = 0
    for st in stations.values():
        try:
            days = [d for d in await provider.daily(st, HISTORY_START, today) if d.kaynak == "gozlem" and (d.tmin is not None or d.prcp is not None)]
            first, last = (min(d.tarih for d in days), max(d.tarih for d in days)) if days else (None, None)  # gözlem aralığı GERÇEK gözlem günlerinden türetilir (envanter eskiyebilir)
            async with factory() as session:
                stmt = insert(StationModel).values(id=st.id, saglayici=provider.name, ad=st.ad, lat=st.lat, lng=st.lng, yukseklik=st.yukseklik, gozlem_baslangic=first, gozlem_bitis=last)
                await session.execute(stmt.on_conflict_do_update(index_elements=["id"], set_={k: getattr(stmt.excluded, k) for k in ("ad", "lat", "lng", "yukseklik", "gozlem_baslangic", "gozlem_bitis")}))
                if days:  # kaynak değer kaynağını düzeltmiş/eskimiş olabilir: bu istasyonun artık gözlem olmayan günleri (ör. eski toplu dosyadan gelen model satırı) silinir
                    await session.execute(delete(StationDailyModel).where(StationDailyModel.istasyon_id == st.id, StationDailyModel.tarih.notin_([d.tarih for d in days])))
                for i in range(0, len(days), 1000):
                    chunk = [{"istasyon_id": d.istasyon_id, "tarih": d.tarih, "tmin": d.tmin, "prcp": d.prcp} for d in days[i : i + 1000]]
                    ins = insert(StationDailyModel).values(chunk)
                    await session.execute(ins.on_conflict_do_update(index_elements=["istasyon_id", "tarih"], set_={"tmin": ins.excluded.tmin, "prcp": ins.excluded.prcp}))
                await session.commit()
            written += len(days)
        except Exception:  # noqa: BLE001
            logger.exception("İstasyon gözlemi alınamadı: %s", st.id)
            failed += 1
    return {"istasyon": len(stations), "gun": written, "hata": failed}


@dataclass
class Context:
    stations: dict[str, Station] = field(default_factory=dict)
    days: list[StationDay] = field(default_factory=list)
    il: str | None = None
    ilce: str | None = None
    records: tuple[PublicRecord, ...] = ()


async def load_context(session: AsyncSession, garden_id: uuid.UUID, records: tuple[PublicRecord, ...] | None = None) -> Context:
    rule = cat.load_catalog().dis_kanit
    raw = (await session.execute(text("SELECT ST_AsGeoJSON(geom) FROM gardens WHERE id = :g"), {"g": garden_id})).scalar_one_or_none()
    garden = (await session.execute(select(GardenModel.il, GardenModel.ilce).where(GardenModel.id == garden_id))).first()
    ctx = Context(il=garden[0] if garden else None, ilce=garden[1] if garden else None, records=load_public_records() if records is None else records)
    if raw is None:
        return ctx
    c = shape(json.loads(raw)).centroid
    near: list[Station] = []
    for s in (await session.execute(select(StationModel))).scalars().all():
        km = haversine_km(float(c.y), float(c.x), s.lat, s.lng)
        if km <= rule.istasyon_azami_km:
            near.append(Station(s.id, s.ad, s.lat, s.lng, s.yukseklik, s.gozlem_baslangic, s.gozlem_bitis, round(km, 1), s.saglayici))
    near = sorted(near, key=lambda x: x.mesafe_km)[: rule.istasyon_sayisi]
    ctx.stations = {s.id: s for s in near}
    if ctx.stations:
        for d in (await session.execute(select(StationDailyModel).where(StationDailyModel.istasyon_id.in_(list(ctx.stations))))).scalars().all():
            st = ctx.stations[d.istasyon_id]
            inside = st.gozlem_baslangic is not None and st.gozlem_bitis is not None and st.gozlem_baslangic <= d.tarih <= st.gozlem_bitis  # çifte güvence: envanter dışı satır model sayılır
            ctx.days.append(StationDay(d.istasyon_id, d.tarih, d.tmin, d.prcp, "gozlem" if inside else "model"))
    return ctx


def prior_of(ctx: Context, grup: str, start: date, end: date) -> OnYargi:
    return rules.prejudge(grup, start, end, ctx.days, ctx.stations, ctx.records, ctx.il, ctx.ilce, cat.load_catalog().dis_kanit)
