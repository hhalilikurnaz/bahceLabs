"""Yağış serisi karşılaştırması (YALNIZ OKUR): Meteostat istasyon gözlemi (gerçek ölçüm satırları) ↔ weather_daily (Hava sekmesi), era5_daily (kova/plan/Su), IMERG (doğrulama).

Kullanım: PYTHONPATH=src .venv/bin/python scripts/yagis_karsilastirma.py <garden_id> [istasyon_id=17340] [gun=180]
Çıktı: JSON (bir satır `{` ile başlar). Pencere: istasyonun SON gözlem gününde biten `gun` günlük aralık; ek olarak son 365 gün ve tüm ortak dönem.
"""

from __future__ import annotations

import asyncio
import json
import sys
import uuid
from datetime import timedelta

import numpy as np
from sqlalchemy import text

from bahcelab_backend.database import async_session_factory
from bahcelab_backend.domain.water.era5_sync import garden_cell

ISLAK_MM = 1.0


def olc(obs: dict, ser: dict, gunler: list) -> dict | None:
    d = [x for x in gunler if x in obs and obs[x] is not None and x in ser and ser[x] is not None]
    if len(d) < 20:
        return None
    o = np.array([obs[x] for x in d], float)
    s = np.array([ser[x] for x in d], float)
    ow, sw = o >= ISLAK_MM, s >= ISLAK_MM
    hit, miss, fa = int((ow & sw).sum()), int((ow & ~sw).sum()), int((~ow & sw).sum())
    return {
        "n": len(d), "mae_mm": float(np.abs(s - o).mean()), "rmse_mm": float(np.sqrt(((s - o) ** 2).mean())), "toplam_gozlem_mm": float(o.sum()), "toplam_seri_mm": float(s.sum()),
        "sapma_yuzde": None if o.sum() == 0 else float((s.sum() - o.sum()) / o.sum() * 100), "korelasyon": None if o.std() == 0 or s.std() == 0 else float(np.corrcoef(o, s)[0, 1]),
        "islak_gun_gozlem": int(ow.sum()), "islak_gun_seri": int(sw.sum()), "isabet": hit, "kacan": miss, "yanlis_alarm": fa,
        "isabet_orani": None if ow.sum() == 0 else hit / int(ow.sum()), "yanlis_alarm_orani": None if (~ow).sum() == 0 else fa / int((~ow).sum()), "csi": None if hit + miss + fa == 0 else hit / (hit + miss + fa),
    }


async def main() -> None:
    gid = uuid.UUID(sys.argv[1])
    ist = sys.argv[2] if len(sys.argv) > 2 else "17340"
    gun = int(sys.argv[3]) if len(sys.argv) > 3 else 180
    async with async_session_factory() as s:
        cell, _, _ = await garden_cell(s, gid)
        obs = {r[0]: float(r[1]) for r in (await s.execute(text("SELECT tarih, prcp FROM station_daily WHERE istasyon_id = :i AND prcp IS NOT NULL"), {"i": ist})).all()}
        wd = {r[0]: float(r[1]) for r in (await s.execute(text("SELECT tarih, yagis_mm FROM weather_daily WHERE cell_id = :c AND yagis_mm IS NOT NULL"), {"c": cell})).all()}
        wk = {str(r[0]): r[1] for r in (await s.execute(text("SELECT kaynak, count(*) FROM weather_daily WHERE cell_id = :c GROUP BY 1"), {"c": cell})).all()}
        e5 = {r[0]: float(r[1]) for r in (await s.execute(text("SELECT tarih, yagis_mm FROM era5_daily WHERE cell_id = :c AND yagis_mm IS NOT NULL"), {"c": cell})).all()}
        e5k = {r[0]: r[1] for r in (await s.execute(text("SELECT tarih, hava_kaynak FROM era5_daily WHERE cell_id = :c"), {"c": cell})).all()}
        im = {r[0]: float(r[1]) for r in (await s.execute(text("SELECT tarih, deger FROM dogrulama_gozlem WHERE garden_id = :g AND source_id = 'imerg-daily' AND deger IS NOT NULL"), {"g": gid})).all()}
        dist = (await s.execute(text("SELECT ST_Distance(ST_Centroid(g.geom)::geography, ST_SetSRID(ST_MakePoint(st.lng, st.lat), 4326)::geography) / 1000 FROM gardens g, stations st WHERE g.id = :g AND st.id = :i"), {"g": gid, "i": ist})).scalar()
    son = max(obs)
    pencereler = {f"son_{gun}_gun": [son - timedelta(days=k) for k in range(gun)], "son_365_gun": [son - timedelta(days=k) for k in range(365)], "tum_ortak_donem": sorted(obs)}
    seriler = {"weather_daily (Hava sekmesi)": wd, "era5_daily (kova, plan, Su)": e5, "IMERG (doğrulama)": im}
    out: dict = {"istasyon": ist, "uzaklik_km": float(dist), "son_gozlem": str(son), "weather_daily_kaynaklar": wk, "era5_son180_kaynak": {}, "pencereler": {}}
    for d in pencereler[f"son_{gun}_gun"]:
        k = str(e5k.get(d))
        out["era5_son180_kaynak"][k] = out["era5_son180_kaynak"].get(k, 0) + 1
    for ad, gunler in pencereler.items():
        ortak = [d for d in gunler if all(d in sr for sr in seriler.values())]
        out["pencereler"][ad] = {"gun": len(gunler), "ortak_gun": len(ortak), "seriler": {k: olc(obs, sr, gunler) for k, sr in seriler.items()}, "ortak_gunlerde": {k: olc(obs, sr, ortak) for k, sr in seriler.items()}}
    print(json.dumps(out, ensure_ascii=False))


asyncio.run(main())
