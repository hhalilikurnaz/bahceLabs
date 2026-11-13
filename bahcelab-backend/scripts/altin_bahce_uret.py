"""9J-6: ALTIN BAHÇE girdisini dosyaya yazar (donmuş girdi: jlnnlk, sabit tarih aralığı). Yalnız okur; çıktı tests/golden/jlnnlk_girdi.json (test sürümlenir, veritabanından bağımsız çalışır).
Kullanım: PYTHONPATH=src .venv/bin/python scripts/altin_bahce_uret.py [garden_id]"""
import asyncio
import json
import sys
import uuid
from datetime import date, datetime
from pathlib import Path

from sqlalchemy import text

from bahcelab_backend.database import async_session_factory
from bahcelab_backend.domain.water.era5_sync import garden_cell

GID = "47fcf918-996b-4146-9f0a-2ac82330ae83"
BAS, BIT = date(2024, 10, 1), date(2026, 10, 9)  # donmuş pencere (BUGÜN = BIT)
CIKTI = Path(__file__).resolve().parents[1] / "tests" / "golden" / "jlnnlk_girdi.json"


def js(v):  # noqa: ANN001, ANN201
    if isinstance(v, (date, datetime)):
        return v.isoformat()
    if isinstance(v, uuid.UUID):
        return str(v)
    return v


async def main() -> None:
    gid = uuid.UUID(sys.argv[1] if len(sys.argv) > 1 else GID)
    async with async_session_factory() as s:
        g = (await s.execute(text("SELECT ad, urun, cesit_kodu, cesit, il, ilce, dikim_yili, ST_AsGeoJSON(geom) FROM gardens WHERE id = :g"), {"g": gid})).one()
        cell, _, _ = await garden_cell(s, gid)
        era5 = [dict(r._mapping) for r in (await s.execute(text("SELECT tarih, sm0, sm1, sm2, sm3, et0_mm, yagis_mm, t_ort, t_min, t_max, toprak_kaynak, hava_kaynak FROM era5_daily WHERE cell_id = :c AND tarih BETWEEN :a AND :b ORDER BY tarih"), {"c": cell, "a": date(2015, 1, 1), "b": BIT})).all()]
        soil = dict((await s.execute(text("SELECT kum_yuzde, kil_yuzde, silt_yuzde, organik_karbon_g_kg, tarla_kapasitesi, solma_noktasi, kaynak FROM soil_profiles WHERE garden_id = :g"), {"g": gid})).one()._mapping)
        acq = [dict(r._mapping) for r in (await s.execute(text("SELECT a.tarih, a.scene_id, a.gecerli_oran, st.ortalama AS ndvi FROM acquisitions a JOIN acquisition_stats st ON st.acquisition_id = a.id AND st.indeks = 'ndvi' WHERE a.garden_id = :g AND a.source_id = 'sentinel2-l2a' AND a.durum = 'net' AND a.tarih <= :b ORDER BY a.tarih"), {"g": gid, "b": BIT})).all()]
        sk_ndmi = [dict(r._mapping) for r in (await s.execute(text("SELECT tarih, ndmi, gecerli_oran, piksel FROM sk_ndmi WHERE garden_id = :g AND sektor_ad = 'Bahçe' AND tarih <= :b ORDER BY tarih"), {"g": gid, "b": BIT})).all()]
        halka = [dict(r._mapping) for r in (await s.execute(text("SELECT tarih, ndmi, ndvi, piksel, halka_piksel FROM sk_halka WHERE garden_id = :g AND tarih <= :b ORDER BY tarih"), {"g": gid, "b": BIT})).all()]
        imerg = [dict(r._mapping) for r in (await s.execute(text("SELECT tarih, deger FROM dogrulama_gozlem WHERE garden_id = :g AND source_id = 'imerg-daily' AND tarih <= :b ORDER BY tarih"), {"g": gid, "b": BIT})).all()]
    veri = {"bas": BAS.isoformat(), "bugun": BIT.isoformat(), "bahce": {"ad": g[0], "urun": g[1], "cesit_kodu": g[2], "cesit": g[3], "il": g[4], "ilce": g[5], "dikim_yili": g[6], "geometry": json.loads(g[7])}, "soil": soil, "era5": era5, "acquisitions": acq, "sk_ndmi": sk_ndmi, "sk_halka": halka, "imerg": imerg}
    CIKTI.write_text(json.dumps(veri, default=js, ensure_ascii=False, separators=(",", ":")))
    print(CIKTI, CIKTI.stat().st_size, {k: len(v) for k, v in veri.items() if isinstance(v, list)})


asyncio.run(main())
