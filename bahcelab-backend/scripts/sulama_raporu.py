"""Sulama planı gerçek çıktı raporu (YALNIZ OKUR): bir bahçe için bu haftanın planı, sezon aralığı ve kuru/ıslak yıl farkı.

Güvenlik: veritabanına KALICI HİÇBİR ŞEY yazmaz (işlem sonunda geri alınır). Bahçenin kayıtlı sulama profili yoksa `--ornek-profil` ile
geçici (kaydedilmeyen) bir örnek profil kullanılır; çıktıda açıkça «örnek profil» yazar. Kullanım:
  PYTHONPATH=src .venv/bin/python scripts/sulama_raporu.py <garden_id> [--ornek-profil] [--agac N] [--fiyat TL_KWH]
"""

from __future__ import annotations

import argparse
import asyncio
import json
import uuid

from sqlalchemy import select, text

from bahcelab_backend.database import async_session_factory
from bahcelab_backend.domain.gardens.models import GardenModel
from bahcelab_backend.domain.irrigation.models import IrrigationProfileModel
from bahcelab_backend.domain.irrigation.service import IrrigationService

ORNEK = dict(sistem="damla", damlatici_sayisi=4, damlatici_debi_lh=4.0, sira_aralik_m=5.0, agac_aralik_m=4.0, pompa_kw=7.5, pompa_debi_m3h=40.0, enerji="sebeke")


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("garden_id")
    ap.add_argument("--ornek-profil", action="store_true")
    ap.add_argument("--agac", type=int, default=None, help="geçici ağaç sayısı (kaydedilmez)")
    ap.add_argument("--fiyat", type=float, default=None, help="geçici kWh fiyatı (kaydedilmez)")
    a = ap.parse_args()
    gid = uuid.UUID(a.garden_id)
    async with async_session_factory() as session:
        g = (await session.execute(select(GardenModel).where(GardenModel.id == gid))).scalar_one()
        svc = IrrigationService(session, g.workspace_id)
        if await session.get(IrrigationProfileModel, gid) is None:
            if not a.ornek_profil:
                print(json.dumps({"hata": "Kayıtlı sulama profili yok; --ornek-profil ile geçici örnek kullanın."}, ensure_ascii=False))
                return
            session.add(IrrigationProfileModel(garden_id=gid, **ORNEK, kwh_fiyat_tl=a.fiyat))
            await session.flush()
        if a.agac is not None:
            await session.execute(text("UPDATE gardens SET agac_sayisi = :n WHERE id = :g"), {"n": a.agac, "g": gid})
            session.expire_all()
        plan = await svc.plan(gid)
        yillar = list(range(2015, 2026))
        sen = await svc.scenarios(gid, yil=2025, gunler=[0, 3], saat=4.0, hedef="salma", yatirim_tl=None)
        sezonlar = {}
        for y in (2021, 2023, 2025):  # sezon yağışı en düşük / en yüksek yıl ve geçen yıl
            r = await svc.season(gid, y)
            sezonlar[y] = {"toplam_m3": r.toplam_m3, "sulama_sayisi": r.sulama_sayisi, "yagis_mm": r.yagis_mm, "stres_gun": r.stres_gun, "gunler": [{"tarih": str(x.tarih), "brut_mm": x.brut_mm} for x in r.gunler if x.brut_mm > 0]}
        out = {"sezonlar": sezonlar, "garden": g.ad, "alan_dekar": float(g.alan_dekar), "ornek_profil": bool(a.ornek_profil), "plan": json.loads(plan.model_dump_json(by_alias=True)), "senaryo": json.loads(sen.model_dump_json(by_alias=True)), "yillar": yillar}
        print(json.dumps(out, ensure_ascii=False, default=str))
        await session.rollback()  # hiçbir şey kalıcı değil


if __name__ == "__main__":
    asyncio.run(main())
