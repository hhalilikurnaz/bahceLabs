"""Zamanlanmış bir işi ŞİMDİ bir kez koşturur (geliştirme/iz sürme): `make job ad=refresh_validation`. Liste: `make job` (ad vermeden).
İşler üretimdekiyle AYNI kod yolundan geçer (jobs/registry); ağ erişimi ve belirteçler .env.local'dan."""

import asyncio
import sys

from bahcelab_backend.config import get_settings
from bahcelab_backend.database import async_session_factory
from bahcelab_backend.domain.weather.provider import get_provider
from bahcelab_backend.jobs import registry


async def main(ad: str | None) -> None:
    specler = {s.name: s for s in registry.job_specs(get_settings())}
    if ad is None or ad not in specler:
        print("Kullanım: make job ad=<iş>\nİşler:", ", ".join(sorted(specler)))
        return
    sonuc = await specler[ad].fn(async_session_factory, get_provider())
    print(ad, "→", sonuc)


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else None))
