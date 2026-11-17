"""ADIM 10B · Dilim 1: (a) tüm S2 düşüş olaylarında motor çıktısı (eldeki tüm veri), (b) «görüntü kaynaklı» kapısının geriye dönük etkisi: uyarı ANINDAKİ veriyle (as_of = düşüşü gören sahne)
kapı kaç uyarıyı bastırırdı, bastırılanların kaçı SONRA gerçekten toparlandı (yanlış alarm) ve kaçı gerçek (kalıcı) düşüştü.
Uyarı nüfusu: tur=s2_dusus olayları + sonradan şüpheye düşen (toparlandı / teyit edilemedi) saf optik düşüşler (hepsi «doğrulama bekliyor» olarak bildirilmişti).
Kullanım: python -m scripts.sebep_dilim1_olcum [çıktı.json]  (dev veritabanı; salt okunur)"""

from __future__ import annotations

import asyncio
import json
import sys
from dataclasses import replace

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from bahcelab_backend.config import get_settings
from bahcelab_backend.domain.agro.catalog import load_catalog
from bahcelab_backend.domain.sebep import motor, servis


async def main() -> None:
    eng = create_async_engine(get_settings().database_url)
    k = load_catalog().sebep
    out: dict = {"olaylar": [], "kapi": {}}
    async with async_sessionmaker(eng, class_=AsyncSession)() as s:
        rows = (await s.execute(text("SELECT e.id, g.ad, e.garden_id, e.anahtar, e.tur, e.durum, e.turler, e.bitis, e.ayrinti FROM events e JOIN gardens g ON g.id = e.garden_id WHERE e.turler ? 's2_dusus' ORDER BY g.ad, e.bitis"))).all()
        tablo = []
        for r in rows:
            g_tum, b = await servis.girdi_olustur(s, r.garden_id, r.bitis, k, r.ayrinti)
            if b is None:
                continue
            sonuc = motor.degerlendir(g_tum, k)
            g_an, _ = await servis.girdi_olustur(s, r.garden_id, r.bitis, k, r.ayrinti, as_of=r.bitis)
            tablo.append((r, g_tum, sonuc, g_an))
            out["olaylar"].append({
                "bahce": r.ad, "tarih": str(r.bitis), "tur": r.tur, "durum": r.durum, "neden": (r.ayrinti or {}).get("s2_dusus.neden"), "secim": sonuc.secim, "guven": sonuc.guven, "belirsiz_nedeni": sonuc.belirsiz_nedeni,
                "kararlilik": motor.kararlilik(g_tum, k), "puan": {p.sebep: p.puan for p in sonuc.siralama}, "kapi_tum_veri": sonuc.kapi,
                "kanit": {p.sebep: [f"{x.kod}({x.agirlik:+g}|{x.bagimsizlik})" for x in p.kanitlar] for p in sonuc.siralama},
            })
        # uyarı nüfusu
        nufus = [t for t in tablo if t[0].tur == "s2_dusus" or (t[0].tur == "s2_suphe" and (t[0].ayrinti or {}).get("s2_dusus.neden") in ("toparlandi", "teyit_edilemedi"))]
        out["uyari_nufusu"] = len(nufus)
        for esik in (1.0, 1.5, 2.0, 2.5, 3.0):
            kk = k.model_copy(update={"kapi_esik": esik})
            bast, tp, fp = [], 0, 0
            for r, g_tum, _, g_an in nufus:
                an = motor.degerlendir(g_an, kk)
                out.setdefault("an_goruntu_puan", []).append({"bahce": r.ad, "tarih": str(r.bitis), "puan": an.puan_of("goruntu").puan, "sonradan": "toparlandi" if g_tum.kalici is False else ("kalici" if g_tum.kalici else "bilinmiyor")}) if esik == 2.5 else None
                gercek_toparlandi = g_tum.kalici is False  # sonraki net sahne düşüşü doğrulamadı
                if an.kapi:
                    bast.append({"bahce": r.ad, "tarih": str(r.bitis), "sonradan": "toparlandi" if gercek_toparlandi else ("kalici" if g_tum.kalici else "bilinmiyor")})
                    tp += gercek_toparlandi
                    fp += g_tum.kalici is True
            out["kapi"][str(esik)] = {"bastirilan": len(bast), "dogru_bastirilan_toparlandi": tp, "yanlis_bastirilan_kalici": fp, "ayrinti": bast}
        out["uyari_nufusu_sonuc"] = {"toparlandi": sum(t[1].kalici is False for t in nufus), "kalici": sum(t[1].kalici is True for t in nufus), "bilinmiyor": sum(t[1].kalici is None for t in nufus)}
    await eng.dispose()
    if len(sys.argv) > 1:
        open(sys.argv[1], "w").write(json.dumps(out, ensure_ascii=False, indent=1, default=str))
    for o in out["olaylar"]:
        print(f"{o['bahce'][:7]:7} {o['tarih']} {o['tur']:8} {str(o['neden'])[:10]:10} → {str(o['secim']):8} {o['guven']:10} kar={o['kararlilik']} puan={o['puan']}")
    print(json.dumps({"uyari_nufusu": out["uyari_nufusu"], "sonuc": out["uyari_nufusu_sonuc"], "kapi": {e: {a: b for a, b in v.items() if a != "ayrinti"} for e, v in out["kapi"].items()}}, ensure_ascii=False))


if __name__ == "__main__":
    _ = replace
    asyncio.run(main())
