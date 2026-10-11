"""TEST ARACI (ürün kodu değil): uçtan uca testler için bir bahçeye belirli bildirim yayımlar.

Gerçek `NotificationService.publish` yolundan geçer (tercih + tekrar önleme). Yalnızca API_DEBUG=true.
Kullanım:  python -m tests.support.seed_notifications <bahce-id> <oncelik> <anahtar> [sekme]
"""

import asyncio
import sys
import uuid

from sqlalchemy import select

from bahcelab_backend.config import get_settings
from bahcelab_backend.database import async_session_factory, engine
from bahcelab_backend.domain.gardens.models import GardenModel
from bahcelab_backend.domain.notifications.repository import NotificationRepository
from bahcelab_backend.domain.notifications.service import NotificationService
from bahcelab_backend.domain.notifications.types import Candidate


async def main(garden_id: uuid.UUID, oncelik: str, key: str, sekme: str) -> None:
    if not get_settings().api_debug:
        raise SystemExit("Reddedildi: yalnızca API_DEBUG=true ortamında çalışır.")
    async with async_session_factory() as session:
        workspace_id = (
            await session.execute(select(GardenModel.workspace_id).where(GardenModel.id == garden_id))
        ).scalar_one_or_none()
        if workspace_id is None:
            raise SystemExit("Bahçe bulunamadı")
        service = NotificationService(NotificationRepository(session, workspace_id))
        created = await service.publish(
            [
                Candidate(
                    garden_id=garden_id,
                    tur="hava_don",
                    oncelik=oncelik,  # type: ignore[arg-type]
                    baslik=f"Test bildirimi {key}",
                    metin="Bu gece don riski var; hassas sürgünleri koruyun.",
                    sekme=sekme,
                    dedupe_key=f"test:{key}",
                )
            ]
        )
        await session.commit()
        print(f"{len(created)} bildirim yayımlandı")
    await engine.dispose()


if __name__ == "__main__":
    args = sys.argv[1:]
    asyncio.run(main(uuid.UUID(args[0]), args[1], args[2], args[3] if len(args) > 3 else "hava"))
