"""TEST ARACI (ürün kodu değil): uçtan uca testler için bir bahçeye 2017'den bugüne ay başına 2 net edinim (gösterge ızgaraları + istatistikler),
tamamlanmış geçmiş doldurma ayları ve normal bantlar yazar. Sentetik desen (üç şeritli bahçe + mevsimsellik); gerçek depolama ve bant hesabından geçer.
Yalnızca API_DEBUG=true. Kullanım:  python -m tests.support.seed_acquisitions <bahce-id> [--basit]   (--basit: yalnız son 14 ay)
"""

import asyncio
import json
import math
import sys
import uuid
from datetime import UTC, date, datetime

import numpy as np
from sqlalchemy import func, select

from bahcelab_backend.config import get_settings
from bahcelab_backend.database import async_session_factory, engine
from bahcelab_backend.domain.acquisitions.backfill import compute_bands_for
from bahcelab_backend.domain.acquisitions.models import (
    ACQ_NET,
    MONTH_DONE,
    AcquisitionModel,
    BackfillMonthModel,
)
from bahcelab_backend.domain.acquisitions.processor import SOURCE_ID
from bahcelab_backend.domain.acquisitions.repository import AcquisitionRepository
from bahcelab_backend.domain.acquisitions.selection import months_between
from bahcelab_backend.domain.acquisitions.store import encode_grids, grid_key, pixel_stats
from bahcelab_backend.domain.gardens.models import GardenModel
from bahcelab_backend.domain.imagery.formulas import FORMULA_VERSION
from bahcelab_backend.domain.multiyear.grid import canonical_grid, garden_mask
from bahcelab_backend.shared.storage import get_storage


def pattern(shape: tuple[int, int]) -> np.ndarray:
    out = np.empty(shape, dtype=np.float32)
    edges = np.linspace(0, shape[1], 4).astype(int)
    for level, a, b in zip((0.50, 0.62, 0.74), edges[:-1], edges[1:], strict=True):
        out[:, a:b] = level
    return out


async def main(garden_id: uuid.UUID, basit: bool) -> None:
    if not get_settings().api_debug:
        raise SystemExit("Reddedildi: yalnızca API_DEBUG=true ortamında çalışır.")
    async with async_session_factory() as session:
        geojson = (await session.execute(select(func.ST_AsGeoJSON(GardenModel.geom)).where(GardenModel.id == garden_id))).scalar_one_or_none()
        if geojson is None:
            raise SystemExit("Bahçe bulunamadı")
        geometry = json.loads(geojson)
        grid = canonical_grid(geometry)
        mask = garden_mask(grid, geometry)
        base = pattern(grid.shape)
        today = datetime.now(UTC).date()
        start = date(today.year - 1, today.month, 1) if basit else date(2017, 1, 1)
        repo = AcquisitionRepository(session)
        storage = get_storage()
        ghash = await repo.geometry_hash(garden_id) or ""
        months = months_between(start, today)
        rng = np.random.default_rng(7)
        for month in months:
            session.add(BackfillMonthModel(garden_id=garden_id, source_id=SOURCE_ID, ay=month, durum=MONTH_DONE, net_sahne=2, aday_sayisi=2, geometry_hash=ghash))
            season = 0.08 * math.sin((month.month - 4) / 12 * 2 * math.pi)  # yaz yüksek, kış düşük
            days = (4, 19) if (month.year, month.month) != (today.year, today.month) else tuple(sorted({4, max(1, today.day - 2)}))  # güncel ayda son sahne HER ZAMAN ≤ 3 gün önce (testler «taze görüntü» varsayar; takvim gününe bağlı olmasın)
            for day in days:
                tarih = date(month.year, month.month, day)
                if tarih > today:
                    continue
                ndvi = np.clip(base + season + rng.normal(0, 0.015, grid.shape), 0.05, 0.95).astype(np.float32)
                grids = {
                    "ndvi": ndvi, "ndre": (ndvi * 0.7).astype(np.float32), "msavi": (ndvi * 0.8).astype(np.float32),
                    "ndmi": (ndvi * 0.4 - 0.05).astype(np.float32), "lai": np.clip(ndvi * 4.5 - 1.2, 0, 6).astype(np.float32),
                }
                grids = {k: np.where(mask, v, np.nan).astype(np.float32) for k, v in grids.items()}
                scene_id = f"SEED-{tarih.isoformat()}"
                data = encode_grids(grids)
                key = grid_key(garden_id, scene_id)
                storage.save(key, data)
                row = AcquisitionModel(
                    garden_id=garden_id, source_id=SOURCE_ID, scene_id=scene_id, tarih=tarih, bulut_orani=4.0, durum=ACQ_NET, gecerli_oran=1.0, gecikme_gun=2,
                    isleme_surumu="05.13", formul_surumu=FORMULA_VERSION, izgara_yolu=key, izgara_boyut_bayt=len(data),
                )
                stats = {k: s for k, v in grids.items() if (s := pixel_stats(v, mask)) is not None}
                await repo.upsert_acquisition(row, stats)
        await compute_bands_for(session, garden_id)
        await session.commit()
        print(f"{len(months)} ay, normal bantlar yazıldı")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main(uuid.UUID(sys.argv[1]), "--basit" in sys.argv[2:]))
