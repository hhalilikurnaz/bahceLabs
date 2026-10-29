"""TEST ARACI (ürün kodu değil): bahçenin yakınına bir test istasyonu ve DÜNÜN gerçek-gözlem satırını yazar (yalnızca API_DEBUG=true).

Kullanım:  python -m tests.support.seed_istasyon <bahce-id> <tmin>
Yalnız min sıcaklık yazılır (yağış yok): don olayı destek/çelişki alır, aşırı yağış olayı «kanıt yok» kalır.
"""

import asyncio
import json
import sys
import uuid
from datetime import timedelta

from shapely.geometry import shape
from sqlalchemy import text

from bahcelab_backend.config import get_settings
from bahcelab_backend.database import async_session_factory, engine
from bahcelab_backend.domain.evidence.models import StationDailyModel, StationModel
from bahcelab_backend.shared.clock import today_istanbul


async def main(garden_id: uuid.UUID, tmin: float) -> None:
    if not get_settings().api_debug:
        raise SystemExit("Reddedildi: yalnızca API_DEBUG=true ortamında çalışır.")
    today = today_istanbul()
    async with async_session_factory() as session:
        raw = (await session.execute(text("SELECT ST_AsGeoJSON(geom) FROM gardens WHERE id = :g"), {"g": garden_id})).scalar_one_or_none()
        if raw is None:
            raise SystemExit("Bahçe bulunamadı")
        c = shape(json.loads(raw)).centroid
        sid = f"E2E-{str(garden_id)[:8]}"
        session.add(StationModel(id=sid, saglayici="test", ad="E2E test istasyonu", lat=float(c.y) + 0.1, lng=float(c.x) + 0.1, yukseklik=5.0, gozlem_baslangic=today - timedelta(days=30), gozlem_bitis=today))
        await session.flush()
        session.add(StationDailyModel(istasyon_id=sid, tarih=today - timedelta(days=1), tmin=tmin, prcp=None))
        await session.commit()
        print(f"İstasyon {sid}: {today - timedelta(days=1)} tmin={tmin}")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main(uuid.UUID(sys.argv[1]), float(sys.argv[2])))
