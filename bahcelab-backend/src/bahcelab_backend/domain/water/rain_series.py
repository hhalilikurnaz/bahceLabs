"""TEK yağış/ET₀ serisi (ADR 0025): kova, sulama planı, Su kartı ve Hava sekmesinin GEÇMİŞ günleri aynı yerden okur.

Seri: `era5_daily` (ERA5, 2015'ten; son günler Open-Meteo model satırı). Aylık karşılaştırmada IMERG sistematik olarak farklıysa (Su sekmesi kuralı, `balance.choose_rain_source`)
GEÇMİŞ günlerin yağışı IMERG'den alınır. Kaynak ve karar cümlesi her yanıtta yazılır. `weather_daily` (Open-Meteo «arşiv») artık yağış kaynağı DEĞİLDİR.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.domain.agro.catalog import SuKurali
from bahcelab_backend.domain.water import balance as wb


@dataclass(frozen=True)
class GecmisHava:
    yagis: dict[date, float | None]
    et0: dict[date, float | None]
    model_gunleri: frozenset[date]  # era5_daily'de «model» satırı olan günler (ERA5'in kesinleşmemiş son günleri)
    kaynak: str  # era5 | imerg
    karar: str

    def kaynak_metni(self) -> str:
        son = max(self.model_gunleri, default=None)
        ek = f"; {len(self.model_gunleri)} son gün model değeri (ERA5 henüz kesinleşmedi)" if son else ""
        ad = "GPM IMERG (geçmiş günler)" if self.kaynak == "imerg" else "ERA5 (Open-Meteo yeniden analiz)"
        return f"Yağış serisi: {ad}{ek}"


async def gecmis_hava(session: AsyncSession, garden_id: uuid.UUID, cell_id: uuid.UUID, today: date, su_rule: SuKurali) -> GecmisHava:
    rows = (await session.execute(text("SELECT tarih, yagis_mm, et0_mm, hava_kaynak FROM era5_daily WHERE cell_id = :c AND tarih BETWEEN :s AND :e"), {"c": cell_id, "s": date(su_rule.klima_ilk_yil, 1, 1), "e": today + timedelta(days=14)})).all()
    imerg = {r[0]: float(r[1]) for r in (await session.execute(text("SELECT tarih, deger FROM dogrulama_gozlem WHERE garden_id = :g AND source_id = 'imerg-daily' AND deger IS NOT NULL"), {"g": garden_id})).all()}
    era5 = {r[0]: float(r[1]) for r in rows if r[1] is not None and r[3] == "era5_land"}
    kaynak, karar = wb.choose_rain_source(wb.monthly_rain(era5, imerg, su_rule.kucuk_yagis_esigi_mm))
    yagis: dict[date, float | None] = {}
    et0: dict[date, float | None] = {}
    for d, rain, e, _ in rows:
        r = None if rain is None else float(rain)
        if kaynak == "imerg" and d < today and d in imerg:
            r = imerg[d]
        yagis[d] = r
        et0[d] = None if e is None else float(e)
    return GecmisHava(yagis, et0, frozenset(r[0] for r in rows if r[3] != "era5_land" and r[0] <= today), kaynak, karar)
