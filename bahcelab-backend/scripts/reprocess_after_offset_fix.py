"""TEK SEFERLİK: Sentinel-2 işleme sürümü ≥ 04.00 ofseti (−0,1) düzeltildikten sonra eski (ofsetsiz, NDVI ≈ 0,2 düşük) sonuçları siler ve
tüm bahçeleri yeniden işler; çok yıllık kompozitler ve sonuçlar da silinir (yeniden başlatılmalı). Kullanım: python scripts/reprocess_after_offset_fix.py <kullanıcı-e-postası>  (yalnızca o kullanıcının bahçeleri)"""

import asyncio
import sys

from sqlalchemy import text

from bahcelab_backend.database import async_session_factory, engine
from bahcelab_backend.domain.gardens import models as _garden_models  # noqa: F401  (FK çözümü için)
from bahcelab_backend.domain.multiyear import models as _multiyear_models  # noqa: F401
from bahcelab_backend.domain.ndvi.persist import storage_prefix
from bahcelab_backend.domain.ndvi.repository import NdviRepository
from bahcelab_backend.domain.ndvi.runner import run_job
from bahcelab_backend.shared.storage import get_storage


async def main() -> None:
    storage = get_storage()
    async with async_session_factory() as session:
        email = sys.argv[1]
        ids = [
            r[0]
            for r in (
                await session.execute(
                    text(
                        "SELECT g.id FROM gardens g JOIN workspace_members m ON m.workspace_id = g.workspace_id "
                        "JOIN users u ON u.id = m.user_id WHERE u.email = :e"
                    ),
                    {"e": email},
                )
            ).all()
        ]
    for gid in ids:
        async with async_session_factory() as session:
            repo = NdviRepository(session)
            await repo.delete_observations(gid)
            for table in ("multiyear_results", "multiyear_years", "multiyear_runs"):
                await session.execute(text(f"DELETE FROM {table} WHERE garden_id = :g"), {"g": gid})
            storage.delete_prefix(storage_prefix(gid))
            storage.delete_prefix(f"multiyear/{gid}")
            job = await repo.create_job(gid, "yeniden")
            await session.commit()
        if job is not None:
            print(f"{gid}: yeniden işleniyor…", flush=True)
            await run_job(job.id)
    await engine.dispose()
    print("bitti", [str(i) for i in ids])


if __name__ == "__main__":
    asyncio.run(main())
