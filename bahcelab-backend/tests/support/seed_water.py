"""TEST ARACI (ürün kodu değil): uçtan uca testler için bir bahçeye su ve sıcaklık verisi yazar.

Ağsız: ERA5 günlük önbelleği mevsimsel (deterministik) bir seriyle doldurulur, toprak profili satırı yazılır, Landsat yüzey sıcaklığı
sahte sağlayıcı + GERÇEK geçmiş doldurma hattından geçer (QA maskesi, istatistik, tampon halkası). Yalnızca API_DEBUG=true.
Kullanım:  python -m tests.support.seed_water <bahce-id>
"""

import asyncio
import json
import math
import sys
import uuid
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import func, select, text

from bahcelab_backend.config import get_settings
from bahcelab_backend.database import async_session_factory, engine
from bahcelab_backend.domain.acquisitions.backfill import (
    BackfillRunner,
    BackfillService,
    ImmediateMonthQueue,
)
from bahcelab_backend.domain.acquisitions.landsat_processor import LANDSAT_SOURCE
from bahcelab_backend.domain.gardens.models import GardenModel
from bahcelab_backend.domain.imagery.registry import get_imagery_provider
from bahcelab_backend.domain.water.era5_sync import garden_cell, upsert_days
from bahcelab_backend.domain.water.models import SoilProfileModel
from bahcelab_backend.shared.storage import get_storage

from .fake_landsat import FakeLandsatProvider


def _day_row(day: date, today: date) -> dict:
    doy = day.timetuple().tm_yday
    season = math.sin((doy - 100) / 365 * 2 * math.pi)  # Nisan başı ~0, Temmuz başı ~1 (sıcak), Ocak ~-1
    wet = math.cos((doy - 20) / 365 * 2 * math.pi)  # kış ıslak
    sm = [0.27 + 0.07 * wet, 0.28 + 0.06 * wet, 0.29 + 0.04 * wet, 0.30 + 0.02 * wet]
    sm = [round(v + 0.01 * math.sin(day.toordinal() / 3 + i), 4) for i, v in enumerate(sm)]
    rain = 6.0 if (day.toordinal() % 9 == 0 and wet > 0) else 0.0
    t_ort = 19 + 9 * season
    hourly_t = [round(t_ort - 5 * math.cos((h - 4) / 24 * 2 * math.pi), 2) for h in range(24)]
    return {
        "sm0": sm[0], "sm1": sm[1], "sm2": sm[2], "sm3": sm[3], "et0_mm": round(max(0.3, 3.2 + 2.8 * season), 2), "yagis_mm": rain,
        "t_ort": round(t_ort, 2), "t_min": round(t_ort - 5, 2), "t_max": round(t_ort + 5, 2),
        "saatlik": {"t2m": hourly_t}, "toprak_kaynak": "era5_land" if day <= today else "model", "hava_kaynak": "era5_land" if day <= today else "model",
    }


async def main(garden_id: uuid.UUID) -> None:
    settings = get_settings()
    if not settings.api_debug:
        raise SystemExit("Reddedildi: yalnızca API_DEBUG=true ortamında çalışır.")
    today = datetime.now(UTC).date()
    async with async_session_factory() as session:
        geojson = (await session.execute(select(func.ST_AsGeoJSON(GardenModel.geom)).where(GardenModel.id == garden_id))).scalar_one_or_none()
        if geojson is None:
            raise SystemExit("Bahçe bulunamadı")
        cell, _lat, _lng = await garden_cell(session, garden_id)
        rows = {d: _day_row(d, today) for d in (date(2015, 1, 1) + timedelta(days=i) for i in range((today + timedelta(days=7) - date(2015, 1, 1)).days + 1))}
        await upsert_days(session, cell, rows)
        await session.execute(text("DELETE FROM soil_profiles WHERE garden_id = :g"), {"g": garden_id})
        session.add(SoilProfileModel(garden_id=garden_id, kum_yuzde=33.0, kil_yuzde=27.0, silt_yuzde=40.0, organik_karbon_g_kg=15.0, tarla_kapasitesi=0.323, solma_noktasi=0.175, kaynak="test (kayıtlı)", ayrinti=None))
        await session.commit()
    geometry = json.loads(geojson)
    landsat = FakeLandsatProvider(geometry, step_days=8, start=today - timedelta(days=400))
    runner = BackfillRunner(async_session_factory, get_imagery_provider(), get_storage(), settings.model_copy(update={"acq_landsat_start": (today - timedelta(days=400)).isoformat()}), landsat_provider=landsat)
    async with async_session_factory() as session:
        service = BackfillService(session, runner.provider, runner.storage, ImmediateMonthQueue(runner), runner.settings, landsat_provider=landsat)
        await service.start(garden_id, today=today, source=LANDSAT_SOURCE)
    print("su ve sıcaklık verisi yazıldı")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main(uuid.UUID(sys.argv[1])))
