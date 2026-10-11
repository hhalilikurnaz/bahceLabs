"""TEST ARACI (ürün kodu değil): uçtan uca testler için bir bahçeye örnek uydu serisi yazar.

Gerçek işleme hattından (`build_sample_series`) geçer. Yalnızca API_DEBUG=true ortamında çalışır.
Kullanım (bahcelab-backend klasöründen):  python -m tests.support.seed_scenes <bahce-id> [--flat]
`--flat`: mekânsal deseni olmayan (homojen) bahçe.
"""

import asyncio
import json
import sys
import uuid
from datetime import date

from sqlalchemy import func, select

from bahcelab_backend.config import get_settings
from bahcelab_backend.database import async_session_factory, engine
from bahcelab_backend.domain.gardens.models import GardenModel
from bahcelab_backend.shared.storage import get_storage

from .ndvi_sample import build_sample_series


async def main(garden_id: uuid.UUID, flat: bool) -> None:
    if not get_settings().api_debug:
        raise SystemExit("Reddedildi: yalnızca API_DEBUG=true ortamında çalışır.")
    async with async_session_factory() as session:
        geojson = (
            await session.execute(
                select(func.ST_AsGeoJSON(GardenModel.geom)).where(GardenModel.id == garden_id)
            )
        ).scalar_one_or_none()
        if geojson is None:
            raise SystemExit("Bahçe bulunamadı")
        scenes, rows = build_sample_series(
            garden_id, json.loads(geojson), get_storage(), date.today(), flat=flat
        )
        session.add_all(scenes)
        await session.flush()  # indeks kayıtları sahnelere yabancı anahtarla bağlıdır
        session.add_all(rows)
        await session.commit()
        print(f"{len(scenes)} sahne, {len(rows)} indeks kaydı yazıldı")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main(uuid.UUID(sys.argv[1]), "--flat" in sys.argv[2:]))
