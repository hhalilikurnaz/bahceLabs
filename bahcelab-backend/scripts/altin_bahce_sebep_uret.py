"""ADIM 10B · altın bahçe sebep girdisini dev veritabanından dondurur (tests/golden/sebep_girdi.json): jlnnlk + soğuk hava bahçelerinin GERÇEK S2 düşüş olayları için motor girdisi
(S2 sahne istatistikleri, ERA5-Land, istasyon/kamu kaydı, kullanıcı yanıtı, radar). Sentetik değer yok. Yalnızca girdi dosyasını yenilemek için; beklenen çıktı testte ALTIN_GUNCELLE=1 ile üretilir.
Kullanım: python -m scripts.altin_bahce_sebep_uret"""

from __future__ import annotations

import asyncio
import json
from dataclasses import asdict
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from bahcelab_backend.config import get_settings
from bahcelab_backend.domain.agro.catalog import load_catalog
from bahcelab_backend.domain.sebep import servis

HEDEF = Path(__file__).parent.parent / "tests" / "golden" / "sebep_girdi.json"


async def main() -> None:
    eng = create_async_engine(get_settings().database_url)
    k = load_catalog().sebep
    satirlar = []
    async with async_sessionmaker(eng, class_=AsyncSession)() as s:
        for r in (await s.execute(text("SELECT g.ad, e.garden_id, e.anahtar, e.tur, e.bitis, e.ayrinti FROM events e JOIN gardens g ON g.id = e.garden_id WHERE e.turler ? 's2_dusus' ORDER BY g.ad, e.bitis"))).all():
            g, b = await servis.girdi_olustur(s, r.garden_id, r.bitis, k, r.ayrinti)
            if b is None:
                continue
            satirlar.append({"bahce": r.ad, "olay_turu": r.tur, "tarih": str(r.bitis), "girdi": asdict(g)})
    await eng.dispose()
    HEDEF.write_text(json.dumps(satirlar, indent=1, ensure_ascii=False, sort_keys=True) + "\n")
    print(len(satirlar), "olay →", HEDEF)


if __name__ == "__main__":
    asyncio.run(main())
