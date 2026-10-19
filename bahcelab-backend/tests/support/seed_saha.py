"""TEST ARACI (ürün kodu değil): saha turu için bir bahçeye iki «doğrulama bekliyor» olayı yazar (yama merkezleriyle). Yalnızca API_DEBUG=true.
Kullanım:  python -m tests.support.seed_saha <bahce-id>
"""

import asyncio
import sys
import uuid
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import func, select

from bahcelab_backend.config import get_settings
from bahcelab_backend.database import async_session_factory, engine
from bahcelab_backend.domain.auth import models as _auth_models  # noqa: F401
from bahcelab_backend.domain.events.models import EventModel
from bahcelab_backend.domain.gardens.models import GardenModel


async def main(garden_id: uuid.UUID) -> None:
    if not get_settings().api_debug:
        raise SystemExit("Reddedildi: yalnızca API_DEBUG=true ortamında çalışır.")
    today = datetime.now(ZoneInfo("Europe/Istanbul")).date()
    async with async_session_factory() as session:
        centre = (await session.execute(select(func.ST_X(func.ST_Centroid(GardenModel.geom)), func.ST_Y(func.ST_Centroid(GardenModel.geom))).where(GardenModel.id == garden_id))).one_or_none()
        if centre is None:
            raise SystemExit("Bahçe bulunamadı")
        lng, lat = float(centre[0]), float(centre[1])
        for key, dx, dy in ((f"s2_dusus:a{today}", 0.0008, 0.0002), (f"s2_dusus:b{today}", -0.0006, 0.0003)):
            exists = (await session.execute(select(EventModel).where(EventModel.garden_id == garden_id, EventModel.anahtar == key))).scalar_one_or_none()
            if exists is None:
                session.add(
                    EventModel(
                        garden_id=garden_id, anahtar=key, tur="s2_dusus", turler=["s2_dusus"], baslangic=today - timedelta(days=4), bitis=today - timedelta(days=3), guven="orta", durum="bekliyor", tahmin=False,
                        katman="degisim", ayrinti={"s2_dusus.merkez_lng": round(lng + dx, 6), "s2_dusus.merkez_lat": round(lat + dy, 6)}, formul_surumu="test",
                    )
                )
        await session.commit()
    print("saha turu olayları yazıldı")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main(uuid.UUID(sys.argv[1])))
