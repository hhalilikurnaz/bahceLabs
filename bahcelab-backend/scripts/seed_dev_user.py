"""Geliştirme verisi: test@bahcelab.com / test1234 kullanıcısı ve örnek bir limon bahçesi
(Erdemli, Tömük — yaklaşık 26 dekar) ve ağ olmadan demo için örnek NDVI serisi (kaynak = "ornek").

Migration'a gömülmez; yalnızca API_DEBUG=true iken çalışır, böylece bilinen bir şifre
üretim veritabanına yanlışlıkla yazılmaz. Birden fazla çalıştırmak güvenlidir.

Kullanım (bahcelab-backend klasöründen):  make db-seed
"""

import asyncio
from datetime import UTC, datetime

from sqlalchemy import select

from bahcelab_backend.config import get_settings
from bahcelab_backend.database import async_session_factory, engine
from bahcelab_backend.domain.auth.repository import AuthRepository
from bahcelab_backend.domain.auth.security import hash_password
from bahcelab_backend.domain.gardens.models import GardenModel
from bahcelab_backend.domain.gardens.repository import GardenRepository
from bahcelab_backend.domain.ndvi.repository import NdviRepository
from bahcelab_backend.domain.ndvi.sample import build_sample_series
from bahcelab_backend.shared.storage import get_storage

EMAIL = "test@bahcelab.com"
PASSWORD = "test1234"
NAME = "Test Kullanıcı"

GARDEN_NAME = "Tömük Limon Bahçesi"
# Erdemli / Tömük çevresindeki narenciye parseli (EPSG:4326, [boylam, enlem])
GARDEN_RING = [
    [34.382764, 36.659183],
    [34.384607, 36.658899],
    [34.384799, 36.657495],
    [34.382955, 36.657692],
    [34.382764, 36.659183],
]


async def main() -> None:
    if not get_settings().api_debug:
        raise SystemExit("Reddedildi: seed yalnızca API_DEBUG=true ortamında çalışır.")

    async with async_session_factory() as session:
        repo = AuthRepository(session)
        user = await repo.get_user_by_email(EMAIL)
        if user is not None:
            print(f"Zaten var: {EMAIL}")
        else:
            created = await repo.create_user_with_workspace(
                name=NAME, email=EMAIL, password_hash=hash_password(PASSWORD)
            )
            if created is None:
                raise SystemExit("Kullanıcı oluşturulamadı")
            user = created[0]
            print(f"Oluşturuldu: {EMAIL} / {PASSWORD}")
        await session.flush()

        workspace_id = await repo.get_workspace_id(user.id)
        existing = await session.execute(
            select(GardenModel.id).where(
                GardenModel.workspace_id == workspace_id, GardenModel.ad == GARDEN_NAME
            )
        )
        garden_id = existing.scalar_one_or_none()
        geojson = {"type": "Polygon", "coordinates": [GARDEN_RING]}
        if garden_id is not None:
            print(f"Zaten var: {GARDEN_NAME}")
        else:
            gardens = GardenRepository(session, workspace_id)
            measurement = await gardens.measure(geojson)  # alan sunucuda hesaplanır
            garden_id = await gardens.create(
                values={
                    "ad": GARDEN_NAME,
                    "urun": "limon",
                    "cesit": "Interdonato",
                    "dikim_yili": 2012,
                    "il": "Mersin",
                    "ilce": "Erdemli",
                },
                geojson=geojson,
                area_dekar=measurement.area_dekar,
            )
            print(f"Oluşturuldu: {GARDEN_NAME} ({measurement.area_dekar:.1f} dekar)")

        # Örnek NDVI serisi: gerçek işleme hattıyla üretilir, "Örnek veri" olarak etiketlenir.
        # Gerçek veriye geçmek için arayüzde «Şimdi güncelle» (örnek kayıtlar değiştirilir).
        ndvi = NdviRepository(session)
        if await ndvi.existing_dates(garden_id):
            print("Zaten var: NDVI kayıtları")
        else:
            today = datetime.now(UTC).date()
            observations = build_sample_series(garden_id, geojson, get_storage(), today)
            for observation in observations:
                await ndvi.add_observation(observation)
            clear = sum(1 for o in observations if o.durum == "tamam")
            print(
                f"Oluşturuldu: örnek NDVI serisi ({len(observations)} tarih, "
                f"{clear} geçerli, {len(observations) - clear} bulutlu)"
            )
        await session.commit()
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
