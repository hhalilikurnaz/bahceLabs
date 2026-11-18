"""ADIM 10B · Dilim 2 başı: «görüntü kaynaklı» kapısı için ERKEN sinyal ölçümü (uyarı anındaki veriyle; sonraki sahne kullanılmaz).
  a) komşu halka eş zamanlı düşüşü: aynı sahnede halka NDVI ya da NDMI z ≤ −1 ve hava kanıtı (don/su) yok
  b) SCL bulut gölgesi (3) + bulut olasılığı (8, 9, 10) piksel payı, bahçe + 100 m tamponda ≥ eşik ve hava kanıtı yok
Eşikler ÖNCEDEN belirlenmiş ön değerlerdir (z ≤ −1; pay ≥ %10); sonuca bakılarak ayarlanmaz. Uyarı nüfusu: scripts/sebep_dilim1_olcum.py ile aynı (13 uyarı).
Her kural için: bastırılacak uyarı sayısı ve bunların sonradan toparlanıp toparlanmadığı. KABUL ÖLÇÜTÜ: toparlanmayan (kalıcı) hiçbir uyarı bastırılmaz.
Kullanım: python -m scripts.sebep_dilim2_erken_sinyal [çıktı.json]  (dev veritabanı salt okunur; SCL için ağ)"""

from __future__ import annotations

import asyncio
import json
import sys

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from bahcelab_backend.config import get_settings
from bahcelab_backend.domain.agro.catalog import load_catalog
from bahcelab_backend.domain.sebep import scl, servis

Z_ESIK, PAY_ESIK = -1.0, 0.10


async def main() -> None:
    eng = create_async_engine(get_settings().database_url)
    k = load_catalog().sebep
    pencere = load_catalog().olay.s2_pencere_gun
    satirlar: list[dict] = []
    async with async_sessionmaker(eng, class_=AsyncSession)() as s:
        rows = (await s.execute(text("SELECT e.id, g.ad, e.garden_id, e.tur, e.bitis, e.ayrinti, ST_AsGeoJSON(g.geom) geo FROM events e JOIN gardens g ON g.id = e.garden_id WHERE e.turler ? 's2_dusus' ORDER BY g.ad, e.bitis"))).all()
        for r in rows:
            neden = (r.ayrinti or {}).get("s2_dusus.neden")
            if not (r.tur == "s2_dusus" or (r.tur == "s2_suphe" and neden in ("toparlandi", "teyit_edilemedi"))):
                continue
            g_tum, b = await servis.girdi_olustur(s, r.garden_id, r.bitis, k, r.ayrinti)
            g_an, _ = await servis.girdi_olustur(s, r.garden_id, r.bitis, k, r.ayrinti, as_of=r.bitis)
            if b is None:
                continue
            sonra = "toparlandi" if g_tum.kalici is False else ("kalici" if g_tum.kalici else "bilinmiyor")
            hz = await servis.halka_z(s, r.garden_id, r.bitis, pencere)
            sid = (await s.execute(text("SELECT scene_id FROM acquisitions WHERE garden_id = :g AND source_id = 'sentinel2-l2a' AND tarih = :d"), {"g": r.garden_id, "d": r.bitis})).scalar()
            try:
                sp = await asyncio.to_thread(scl.sahne_paylari, sid, json.loads(r.geo)) if sid else None
            except Exception as e:  # noqa: BLE001
                sp = None
                print("SCL alınamadı", sid, e)
            hava_yok = g_an.tmin_pencere is not None and g_an.tmin_pencere > k.don_c_sinir and not (g_an.z_nem30 is not None and g_an.z_nem30 <= k.z_kurak)
            a = bool(hz and hava_yok and any(v is not None and v <= Z_ESIK for v in (hz["ndvi"], hz["ndmi"])))
            bb = bool(sp and hava_yok and sp["golge_bulut"] >= PAY_ESIK)
            satirlar.append({"bahce": r.ad, "tarih": str(r.bitis), "sonra": sonra, "halka_z": hz, "scl": sp, "hava_kaniti_yok": hava_yok, "a_halka": a, "b_scl": bb, "a_veya_b": a or bb})
    await eng.dispose()
    ozet = {}
    for ad in ("a_halka", "b_scl", "a_veya_b"):
        bast = [x for x in satirlar if x[ad]]
        ozet[ad] = {"bastirilan": len(bast), "toparlanan": sum(x["sonra"] == "toparlandi" for x in bast), "kalici": sum(x["sonra"] == "kalici" for x in bast), "bilinmiyor": sum(x["sonra"] == "bilinmiyor" for x in bast)}
    cikti = {"nufus": len(satirlar), "sonra": {t: sum(x["sonra"] == t for x in satirlar) for t in ("toparlandi", "kalici", "bilinmiyor")}, "ozet": ozet, "satirlar": satirlar}
    if len(sys.argv) > 1:
        open(sys.argv[1], "w").write(json.dumps(cikti, ensure_ascii=False, indent=1, default=str))
    for x in satirlar:
        hz = x["halka_z"] or {}
        sp = x["scl"] or {}
        print(f"{x['bahce'][:7]:7} {x['tarih']} sonra={x['sonra']:10} halka z(ndvi,ndmi)=({hz.get('ndvi') and round(hz['ndvi'],1)},{hz.get('ndmi') and round(hz['ndmi'],1)}) scl gölge+bulut={sp.get('golge_bulut') and round(sp['golge_bulut'],3)} hava_yok={x['hava_kaniti_yok']} a={x['a_halka']} b={x['b_scl']}")
    print(json.dumps({"nufus": cikti["nufus"], "sonra": cikti["sonra"], "ozet": ozet}, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())
