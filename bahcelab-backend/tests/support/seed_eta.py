"""TEST ARACI (ürün kodu değil): bir bahçe için sentetik Landsat sahneleriyle GERÇEK ETa hattını (ölç + hesapla) koşturur → eta_* tabloları (iç kalite e2e).
Kullanım:  python -m tests.support.seed_eta <bahce-id> tutarli|tutarsiz
"""

import asyncio
import sys
import uuid
from datetime import date, timedelta

from bahcelab_backend.database import async_session_factory
from bahcelab_backend.domain.agro.catalog import load_catalog
from bahcelab_backend.domain.eta import meteo
from bahcelab_backend.domain.eta.service import EtaService

from .fake_eta import SahteBaglam, SahteDogrulama, SahteTermal, sahte_meteo


async def main() -> None:
    gid = uuid.UUID(sys.argv[1])
    tutarli = sys.argv[2] == "tutarli"
    hedef = {date(2025, 6, 2) + timedelta(days=7 * i): (0.5 + (0.01 if i % 2 else -0.01)) if tutarli else (0.3 if i % 2 == 0 else 0.7) for i in range(18)}
    meteo.era5_gunluk = lambda lat, lon, bas, bit, **k: sahte_meteo(bas, bit)  # type: ignore[assignment]
    meteo.meteostat_gunluk = lambda kod, **k: {}  # type: ignore[assignment]
    kural = load_catalog().eta_ic.model_copy(update={"kullanici_min_alan_dekar": 1.0})
    async with async_session_factory() as s:
        svc = EtaService(s, termal=SahteTermal(hedef, 36.66), baglam=SahteBaglam(), dogrulama=SahteDogrulama(), kural=kural)
        await svc.olc(gid, min(hedef) - timedelta(days=3), max(hedef) + timedelta(days=3))
        await svc.hesapla(gid)
        await s.commit()


asyncio.run(main())
