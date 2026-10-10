"""Geliştirme verisi: test@bahcelab.com / test1234 kullanıcısı ve örnek bir limon bahçesi
(Erdemli, Tömük — yaklaşık 26 dekar) ve ağ olmadan demo için örnek NDVI serisi (kaynak = "ornek").

Migration'a gömülmez; yalnızca API_DEBUG=true iken çalışır, böylece bilinen bir şifre
üretim veritabanına yanlışlıkla yazılmaz. Birden fazla çalıştırmak güvenlidir.

Kullanım (bahcelab-backend klasöründen):  make db-seed
"""

import asyncio
from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from sqlalchemy import select

from bahcelab_backend.config import get_settings
from bahcelab_backend.database import async_session_factory, engine
from bahcelab_backend.domain.auth.repository import AuthRepository
from bahcelab_backend.domain.auth.security import hash_password
from bahcelab_backend.domain.gardens.models import GardenModel
from bahcelab_backend.domain.gardens.repository import GardenRepository
from bahcelab_backend.domain.ndvi.persist import missing_outputs
from bahcelab_backend.domain.ndvi.repository import NdviRepository
from bahcelab_backend.domain.ndvi.sample import build_sample_series
from bahcelab_backend.domain.weather.repository import WeatherRepository
from bahcelab_backend.domain.weather.sample import build_sample_forecast, build_sample_history
from bahcelab_backend.domain.weather.service import snap
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

        # Örnek indeks serisi (NDVI, MSAVI, NDRE, NDMI, CIgreen, gerçek renk): gerçek işleme hattıyla
        # üretilir ve "Örnek veri" olarak etiketlenir. Eski biçimde (yalnızca NDVI) kalmışsa yeniden üretilir.
        # Gerçek veriye geçmek için arayüzde «Şimdi güncelle» (örnek kayıtlar değiştirilir).
        ndvi = NdviRepository(session)
        scenes = await ndvi.list_scenes(garden_id)
        sample_ok = bool(scenes) and all(
            s.scene.kaynak == "ornek" and not missing_outputs(s) for s in scenes
        )
        if scenes and not sample_ok and all(s.scene.kaynak == "ornek" for s in scenes):
            for key in await ndvi.storage_keys(garden_id, only_sample=True):
                get_storage().delete(key)
            await ndvi.delete_observations(garden_id, only_sample=True)
            scenes = []
        if scenes:
            print("Zaten var: indeks kayıtları")
        else:
            today = datetime.now(UTC).date()
            new_scenes, new_rows = build_sample_series(garden_id, geojson, get_storage(), today)
            for scene in new_scenes:
                await ndvi.add_scene(scene)
            for row in new_rows:
                await ndvi.upsert_index(row)
            clear = sum(1 for s in new_scenes if s.durum == "tamam")
            print(
                f"Oluşturuldu: örnek indeks serisi ({len(new_scenes)} tarih, "
                f"{clear} geçerli, {len(new_scenes) - clear} bulutlu)"
            )

        # Örnek hava verisi (ağsız demo): tahmin önbelleği ve günlük geçmiş `ornek` olarak yazılır;
        # internet varsa ilk istekte gerçek veriyle değişir.
        weather = WeatherRepository(session, workspace_id)
        (point,) = await weather.garden_points(garden_id)
        step = get_settings().weather_cell_degrees
        cell = await weather.cell(snap(float(point["enlem"]), step), snap(float(point["boylam"]), step))
        if cell.tahmin is None:
            now = datetime.now(ZoneInfo("Europe/Istanbul"))
            forecast = build_sample_forecast(now)
            await weather.save_forecast(cell, forecast.model_dump(mode="json"), datetime.now(UTC), "ornek")
            days = get_settings().weather_history_days
            await weather.upsert_daily(cell.id, build_sample_history(now.date(), days), "ornek")
            print("Oluşturuldu: örnek hava verisi")
        else:
            print("Zaten var: hava verisi")
        await session.commit()
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
