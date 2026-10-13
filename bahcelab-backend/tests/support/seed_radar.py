"""TEST ARACI (ürün kodu değil): uçtan uca testler için bir bahçeye radar serisi yazar.

Ağsız sahte radar sağlayıcısı + GERÇEK geçmiş doldurma hattı (yörünge seçimi, Lee filtresi, istatistik, normal bant, değişim olayları).
Son haftalarda birincil yörüngede ardışık iki düşüş (olay adayı) üretir; sahne düzeyi ±0,5 dB oynar (gerçekçi normal bant genişliği).
Yalnızca API_DEBUG=true. Kullanım:  python -m tests.support.seed_radar <bahce-id> [--eski-optik] [--bulutlu]
  --eski-optik : son 14 gündeki optik edinimleri siler (Durum'da «son optik görüntü N gün önce» satırı)
  --bulutlu    : son 90 güne birkaç bulutlu optik geçiş kaydı ekler (şerit grafiği için)
"""

import asyncio
import sys
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select

from bahcelab_backend.config import get_settings
from bahcelab_backend.database import async_session_factory, engine
from bahcelab_backend.domain.acquisitions.backfill import (
    BackfillRunner,
    BackfillService,
    ImmediateMonthQueue,
)
from bahcelab_backend.domain.acquisitions.models import ACQ_CLOUDY, AcquisitionModel
from bahcelab_backend.domain.acquisitions.processor import SOURCE_ID
from bahcelab_backend.domain.acquisitions.radar_processor import RADAR_SOURCE
from bahcelab_backend.domain.gardens.models import GardenModel
from bahcelab_backend.domain.imagery.registry import get_imagery_provider
from bahcelab_backend.shared.storage import get_storage

from .fake_radar import FakeOrbit, FakeRadarProvider


async def main(garden_id: uuid.UUID, eski_optik: bool, bulutlu: bool) -> None:
    settings = get_settings()
    if not settings.api_debug:
        raise SystemExit("Reddedildi: yalnızca API_DEBUG=true ortamında çalışır.")
    import json

    from sqlalchemy import func

    async with async_session_factory() as session:
        geojson = (await session.execute(select(func.ST_AsGeoJSON(GardenModel.geom)).where(GardenModel.id == garden_id))).scalar_one_or_none()
        if geojson is None:
            raise SystemExit("Bahçe bulunamadı")
    geometry = json.loads(geojson)
    today = datetime.now(UTC).date()
    radar = FakeRadarProvider(geometry, [FakeOrbit(167, "inis", 6, 0), FakeOrbit(94, "inis", 6, 2), FakeOrbit(87, "cikis", 6, 4)])
    radar.jitter_db = 0.5
    radar.noise = False  # kumlanmasız: e2e'de olay adayları deterministik (gerçek veride kumlanma eşiği daha sık aşar)
    days = radar._days(radar.orbits[0], today - timedelta(days=80), today)
    for d in days[-2:]:
        radar.level_by_date[d] = 0.3  # ardışık iki düşüş: olay adayı
    runner = BackfillRunner(async_session_factory, get_imagery_provider(), get_storage(), settings.model_copy(update={"acq_radar_start": "2018-01-01"}), radar_provider=radar)
    async with async_session_factory() as session:
        service = BackfillService(session, runner.provider, runner.storage, ImmediateMonthQueue(runner), runner.settings, radar_provider=radar)
        await service.start(garden_id, today=today, source=RADAR_SOURCE)
    async with async_session_factory() as session:
        if eski_optik:
            await session.execute(delete(AcquisitionModel).where(AcquisitionModel.garden_id == garden_id, AcquisitionModel.source_id == SOURCE_ID, AcquisitionModel.tarih > today - timedelta(days=14)))
        if bulutlu:
            for i, back in enumerate((70, 66, 40, 24)):
                tarih = today - timedelta(days=back)
                session.add(AcquisitionModel(garden_id=garden_id, source_id=SOURCE_ID, scene_id=f"SEED-BULUTLU-{i}-{tarih}", tarih=tarih, bulut_orani=88.0, durum=ACQ_CLOUDY, gecerli_oran=0.1, gecikme_gun=2))
        await session.commit()
    print("radar serisi yazıldı")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main(uuid.UUID(sys.argv[1]), "--eski-optik" in sys.argv[2:], "--bulutlu" in sys.argv[2:]))
