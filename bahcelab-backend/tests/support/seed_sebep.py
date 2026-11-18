"""TEST ARACI (ürün kodu değil): bir bahçeye «olası sebep» ekranları için taze bir optik canlılık düşüşü olayı yazar (S2 sahneleri + sahne istatistikleri + ERA5 hava + olay satırı). SENTETİK test verisidir.
  belirsiz — son sahnede kısmi düşüş (doğrulama bekliyor); hava soğuk değil, toprak nemi normal → motor sebep SEÇMEZ («belirsiz»)
  kapi     — bulutlu sahnede bahçenin %90'ı düşer, sonraki sahnede toparlanır → «görüntü kaynaklı olabilir» kapısı kapanır
Olay «taze» olmalı (bitiş ≤ `bildirim.taze_olay_gun` = 3 gün): düşüşü gören sahne bugünden 2 gün önce.
Kullanım:  python -m tests.support.seed_sebep <bahce-id> belirsiz|kapi        (yalnızca API_DEBUG=true)"""

import asyncio
import json
import sys
import uuid
from datetime import timedelta

from sqlalchemy import text

from bahcelab_backend.config import get_settings
from bahcelab_backend.database import async_session_factory, engine
from bahcelab_backend.domain.water.era5_sync import garden_cell
from bahcelab_backend.shared.clock import bahce_bugunu

SOURCE = "sentinel2-l2a"


async def main() -> None:
    if not get_settings().api_debug:
        raise SystemExit("Reddedildi: yalnızca API_DEBUG=true ortamında çalışır.")
    gid, mod = uuid.UUID(sys.argv[1]), sys.argv[2]
    async with async_session_factory() as s:
        bugun = await bahce_bugunu(s, gid)
        onceki, sahne, sonraki = bugun - timedelta(days=9), bugun - timedelta(days=2), bugun
        kapi = mod == "kapi"
        degerler = {onceki: (0.72, 0.30, 1.0), sahne: (0.45 if kapi else 0.60, 0.12 if kapi else 0.26, 60.0 if kapi else 3.0)}
        if kapi:
            degerler[sonraki] = (0.72, 0.30, 2.0)  # toparlandı
        for gun, (ndvi, ndmi, bulut) in degerler.items():
            aid = uuid.uuid4()
            await s.execute(
                text("INSERT INTO acquisitions (id, garden_id, source_id, scene_id, tarih, bulut_orani, durum, gecerli_oran, formul_surumu) VALUES (:i, :g, :s, :c, :d, :b, 'net', 1.0, 'seed-sebep') ON CONFLICT DO NOTHING"),
                {"i": aid, "g": gid, "s": SOURCE, "c": f"SEED_{gid}_{gun}", "d": gun, "b": bulut},
            )
            for ind, v in (("ndvi", ndvi), ("ndmi", ndmi)):
                await s.execute(
                    text("INSERT INTO acquisition_stats SELECT id, :n, :v, :v, :v, :v, :v, :v, :v, :v, 100 FROM acquisitions WHERE garden_id = :g AND source_id = :s AND scene_id = :c ON CONFLICT DO NOTHING"),
                    {"n": ind, "v": v, "g": gid, "s": SOURCE, "c": f"SEED_{gid}_{gun}"},
                )
        cell, _, _ = await garden_cell(s, gid)
        for k in range(0, 60):
            await s.execute(
                text("INSERT INTO era5_daily (cell_id, tarih, t_min, t_max, sm1, yagis_mm) VALUES (:c, :d, 12.0, 24.0, 0.25, 0.0) ON CONFLICT (cell_id, tarih) DO UPDATE SET t_min = 12.0, sm1 = 0.25"),
                {"c": cell, "d": bugun - timedelta(days=k)},
            )
        ayrinti = {"s2_dusus.delta_ndvi": -0.27 if kapi else -0.12, "s2_dusus.dusen_pay": 0.9 if kapi else 0.4}
        if kapi:
            ayrinti["s2_dusus.kalici"] = "False"
        await s.execute(
            text(
                "INSERT INTO events (id, garden_id, anahtar, tur, turler, baslangic, bitis, guven, durum, ayrinti, formul_surumu, tahmin, alan_da) "
                "VALUES (:i, :g, :a, 's2_dusus', CAST(:t AS jsonb), :b, :e, 'orta', CAST(:d AS text), CAST(:y AS jsonb), 'seed-sebep', false, 4.0) ON CONFLICT (garden_id, anahtar) DO NOTHING"
            ),
            {"i": uuid.uuid4(), "g": gid, "a": f"s2_dusus:{onceki + timedelta(days=1)}", "t": json.dumps(["s2_dusus"]), "b": onceki + timedelta(days=1), "e": sahne, "y": json.dumps(ayrinti), "d": "olay" if kapi else "bekliyor"},
        )
        await s.commit()
    await engine.dispose()
    print(f"sebep tohumu ({mod}): sahne {sahne}")


if __name__ == "__main__":
    asyncio.run(main())
