"""TEK yağış/ET₀ serisi (ADR 0025): kova, sulama planı, Su kartı ve Hava sekmesinin GEÇMİŞ günleri aynı yerden okur.

Seri: `era5_daily` (ERA5, 2015'ten; son günler Open-Meteo model satırı). Aylık karşılaştırmada IMERG sistematik olarak farklıysa (Su sekmesi kuralı, `balance.choose_rain_source`)
GEÇMİŞ günlerin yağışı IMERG'den alınır. Kaynak ve karar cümlesi her yanıtta yazılır. `weather_daily` (Open-Meteo «arşiv») artık yağış kaynağı DEĞİLDİR.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import date, timedelta

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.domain.agro.catalog import SuKurali, SulamaPlaniKurali
from bahcelab_backend.domain.water import balance as wb


@dataclass(frozen=True)
class AyYanlilik:
    ay: str  # YYYY-AA
    gun: int  # ölçüm + seri eşleşen gün
    olculen_mm: float
    seri_mm: float
    oran: float | None  # ölçüm / seri
    oneri: float | None  # önerilen aylık çarpan (kırpılmış); None: yeterli kanıt ya da belirgin sapma yok


@dataclass(frozen=True)
class GecmisHava:
    yagis: dict[date, float | None]  # KOVAYA giren: bahçede ölçülen gün varsa o, yoksa seri
    et0: dict[date, float | None]
    model_gunleri: frozenset[date]  # era5_daily'de «model» satırı olan günler: GEÇİCİ (kesinleşmemiş) son günler
    kaynak: str  # era5 | imerg
    karar: str
    olculen: dict[date, float] = field(default_factory=dict)  # Saha Defteri «Yağış ölçümü»: o gün kova ölçümü seriden ÖNCE kullanır
    seri_yagis: dict[date, float | None] = field(default_factory=dict)  # ölçüm olmasaydı seri
    yanlilik: tuple[AyYanlilik, ...] = ()

    def kaynak_metni(self) -> str:
        ad = "GPM IMERG (geçmiş günler)" if self.kaynak == "imerg" else "ERA5 (Open-Meteo yeniden analiz)"
        ek = f"; son {len(self.model_gunleri)} gün geçici (Open-Meteo tahmin modeli, ERA5 henüz kesinleşmedi)" if self.model_gunleri else ""
        ol = f"; {len(self.olculen)} gün bahçede ölçüldü (seriden önce kullanıldı)" if self.olculen else ""
        return f"Yağış serisi: {ad}{ek}{ol}"


def yanlilik_hesapla(olculen: dict[date, float], seri: dict[date, float | None], rule: SulamaPlaniKurali) -> tuple[AyYanlilik, ...]:
    """Bahçe ölçeri ↔ seri farkı AYLIK biriktirilir. Öneri (otomatik UYGULANMAZ): ayda ≥ `yagis_olcer_min_gun` eşleşen gün, serinin toplamı ≥ `_min_seri_mm` ve |ölçüm/seri − 1| ≥ `_sapma_esigi` ise çarpan = ölçüm/seri, [alt, üst]'e kırpılır."""
    by: dict[str, list[tuple[float, float]]] = {}
    for d, o in olculen.items():
        sv = seri.get(d)
        if sv is not None:
            by.setdefault(f"{d.year}-{d.month:02d}", []).append((o, sv))
    out = []
    for ay, pairs in sorted(by.items()):
        o_t, s_t = sum(p[0] for p in pairs), sum(p[1] for p in pairs)
        oran = None if s_t <= 0 else o_t / s_t
        oneri = None
        if oran is not None and len(pairs) >= rule.yagis_olcer_min_gun and s_t >= rule.yagis_olcer_min_seri_mm and abs(oran - 1) >= rule.yagis_olcer_sapma_esigi:
            oneri = min(rule.yagis_olcer_oran_ust, max(rule.yagis_olcer_oran_alt, oran))
        out.append(AyYanlilik(ay, len(pairs), o_t, s_t, oran, oneri))
    return tuple(out)


async def gecmis_hava(session: AsyncSession, garden_id: uuid.UUID, cell_id: uuid.UUID, today: date, su_rule: SuKurali, plan_rule: SulamaPlaniKurali | None = None) -> GecmisHava:
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
    seri = dict(yagis)
    olculen = await _olculen(session, garden_id, today)
    for d, mm in olculen.items():  # bahçede ölçülen gün: kova ölçümü seriden ÖNCE kullanır
        yagis[d] = mm
    yan = yanlilik_hesapla(olculen, seri, plan_rule) if plan_rule is not None else ()
    return GecmisHava(yagis, et0, frozenset(r[0] for r in rows if r[3] != "era5_land" and r[0] <= today), kaynak, karar, olculen, seri, yan)


async def _olculen(session: AsyncSession, garden_id: uuid.UUID, today: date) -> dict[date, float]:
    """Saha Defteri «Yağış ölçümü» kayıtları (ayrinti.mm). Aynı gün birden çok kayıt varsa EN SON girilen sayılır (yinelenen ölçümü toplamak çift sayım olurdu)."""
    rows = (await session.execute(text("SELECT tarih, (ayrinti->>'mm')::float8 FROM field_records WHERE garden_id = :g AND tur = 'yagis' AND ayrinti->>'mm' IS NOT NULL AND tarih <= :t ORDER BY created_at"), {"g": garden_id, "t": today})).all()
    return {r[0]: float(r[1]) for r in rows if r[1] is not None}
