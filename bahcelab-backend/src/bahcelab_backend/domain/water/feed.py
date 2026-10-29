"""ERA5 besleme (ADR 0017/0018): bahçe eklenince geçmiş doldurma (2015→), her gün artımlı çekim; SMAP/IMERG doğrulama doldurması.

Hepsi İDEMPOTENT'tir (upsert / eksik gün): iki kez çalışmak aynı sonucu verir, yarıda kalan iş kaldığı yerden sürer. Hücre başına çalışır:
aynı hava hücresindeki bahçeler tek çekimi paylaşır. Gizli anahtar (EARTHDATA_TOKEN) yalnız ortamdan okunur.
"""

from __future__ import annotations

import importlib
import logging
import uuid
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from bahcelab_backend.config import get_settings
from bahcelab_backend.domain.water.era5 import Era5Client, Era5Source
from bahcelab_backend.domain.water.era5_sync import ERA5_START, garden_cell, sync_cell
from bahcelab_backend.domain.water.validation_sync import IMERG, SMAP, sync_validation

logger = logging.getLogger(__name__)
SessionFactory = async_sessionmaker[AsyncSession]
REFRESH_OVERLAP_DAYS = 10  # artımlı çekim son ERA5-Land gününden bu kadar geriye bakar (gecikmeli düzeltmeler ve model → ERA5 geçişi)
SMAP_STEP = 3  # SMAP 3 günde bir (ADR 0017)
SESSIZ_BOS_ESIK = 7  # bu kadar günden FAZLA eksik arandı ve hiçbiri yazılamadıysa iş başarısız sayılır (kaynak gecikmesi ≤ bir hafta kabul)


def get_era5_client() -> Era5Source:
    """Gerçek istemci Open-Meteo'dur. `ERA5_CLIENT=modül:ad` yalnız API_DEBUG=true iken kabul edilir (ağsız e2e/test)."""
    settings = get_settings()
    if settings.era5_client:
        if not settings.api_debug:
            raise RuntimeError("ERA5_CLIENT yalnızca API_DEBUG=true ortamında kullanılabilir.")
        module, _, name = settings.era5_client.partition(":")
        return getattr(importlib.import_module(module), name)()
    return Era5Client()


async def last_era5_day(session: AsyncSession, cell_id: uuid.UUID) -> date | None:
    return (await session.execute(text("SELECT max(tarih) FROM era5_daily WHERE cell_id = :c AND toprak_kaynak = 'era5_land'"), {"c": cell_id})).scalar_one()


async def feed_cell(factory: SessionFactory, cell_id: uuid.UUID, lat: float, lng: float, client: Era5Source, today: date | None = None) -> dict[str, int | str]:
    """Hücre için ERA5 satırlarını tamamlar: veri yoksa 2015'ten, varsa son ERA5-Land gününden 10 gün geriden."""
    today = today or datetime.now(UTC).date()
    async with factory() as session:
        last = await last_era5_day(session, cell_id)
        start = ERA5_START if last is None else max(ERA5_START, last - timedelta(days=REFRESH_OVERLAP_DAYS))
        result = await sync_cell(session, client, cell_id, lat, lng, start, today)
        await session.commit()
    return {**result, "kip": "ilk" if last is None else "artimli"}


async def feed_garden(factory: SessionFactory, garden_id: uuid.UUID, client: Era5Source | None = None) -> dict[str, int | str]:
    """Bahçenin hücresini besler ve toprak profilini hazırlar (SoilGrids kapalıysa atlanır)."""
    from bahcelab_backend.domain.water.service import WaterService

    client = client or get_era5_client()
    async with factory() as session:
        cell, lat, lng = await garden_cell(session, garden_id)
        centroid = (await session.execute(text("SELECT ST_Y(ST_Centroid(geom)), ST_X(ST_Centroid(geom)), workspace_id FROM gardens WHERE id = :g"), {"g": garden_id})).one()
        await session.commit()
    result = await feed_cell(factory, cell, lat, lng, client)
    async with factory() as session:
        await WaterService(session, centroid[2]).ensure_soil(garden_id, float(centroid[0]), float(centroid[1]))
        await session.commit()
    return result


