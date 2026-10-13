"""TEST ARACI (ürün kodu değil): bir bahçeye taze olaylar yazar, olay bildirimlerini karar katmanından geçirir ve günlük özeti üretir.

· `events`: taze «aşırı yağış» (önemli → özette) ve «don» (kritik → anında) olayı.
· Bildirimler gerçek `NotificationService.publish` + `build_digest` yolundan geçer (07:00 sonrası yerel saatle); yalnızca API_DEBUG=true.
Kullanım:  python -m tests.support.seed_olay_ozet <bahce-id>
"""

import asyncio
import sys
import uuid
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select

from bahcelab_backend.config import get_settings
from bahcelab_backend.database import async_session_factory, engine
from bahcelab_backend.domain.agro.catalog import load_catalog
from bahcelab_backend.domain.auth import models as _auth_models  # noqa: F401
from bahcelab_backend.domain.events.models import EventModel
from bahcelab_backend.domain.events.service import list_events
from bahcelab_backend.domain.gardens.models import GardenModel
from bahcelab_backend.domain.notifications.event_candidates import event_candidate
from bahcelab_backend.domain.notifications.repository import NotificationRepository
from bahcelab_backend.domain.notifications.service import NotificationService


async def main(garden_id: uuid.UUID) -> None:
    if not get_settings().api_debug:
        raise SystemExit("Reddedildi: yalnızca API_DEBUG=true ortamında çalışır.")
    now = datetime.now(ZoneInfo("Europe/Istanbul"))
    today = now.date()
    async with async_session_factory() as session:
        garden = (await session.execute(select(GardenModel).where(GardenModel.id == garden_id))).scalar_one_or_none()
        if garden is None:
            raise SystemExit("Bahçe bulunamadı")
        for tur, key, mm, extra in (("asiri_yagis", f"asiri_yagis:{today}", {"asiri_yagis.en_yuksek_24s_mm": 72.0}, None), ("don", f"don:{today}", {"don.en_dusuk_c": -3.2}, "siddetli")):
            exists = (await session.execute(select(EventModel).where(EventModel.garden_id == garden_id, EventModel.anahtar == key))).scalar_one_or_none()
            if exists is None:
                session.add(EventModel(garden_id=garden_id, anahtar=key, tur=tur, turler=[tur], baslangic=today - timedelta(days=1), bitis=today - timedelta(days=1), guven="orta", siddet=extra, durum="olay", tahmin=False, ayrinti=mm, formul_surumu="test"))
        await session.flush()
        rule = load_catalog().bildirim
        candidates = [c for e in await list_events(session, garden_id, since=today - timedelta(days=3)) if (c := event_candidate(garden_id, garden.ad, e, today, rule, e.anahtar)) is not None]
        service = NotificationService(NotificationRepository(session, garden.workspace_id))
        await service.publish(candidates)
        digest = await service.build_digest(now.replace(hour=rule.ozet_saat + 1, minute=0))  # sabah özeti (sessiz saat dışı), testin yapıldığı saatten bağımsız
        await session.commit()
        print(f"{len(candidates)} aday yayımlandı; özet: {'üretildi' if digest else 'yok'}")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main(uuid.UUID(sys.argv[1])))
