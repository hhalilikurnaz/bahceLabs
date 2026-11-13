"""Kaynaklar arası tutarlılık (9J-3, haftalık): iki kaynağın aynı büyüklüğü ölçmesindeki KAYAN sapma (drift). Her kontrol bir seri üretir (`izleme_uyum`), eşik aşılırsa iç uyarı.

  era5_meteostat_tmax — ERA5 Tmax ↔ Meteostat gözlemi: son pencere ortalama sapması ↔ 1A'daki taban sapma (+4–5 °C düzeltmesi zamanla kayıyor mu); eşik °C
  era5_imerg_aylik    — ERA5 ↔ IMERG aylık yağış oranı: son aylar ↔ geçmiş medyan; eşik göreli
  olcer_era5          — bahçe yağmur ölçeri (Saha Defteri) ↔ ERA5 aylık oran
  etc_wapor           — model ETc ↔ WaPOR L1 dekad (bağlam) oranı
Yeterli veri yoksa durum «yetersiz» (drift uydurulmaz).
"""

from __future__ import annotations

import json
import statistics
import uuid
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Literal

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.domain.agro.catalog import IzlemeKurali, load_catalog
from bahcelab_backend.domain.water.era5_sync import garden_cell

Durum = Literal["uyumlu", "drift", "yetersiz"]


@dataclass(frozen=True)
class UyumSonuc:
    kontrol: str
    garden_id: uuid.UUID | None
    deger: float | None
    taban: float | None
    sapma: float | None
    esik: float
    n: int
    durum: Durum
    ayrinti: dict[str, object]


def mutlak_kayma(son: list[float], taban: float | None, esik: float, min_n: int) -> tuple[float | None, float | None, Durum]:
    """Sıcaklık gibi toplamsal büyüklük: son pencere ortalaması ↔ taban; |fark| > esik → drift."""
    if taban is None or len(son) < min_n:
        return None, None, "yetersiz"
    d = statistics.fmean(son)
    return d, d - taban, "drift" if abs(d - taban) > esik else "uyumlu"


def oransal_kayma(seri: list[float], son_n: int, esik: float, min_taban: int = 3) -> tuple[float | None, float | None, float | None, Durum]:
    """Oran serisi (eski → yeni): son `son_n` değerin medyanı ↔ öncekilerin medyanı; göreli sapma |son/taban − 1| > esik → drift. Döner: (son, taban, göreli sapma, durum)."""
    if len(seri) < son_n + min_taban:
        return None, None, None, "yetersiz"
    son = statistics.median(seri[-son_n:])
    taban = statistics.median(seri[:-son_n][-12:])
    if taban == 0:
        return son, taban, None, "yetersiz"
    g = son / taban - 1
    return son, taban, g, "drift" if abs(g) > esik else "uyumlu"


async def era5_imerg_aylik(session: AsyncSession, garden_id: uuid.UUID, bugun: date, k: IzlemeKurali) -> UyumSonuc:
    """Bahçenin ERA5 hücresi ↔ IMERG günlük yağış: ortak günlerde aylık oran (ERA5/IMERG); en az 10 ortak yağış-günü/ay ya da toplam ≥ 5 mm."""
    cell, _, _ = await garden_cell(session, garden_id)
    rows = (await session.execute(text(
        "SELECT date_trunc('month', i.tarih)::date AS ay, sum(e.yagis_mm), sum(i.deger), count(*) FROM dogrulama_gozlem i "
        "JOIN era5_daily e ON e.cell_id = :c AND e.tarih = i.tarih "
        "WHERE i.garden_id = :g AND i.source_id = 'imerg-daily' AND i.deger IS NOT NULL AND e.yagis_mm IS NOT NULL AND e.hava_kaynak = 'era5_land' AND i.tarih < :b GROUP BY 1 ORDER BY 1"), {"g": garden_id, "c": cell, "b": date(bugun.year, bugun.month, 1)})).all()
    oranlar = [float(e) / float(i) for _, e, i, n in rows if i and float(i) >= 5.0 and n >= k.drift_min_gun]
    son, taban, g, durum = oransal_kayma(oranlar, 3, k.drift_yagis_oran)
    return UyumSonuc("era5_imerg_aylik", garden_id, son, taban, g, k.drift_yagis_oran, len(oranlar), durum, {"aylik_oran": oranlar[-12:]})


