"""TEST ARACI (ürün kodu değil): iç izleme ekranı için GERÇEK izleme işlerini (günlük akış anlık görüntüsü + haftalık uyum) geçmiş günler için koşturur; ağ yok.
Kullanım:  python -m tests.support.seed_izleme [gün-sayısı=21]
"""

import asyncio
import sys
from datetime import UTC, datetime, timedelta

from bahcelab_backend.database import async_session_factory
from bahcelab_backend.domain.izleme import isler


async def main(gun: int) -> None:
    bugun = datetime.now(UTC).date()
    for k in range(gun, -1, -1):
        await isler.gunluk(async_session_factory, bugun - timedelta(days=k))
    for h in range(3, -1, -1):
        await isler.haftalik(async_session_factory, bugun - timedelta(weeks=h), agdan=False)


if __name__ == "__main__":
    asyncio.run(main(int(sys.argv[1]) if len(sys.argv) > 1 else 21))
