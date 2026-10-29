"""TEST ARACI (ürün kodu değil): uçtan uca testler için bir bahçenin hava önbelleğini kayıtlı örnek veriyle doldurur.

Gerçek `WeatherService` yolundan geçer (tahmin + geçmiş senkronu); sağlayıcı yerine kayıtlı örnek veri kullanılır. Böylece sunucu
ağa çıkmadan, gerçek risk motoruyla çalışır. Yalnızca API_DEBUG=true.
Kullanım:  python -m tests.support.seed_weather <bahce-id>
"""

import asyncio
import sys
import uuid
from datetime import date, datetime
from zoneinfo import ZoneInfo

from sqlalchemy import select

from bahcelab_backend.config import get_settings
from bahcelab_backend.database import async_session_factory, engine
from bahcelab_backend.domain.gardens.models import GardenModel
from bahcelab_backend.domain.weather.repository import WeatherRepository
from bahcelab_backend.domain.weather.service import WeatherService

from .weather_sample import build_sample_forecast, build_sample_history, warm_offset


class RecordedProvider:
    name = "kayitli-ornek"
    attribution = "Hava verisi: kayıtlı örnek (test)"

    async def forecast(self, lat: float, lng: float, past_days: int = 7):  # noqa: ANN201
        now = datetime.now(ZoneInfo("Europe/Istanbul"))
        return build_sample_forecast(now, warm_offset(now.date()))

    async def history(self, lat: float, lng: float, start: date, end: date):  # noqa: ANN201
        today = datetime.now(ZoneInfo("Europe/Istanbul")).date()
        return [p for p in build_sample_history(today, 830, warm_offset(today)) if start <= p.tarih <= end]


async def main(garden_id: uuid.UUID) -> None:
    if not get_settings().api_debug:
        raise SystemExit("Reddedildi: yalnızca API_DEBUG=true ortamında çalışır.")
    async with async_session_factory() as session:
        workspace_id = (await session.execute(select(GardenModel.workspace_id).where(GardenModel.id == garden_id))).scalar_one_or_none()
        if workspace_id is None:
            raise SystemExit("Bahçe bulunamadı")
        await WeatherService(WeatherRepository(session, workspace_id), RecordedProvider()).get(garden_id)  # type: ignore[arg-type]
        await session.commit()
        print("hava önbelleği dolduruldu")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main(uuid.UUID(sys.argv[1])))
