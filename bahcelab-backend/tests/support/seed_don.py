"""TEST ARACI (ürün kodu değil): bir bahçe için gece don riskini GERÇEK motorla (servis.hesapla_ve_yaz) SENTETİK saatlik modellerle yazar; isteğe bağlı topografya (düz ya da dik yamaç DEM), dünkü uyarı gecesi, don olayı + istasyon.
Kullanım:  python -m tests.support.seed_don <bahce-id> uyari|izle|dusuk [--dik] [--dun] [--olay] [--gecmis]"""

import asyncio
import json
import sys
import uuid
from datetime import timedelta

import numpy as np
from pyproj import Transformer
from sqlalchemy import text

from bahcelab_backend.database import async_session_factory
from bahcelab_backend.domain.agro.catalog import load_catalog
from bahcelab_backend.domain.don import olay_yd, servis, topografya
from bahcelab_backend.domain.don.risk import SaatlikModel
from bahcelab_backend.domain.don.tahmin import Sahte
from bahcelab_backend.shared.clock import bahce_bugunu

SEVIYE = {"uyari": [(-1.5, -0.5, 0.5), (2.0, 3.0, 4.0), (6.0, 7.0, 8.0)], "izle": [(1.5, 2.5, 3.5), (6.0, 7.0, 8.0), (6.0, 7.0, 8.0)], "dusuk": [(8.0, 9.0, 10.0), (8.0, 9.0, 10.0), (8.0, 9.0, 10.0)]}


def modeller(gun0, tmins):  # noqa: ANN001, ANN201
    k = load_catalog().don
    out = {m: ([], [], [], []) for m in k.modeller}
    for i, tm in enumerate(tmins):
        sabah = gun0 + timedelta(days=i + 1)
        for m, t in zip(k.modeller, tm, strict=True):
            z, tt, b, w = out[m]
            for h in range(24):
                z.append(f"{sabah.isoformat()}T{h:02d}:00")
                tt.append(t + 0.4 * abs(h - 6))
                b.append(20.0)
                w.append(1.0)
    return [SaatlikModel(m, *v) for m, v in out.items()]


def pencere(egim: float, lat: float, lng: float, km: float):  # noqa: ANN201
    epsg = topografya._utm_epsg(lat, lng)
    cx, cy = Transformer.from_crs(4326, epsg, always_xy=True).transform(lng, lat)
    n = int(km * 1000 / 30)
    x = (np.arange(2 * n + 1) - n) * 30.0
    z = np.tile(100.0 + np.tan(np.radians(egim)) * x, (2 * n + 1, 1))
    return topografya.Pencere(z.astype("float32"), cx - n * 30.0, cy + n * 30.0, epsg)


async def main() -> None:
    gid = uuid.UUID(sys.argv[1])
    seviye = sys.argv[2]
    k = load_catalog().don
    async with async_session_factory() as s:
        bugun = await bahce_bugunu(s, gid)
        await topografya.hesapla(s, gid, k, pencere_fn=lambda la, lo, km: pencere(25.0 if "--dik" in sys.argv else 0.5, la, lo, km))
        await servis.hesapla_ve_yaz(s, gid, Sahte(modeller(bugun, SEVIYE[seviye])), k, bugun)
        if "--dun" in sys.argv:
            await servis.hesapla_ve_yaz(s, gid, Sahte(modeller(bugun - timedelta(days=1), SEVIYE["uyari"])), k, bugun - timedelta(days=1))
        if "--olay" in sys.argv:
            lat, lng = (await s.execute(text("SELECT ST_Y(ST_Centroid(geom)), ST_X(ST_Centroid(geom)) FROM gardens WHERE id = :g"), {"g": gid})).one()
            d0 = bugun - timedelta(days=12)
            sid = f"E{uuid.uuid4().hex[:8]}"
            await s.execute(text("INSERT INTO stations (id, saglayici, ad, lat, lng, yukseklik, gozlem_baslangic, gozlem_bitis) VALUES (:i, 'meteostat', 'E2E istasyonu', :la, :lo, 3, '2020-01-01', '2099-01-01')"), {"i": sid, "la": lat + 0.05, "lo": lng})
            await s.execute(text("INSERT INTO station_daily (istasyon_id, tarih, tmin, prcp) VALUES (:i, :t, 0.7, 0)"), {"i": sid, "t": d0})
            await s.execute(text("INSERT INTO events (id, garden_id, anahtar, tur, turler, baslangic, bitis, guven, siddet, tahmin, ayrinti, formul_surumu) VALUES (:i, :g, :a, 'don', CAST('[\"don\"]' AS jsonb), :b, :e, 'orta', 'normal', false, CAST(:y AS jsonb), 'olay-v2')"),
                            {"i": uuid.uuid4(), "g": gid, "a": f"don:{d0.isoformat()}", "b": d0, "e": d0 + timedelta(days=1), "y": json.dumps({"don.en_dusuk_c": -3.7})})
            await s.execute(text("INSERT INTO field_records (id, garden_id, tur, tarih, aciklama, ayrinti) VALUES (gen_random_uuid(), :g, 'gozlem', :d, 'Genç sürgünlerde kararma', '{}'::jsonb)"), {"g": gid, "d": d0 + timedelta(days=2)})
            await olay_yd.yeniden_degerlendir(s, gid, k)
        if "--gecmis" in sys.argv:  # geçmiş uyarı geceleri + kullanıcı yanıtları + en yakın istasyon gözlemi (iç kalite «don_uyari» ayrıntısı)
            lat, lng = (await s.execute(text("SELECT ST_Y(ST_Centroid(geom)), ST_X(ST_Centroid(geom)) FROM gardens WHERE id = :g"), {"g": gid})).one()
            sid = f"G{uuid.uuid4().hex[:8]}"
            await s.execute(text("INSERT INTO stations (id, saglayici, ad, lat, lng, yukseklik, gozlem_baslangic, gozlem_bitis) VALUES (:i, 'meteostat', 'E2E gece istasyonu', :la, :lo, 3, '2020-01-01', '2099-01-01')"), {"i": sid, "la": lat + 0.04, "lo": lng})
            for i, (yanit, tmin) in enumerate([("oldu", -0.5), ("olmadi", 2.0), ("olmadi", None), ("bilmiyorum", None), (None, 1.5)]):
                gece = bugun - timedelta(days=20 + i)
                await s.execute(text("INSERT INTO don_risk (garden_id, gece, kritik_c, evre, organlar, en_soguk_c, tmin_model, uzlasi, saat_kritik_alti, seviye, olasilik, neden, kural_surum) VALUES (:g, :n, -0.8, 'olgunlasma', CAST('[\"olgun_meyve\"]' AS jsonb), -1.2, CAST('{}' AS jsonb), 2, 0, 'uyari', 0.5, 'x', 'don-1') ON CONFLICT DO NOTHING"), {"g": gid, "n": gece})
                if yanit:
                    await s.execute(text("INSERT INTO don_geri_bildirim (garden_id, gece, yanit) VALUES (:g, :n, :y) ON CONFLICT DO NOTHING"), {"g": gid, "n": gece, "y": yanit})
                if tmin is not None:
                    await s.execute(text("INSERT INTO station_daily (istasyon_id, tarih, tmin, prcp) VALUES (:i, :t, :m, 0)"), {"i": sid, "t": gece + timedelta(days=1), "m": tmin})
        await s.commit()
    print("don tohumlandı")


asyncio.run(main())