async def feed_all(factory: SessionFactory, client: Era5Source | None = None) -> dict[str, int]:
    """Günlük iş: bütün bahçelerin hücreleri (her hücre bir kez). Bir hücrenin hatası diğerlerini durdurmaz."""
    client = client or get_era5_client()
    async with factory() as session:
        ids = [r[0] for r in (await session.execute(text("SELECT id FROM gardens ORDER BY created_at"))).all()]
    done: set[uuid.UUID] = set()
    out = {"hucre": 0, "hata": 0}
    for garden_id in ids:
        try:
            async with factory() as session:
                cell, lat, lng = await garden_cell(session, garden_id)
                await session.commit()
            if cell in done:
                continue
            done.add(cell)
            await feed_cell(factory, cell, lat, lng, client)
            out["hucre"] += 1
        except Exception:  # noqa: BLE001
            logger.exception("ERA5 besleme başarısız (bahçe %s)", garden_id)
            out["hata"] += 1
    return out


async def feed_validation(factory: SessionFactory, garden_id: uuid.UUID, today: date | None = None) -> dict[str, dict[str, int] | str]:
    """SMAP (3 günde bir) ve IMERG (günlük) doğrulama gözlemlerini `validation_start`'tan dünden itibaren tamamlar (idempotent: var olan günler atlanır, parça parça kaydedilir).
    Her kaynak AYRI izlenir (`feed_runs`): belirteç yoksa «atlandi» (açıkça), hata/kesinti log + bildirimle görünür, işçi düşerse kaldığı yerden devam eder."""
    from bahcelab_backend.domain.feedruns.service import mark_skipped, tracked

    settings = get_settings()
    if not settings.earthdata_token:
        for kaynak in ("imerg", "smap"):
            await mark_skipped(factory, garden_id, kaynak, "EARTHDATA_TOKEN tanımlı değil (bahcelab-backend/.env.local)")
        return {"durum": "atlandi: EARTHDATA_TOKEN tanımlı değil"}
    end = (today or datetime.now(UTC).date()) - timedelta(days=1)
    start = date.fromisoformat(settings.validation_start)
    out: dict[str, dict[str, int] | str] = {}
    for source, kaynak, step in ((IMERG, "imerg", 1), (SMAP, "smap", SMAP_STEP)):
        try:
            async with tracked(factory, garden_id, kaynak) as run:
                async with factory() as session:
                    result = await sync_validation(session, garden_id, source, start, end, step=step, on_progress=run.ilerle)
                await run.ilerle(**result)
                if result["aranan_gun"] > SESSIZ_BOS_ESIK and result["yazilan"] == 0:  # ağ/erişim sessizce boş döndüyse «tamam» denmez (son günler kaynakta gecikmeli olabilir: küçük eksik hata değil)
                    raise RuntimeError(f"{result['aranan_gun']} gün arandı, hiç gözlem yazılamadı (erişim/ağ ya da kaynak boş)")
                out[source] = result
        except Exception as exc:  # noqa: BLE001 - biri düşse diğeri sürer (ör. EULA/ağ); hata `tracked` içinde loglandı ve bildirildi
            out[source] = f"hata: {type(exc).__name__}"
    return out


async def validation_all(factory: SessionFactory) -> dict[str, int]:
    async with factory() as session:
        ids = [r[0] for r in (await session.execute(text("SELECT id FROM gardens ORDER BY created_at"))).all()]
    out = {"bahce": 0, "atlanan": 0}
    for garden_id in ids:
        result = await feed_validation(factory, garden_id)
        out["atlanan" if "durum" in result else "bahce"] += 1
    return out
