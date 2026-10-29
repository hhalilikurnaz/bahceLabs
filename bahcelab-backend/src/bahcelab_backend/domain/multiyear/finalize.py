"""Geçmiş doldurmanın her ay görevinden sonra çağrılan çok yıllık eşitleme: yıl kompozitlerini kurar; tüm yıllar sonuçlanınca bölgeleri
hesaplar ve (bahçe + yıl aralığı başına bir kez) bildirir (ADR 0015)."""

from __future__ import annotations

import logging
import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from bahcelab_backend.config import Settings, get_settings
from bahcelab_backend.domain.agro import catalog as cat
from bahcelab_backend.domain.gardens.models import GardenModel
from bahcelab_backend.domain.multiyear.repository import MultiyearRepository
from bahcelab_backend.domain.multiyear.sync import sync_year
from bahcelab_backend.domain.notifications.repository import NotificationRepository
from bahcelab_backend.domain.notifications.service import NotificationService
from bahcelab_backend.domain.notifications.types import Candidate
from bahcelab_backend.shared.storage import StorageBackend

logger = logging.getLogger(__name__)
SessionFactory = async_sessionmaker[AsyncSession]


async def after_month(factory: SessionFactory, storage: StorageBackend, garden_id: uuid.UUID, month: date, settings: Settings | None = None) -> None:
    """Çok yıllık analiz başlatılmışsa: ayın yılını eşitler; tüm yıllar sonuçlandıysa bölgeleri hesaplar ve bildirir."""
    cfg = settings or get_settings()
    try:
        async with factory() as session:
            repo = MultiyearRepository(session)
            run = await repo.get_run(garden_id)
            if run is None:
                return  # çok yıllık analiz bu bahçe için hiç başlatılmadı
            row = (await session.execute(select(GardenModel.workspace_id, GardenModel.ad, GardenModel.urun).where(GardenModel.id == garden_id))).first()
            if row is None:
                return
            workspace_id, name, product = row
            catalog = cat.load_catalog().urun(product)
            rule = catalog.analiz_penceresi if catalog else None
            if rule is None:
                return
            years = await repo.list_years(garden_id)
            changed = False
            for y in years:
                if y.yil == month.year or y.durum != "tamam":
                    changed = (await sync_year(session, storage, garden_id, y, rule))[1] or changed
            await session.commit()
            years = await repo.list_years(garden_id)
            if not years or any(y.durum == "bekliyor" for y in years) or not any(y.durum == "tamam" for y in years):
                return
            from bahcelab_backend.domain.multiyear.service import MultiyearService

            service = MultiyearService(session, workspace_id, None, storage, None, cfg)
            if changed or await repo.active_result(garden_id, 3) is None:  # artımlı çekimde kompozit değişmediyse bölgeler yeniden hesaplanmaz
                for k in cfg.multiyear_zone_counts:
                    await service.compute(garden_id, k)
            scope = f"{run.baslangic_yili}-{run.bitis_yili}"  # olay = «bu bahçenin bu yıl aralığı için analizi hazır»; yeniden işleme çoğaltmaz
            used = sum(1 for y in years if y.durum == "tamam")
            await NotificationService(NotificationRepository(session, workspace_id)).publish(
                [Candidate(garden_id, "cok_yillik", "bilgi", f"{name}: çok yıllık analiz hazır", f"{used} yılın uydu görüntüsüyle ağaç gücü bölgeleri çıkarıldı. Analiz sekmesinden bakın.", "analiz", f"cok-yillik:{garden_id}:{scope}", harita="katman=bolgeler")]
            )
            await session.commit()
    except Exception:  # noqa: BLE001
        logger.exception("Çok yıllık eşitleme başarısız: %s %s", garden_id, month)
