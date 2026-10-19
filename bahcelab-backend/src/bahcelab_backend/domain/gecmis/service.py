"""Geçmiş sayfası servisi: yıl özeti (canlılık sapması kademe diliyle, olay sayısı, uyumsuz yıl, hasat) ve güvenilir yeşerme başlangıçları.

Yeni veri üretmez; mevcut kayıtları okur: aylık temsilci NDVI (acquisition_stats), olay motoru kayıtları, çok yıllı analiz yılları, kesintisiz canlılık eğrisi.
"""

from __future__ import annotations

import uuid
from collections import Counter
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.domain.acquisitions.processor import SOURCE_ID as S2_SOURCE
from bahcelab_backend.domain.acquisitions.repository import AcquisitionRepository
from bahcelab_backend.domain.agro import catalog as cat
from bahcelab_backend.domain.events.service import event_name, list_events
from bahcelab_backend.domain.gecmis import rules as gr
from bahcelab_backend.domain.gecmis.schemas import (
    GecmisOzeti,
    HasatOzeti,
    OlaySayisi,
    Yesillenme,
    YilSatiri,
)
from bahcelab_backend.domain.multiyear.models import MultiyearYearModel
from bahcelab_backend.domain.series import service as series_service

NOTE = (
    "Yıl etiketi, yaz (Haziran–Eylül) canlılığının DİĞER yıllara göre konumudur; sayı gösterilmez. Eşikler ön değerdir · mühendis onayı bekliyor. "
    "Hasat yalnız Saha Defteri kaydından gelir; kayıt yoksa «kayıt yok» yazılır."
)


async def harvest_summary(session: AsyncSession, garden_id: uuid.UUID) -> dict[int, HasatOzeti]:
    """Yıl → hasat kaydı özeti. Kaynak Saha Defteri kayıtlarıdır (B bölümünde bağlanır); kayıt yoksa boş → «kayıt yok»."""
    return {}


async def build_summary(session: AsyncSession, garden_id: uuid.UUID, today: date) -> GecmisOzeti:
    catalog = cat.load_catalog()
    rule = catalog.gecmis
    monthly = await AcquisitionRepository(session).monthly_values(garden_id, S2_SOURCE, "ndvi")
    summer = {year: gr.summer_value(months, rule) for year, months in monthly.items()}
    levels = gr.year_levels(summer, rule, catalog.durum_v2)
    first = min(monthly) if monthly else None
    years = list(range(first, today.year + 1)) if first is not None else []

    events = await list_events(session, garden_id, since=date(first, 1, 1) if first else None)
    per_year: dict[int, Counter[str]] = {}
    for e in events:
        per_year.setdefault(e.baslangic.year, Counter())[event_name(e).removesuffix(" (doğrulama bekliyor)")] += 1

    mismatch = {
        row.yil: row
        for row in (await session.execute(select(MultiyearYearModel).where(MultiyearYearModel.garden_id == garden_id))).scalars().all()
    }
    harvest = await harvest_summary(session, garden_id)

    rows: list[YilSatiri] = []
    for year in years:
        counts = per_year.get(year, Counter())
        my = mismatch.get(year)
        rows.append(
            YilSatiri(
                yil=year,
                canlilik=levels.get(year),
                canlilik_nedeni=None if levels.get(year) else ("yaz verisi yetersiz" if summer.get(year) is None else "karşılaştıracak yeterli yıl yok"),
                olay_sayisi=sum(counts.values()),
                olaylar=[OlaySayisi(tur_adi=k, sayi=v) for k, v in sorted(counts.items(), key=lambda kv: -kv[1])],
                uyumsuz=None if my is None or my.yetersiz_veri else bool(my.uyumsuz),
                uyumsuz_nedeni=None if my is None or my.yetersiz_veri or not my.uyumsuz else my.uyumsuz_nedeni,
                hasat=harvest.get(year, HasatOzeti(durum="kayit_yok")),
            )
        )

    green: list[Yesillenme] = []
    if first is not None:
        curve = await series_service.curve_for(session, garden_id, date(first, 1, 1), today)
        points = [gr.CurvePoint(p.tarih, p.deger, p.tahmini) for p in curve["noktalar"]]
        observed = [o.tarih for o in curve["gozlemler"]]
        for year in years:
            found = gr.green_up(year, [p for p in points if p.tarih.year == year], [d for d in observed if d.year == year], rule)
            if found is not None:
                green.append(Yesillenme(yil=year, tarih=found.tarih, etiket="ön değer", gozlem_sayisi=found.gozlem))

    return GecmisOzeti(ilk_yil=first, son_yil=today.year, yillar=rows, yesillenme=green, esik_durumu=f"ön değer · {'mühendis onayı bekliyor' if rule.durum == 'dogrulanmadi' else 'mühendis onaylı'}", not_=NOTE)
