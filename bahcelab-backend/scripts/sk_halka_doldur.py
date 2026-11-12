"""9I Dilim 1B eki: bir bahçe için komşu halka NDMI serisini (bahçe sınırından 100–300 m, ağaçlık pikseller) Sentinel-2 geçmişinden doldurur (`sk_halka`). Yalnız eksik tarihler okunur.
Kullanım: PYTHONPATH=src .venv/bin/python scripts/sk_halka_doldur.py <garden_id> [en_cok_sahne]"""
import asyncio
import sys
import uuid

from bahcelab_backend.database import async_session_factory
from bahcelab_backend.domain.agro.catalog import load_catalog
from bahcelab_backend.domain.irrigation.sk_halka import SkHalkaServis


async def main() -> None:
    gid = uuid.UUID(sys.argv[1])
    en_cok = int(sys.argv[2]) if len(sys.argv) > 2 else None
    async with async_session_factory() as s:
        n = await SkHalkaServis(s, load_catalog().sistem_kontrol).doldur(gid, en_cok=en_cok)
        await s.commit()
        print(f"halka satırı yazıldı: {n}")


asyncio.run(main())
