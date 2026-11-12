"""TEST ARACI (ürün kodu değil): sulama sistemi kontrol işareti için NDMI serisini (önbellek tablosu sk_ndmi) yazar: önceki 3 sezonda bugünün fenolojik evresinde NDMI ≈ 0,30; son iki sahne düşük.
Kullanım:  python -m tests.support.seed_sk <bahce-id> tek|vana     (vana: V1 normal, V2 düşük; vana çokgenleri veritabanından)
"""

import asyncio
import json
import sys
import uuid
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import text

from bahcelab_backend.database import async_session_factory
from bahcelab_backend.domain.agro.simulation import stage_on
from bahcelab_backend.domain.irrigation.sk_servis import _hash

TODAY = datetime.now(UTC).astimezone(ZoneInfo("Europe/Istanbul")).date()


def gecmis() -> list[tuple]:
    evre = stage_on("limon", "lamas", TODAY)[0]
    out = []
    for k in range(1, 4):
        for i, off in enumerate(range(-30, 31, 3)):
            d = TODAY - timedelta(days=365 * k) + timedelta(days=off)
            if stage_on("limon", "lamas", d)[0] == evre:
                out.append((d, 0.30 + 0.02 * ((i % 3) - 1)))
    return out


async def yaz(s, gid, ad, geo, son) -> None:  # noqa: ANN001
    await s.execute(text("DELETE FROM sk_ndmi WHERE garden_id = :g AND sektor_ad = :a"), {"g": gid, "a": ad})
    for t, n in gecmis() + son:
        await s.execute(text("INSERT INTO sk_ndmi (garden_id, sektor_ad, tarih, geom_hash, ndmi, gecerli_oran, piksel) VALUES (:g, :a, :t, :h, :n, 1.0, 20)"), {"g": gid, "a": ad, "t": t, "h": _hash(geo), "n": n})


async def main() -> None:
    gid, mod = uuid.UUID(sys.argv[1]), sys.argv[2]
    dusuk = [(TODAY - timedelta(days=5), 0.12), (TODAY - timedelta(days=2), 0.10)]
    normal = [(TODAY - timedelta(days=5), 0.30), (TODAY - timedelta(days=2), 0.31)]
    async with async_session_factory() as s:
        if mod == "tek":
            await yaz(s, gid, "Bahçe", None, dusuk)
        else:
            for ad, son in (("V1", normal), ("V2", dusuk)):
                geo = json.loads((await s.execute(text("SELECT ST_AsGeoJSON(geom) FROM irrigation_sectors WHERE garden_id = :g AND ad = :a"), {"g": gid, "a": ad})).scalar_one())
                await yaz(s, gid, ad, geo, son)
        await s.commit()


asyncio.run(main())
