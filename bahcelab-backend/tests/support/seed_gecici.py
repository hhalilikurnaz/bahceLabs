"""TEST ARACI (ürün kodu değil): bahçenin ERA5 hücresinde SON N günü (bugün dahil) «geçici» (model) yapar; `--kesinlestir` bu günleri ERA5 olarak işaretler ve yağışı <mm> yapar.
Kullanım:  python -m tests.support.seed_gecici <bahce-id> <n> | python -m tests.support.seed_gecici <bahce-id> <n> --kesinlestir <mm>
"""

import asyncio
import sys
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import text

from bahcelab_backend.database import async_session_factory
from bahcelab_backend.domain.water.era5_sync import garden_cell


async def main() -> None:
    gid, n = uuid.UUID(sys.argv[1]), int(sys.argv[2])
    today = datetime.now(UTC).date()
    async with async_session_factory() as s:
        cell, _, _ = await garden_cell(s, gid)
        if "--kesinlestir" in sys.argv:
            mm = float(sys.argv[sys.argv.index("--kesinlestir") + 1])
            await s.execute(text("UPDATE era5_daily SET hava_kaynak = 'era5_land', yagis_mm = :m WHERE cell_id = :c AND tarih BETWEEN :a AND :b"), {"m": mm, "c": cell, "a": today - timedelta(days=n), "b": today})
        else:
            await s.execute(text("UPDATE era5_daily SET hava_kaynak = 'model' WHERE cell_id = :c AND tarih BETWEEN :a AND :b"), {"c": cell, "a": today - timedelta(days=n - 1), "b": today})
        await s.commit()


asyncio.run(main())
