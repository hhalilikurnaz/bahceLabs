"""9I Dilim 1A: bir bahçe için Landsat/SSEBop ETa hattını (ölç + hesapla) çalıştırır; sonuç yalnız iç kalite tablolarına (`eta_*`) yazılır, kullanıcıya gösterilmez.
Kullanım: PYTHONPATH=src .venv/bin/python scripts/eta_calistir.py <garden_id> [başlangıç bitiş] [--sadece-hesap]
(EARTHDATA_TOKEN varsa ECOSTRESS V003 doğrulaması da alınır: `set -a; . ./.env.local; set +a`)"""
import asyncio
import sys
import uuid
from datetime import date, timedelta

from bahcelab_backend.database import async_session_factory
from bahcelab_backend.domain.eta.service import EtaService
from bahcelab_backend.shared.clock import bugun


async def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    gid = uuid.UUID(args[0])
    bit = date.fromisoformat(args[2]) if len(args) > 2 else bugun()
    bas = date.fromisoformat(args[1]) if len(args) > 1 else bit - timedelta(days=730)
    async with async_session_factory() as session:
        svc = EtaService(session)
        if "--sadece-hesap" not in sys.argv:
            aranan, yazilan = await svc.olc(gid, bas, bit)
            print(f"sahne aranan {aranan}, yazılan (tarih başına en iyi) {yazilan}")
        ozet = await svc.hesapla(gid)
        await session.commit()
        print(ozet)


asyncio.run(main())
