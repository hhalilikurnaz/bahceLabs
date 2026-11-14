"""ADIM 10 · Dilim 1: mevcut don olaylarını `don-yd-1` kuralıyla yeniden değerlendirir (silmez; «yeniden değerlendirildi» işareti yazar) ve değişenleri Markdown tablosu olarak basar.
Kullanım: python scripts/don_olay_yd.py [çıktı.md]   (geliştirme veritabanı; ağ gerekmez: istasyon günleri veritabanında)"""

import asyncio
import sys
from pathlib import Path

from sqlalchemy import text

from bahcelab_backend.database import async_session_factory
from bahcelab_backend.domain.agro.catalog import load_catalog
from bahcelab_backend.domain.don import olay_yd


async def main(cikti: Path | None) -> None:
    k = load_catalog().don
    satirlar: list[str] = []
    ozet = {"degerlendirilen": 0, "degisen": 0, "atlanan_kullanici_dogrulamali": 0}
    async with async_session_factory() as s:
        bahceler = (await s.execute(text("SELECT id, ad FROM gardens ORDER BY ad"))).all()
        for gid, ad in bahceler:
            r = await olay_yd.yeniden_degerlendir(s, gid, k)
            ozet["atlanan_kullanici_dogrulamali"] += r["atlanan_kullanici_dogrulamali"]
            for x in r["satirlar"]:
                ozet["degerlendirilen"] += 1
                ozet["degisen"] += int(x["degisti"])
                satirlar.append(f"| {ad} | {x['baslangic']} → {x['bitis']} | {x['model_en_dusuk_c']} | {x['istasyon_en_dusuk_c'] if x['istasyon_en_dusuk_c'] is not None else '—'} | {x['eski_on_yargi']} | **{x['yeni']}** | {'evet' if x['degisti'] else 'hayır'} |")
        await s.commit()
    md = ["# Don olayları — yeniden değerlendirme (`don-yd-1`)", "", f"Kural: sapma düzeltmesi YOK; model olay en düşüğü ↔ ölçüm kaynaklı istasyon gözlemi (≤ 80 km, ≤ 3); `model_sapmasi_olasi` = istasyon > 0 °C ve model istasyondan ≥ σ ({k.sigma_c:g} K) soğuk. Olaylar SİLİNMEDİ/DEĞİŞTİRİLMEDİ; işaret `olay_yeniden_degerlendirme` tablosunda. Kullanıcı doğrulamalı olaylar atlandı: {ozet['atlanan_kullanici_dogrulamali']}.", "",
          f"Değerlendirilen: {ozet['degerlendirilen']} · eski ön yargıdan farklı etiket: {ozet['degisen']}.", "", "| Bahçe | Olay | Model en düşük (°C) | İstasyon en düşük (°C) | Eski ön yargı | Yeni sonuç | Etiket değişti |", "|---|---|---:|---:|---|---|---|", *satirlar]
    metin = "\n".join(md) + "\n"
    print(metin)
    if cikti is not None:
        cikti.write_text(metin)


if __name__ == "__main__":
    asyncio.run(main(Path(sys.argv[1]) if len(sys.argv) > 1 else None))