async def olcer_era5(session: AsyncSession, garden_id: uuid.UUID, bugun: date, k: IzlemeKurali) -> UyumSonuc:
    """Yağmur ölçeri kayıtları (Saha Defteri `yagis`, aynı gün en son kayıt) ↔ ERA5 aynı gün: aylık oran (ölçer/ERA5), en az 5 ortak gün ve ≥ 5 mm toplam."""
    cell, _, _ = await garden_cell(session, garden_id)
    rows = (await session.execute(text(
        "SELECT date_trunc('month', f.tarih)::date, sum(f.mm), sum(e.yagis_mm), count(*) FROM (SELECT DISTINCT ON (garden_id, tarih) garden_id, tarih, (ayrinti->>'mm')::float AS mm FROM field_records WHERE garden_id = :g AND tur = 'yagis' ORDER BY garden_id, tarih, created_at DESC) f "
        "JOIN era5_daily e ON e.cell_id = :c AND e.tarih = f.tarih WHERE e.yagis_mm IS NOT NULL AND f.tarih < :b GROUP BY 1 ORDER BY 1"), {"g": garden_id, "c": cell, "b": bugun})).all()
    oranlar = [float(o) / float(e) for _, o, e, n in rows if e and float(e) >= 5.0 and n >= 5]
    son, taban, g, durum = oransal_kayma(oranlar, 2, k.drift_yagis_olcer_oran, 2)
    return UyumSonuc("olcer_era5", garden_id, son, taban, g, k.drift_yagis_olcer_oran, len(oranlar), durum, {"aylik_oran": oranlar[-12:]})


async def etc_wapor(session: AsyncSession, garden_id: uuid.UUID, dekad_etc: dict[date, float], k: IzlemeKurali) -> UyumSonuc:
    """Model ETc (dekad ortalaması, mm/gün; çağıran sulama simülasyonundan verir) ↔ WaPOR L1 bağlam serisi: oran (WaPOR/ETc)."""
    rows = (await session.execute(text("SELECT bas, et_mm_gun FROM eta_baglam WHERE garden_id = :g AND et_mm_gun IS NOT NULL ORDER BY bas"), {"g": garden_id})).all()
    oranlar = [float(w) / dekad_etc[b] for b, w in rows if b in dekad_etc and dekad_etc[b] > 0.2]
    son, taban, g, durum = oransal_kayma(oranlar, 3, k.drift_etc_wapor_oran, 6)
    return UyumSonuc("etc_wapor", garden_id, son, taban, g, k.drift_etc_wapor_oran, len(oranlar), durum, {"dekad_orani": oranlar[-12:]})


async def era5_meteostat_tmax(session: AsyncSession, garden_id: uuid.UUID, son_sapma: list[float], k: IzlemeKurali) -> UyumSonuc:
    """Son pencere (çağıran Open-Meteo ERA5 ↔ Meteostat 17340'tan günlük sapmaları verir: gözlem − ERA5, °C) ↔ 1A taban sapma (`eta_kalibrasyon.ta_sapma` aylık ortalaması)."""
    taban_r = (await session.execute(text("SELECT avg(deger), count(*) FROM eta_kalibrasyon WHERE garden_id = :g AND tur = 'ta_sapma' AND deger IS NOT NULL"), {"g": garden_id})).one()
    taban = None if not taban_r[1] else float(taban_r[0])
    d, sapma, durum = mutlak_kayma(son_sapma, taban, k.drift_ta_c, k.drift_min_gun)
    return UyumSonuc("era5_meteostat_tmax", garden_id, d, taban, sapma, k.drift_ta_c, len(son_sapma), durum, {})


async def yaz(session: AsyncSession, bugun: date, s: UyumSonuc) -> None:
    await session.execute(text("DELETE FROM izleme_uyum WHERE tarih = :t AND kontrol = :k AND garden_id IS NOT DISTINCT FROM :g"), {"t": bugun, "k": s.kontrol, "g": s.garden_id})
    await session.execute(text("INSERT INTO izleme_uyum (tarih, kontrol, garden_id, deger, taban, sapma, esik, n, durum, ayrinti) VALUES (:t, :k, :g, :d, :b, :s, :e, :n, :du, CAST(:a AS jsonb))"), {"t": bugun, "k": s.kontrol, "g": s.garden_id, "d": s.deger, "b": s.taban, "s": s.sapma, "e": s.esik, "n": s.n, "du": s.durum, "a": json.dumps(s.ayrinti)})


def _tur(_: timedelta) -> None:  # tür bütünlüğü
    return None


def varsayilan_kural() -> IzlemeKurali:
    return load_catalog().izleme
