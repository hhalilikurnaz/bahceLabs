"""Veri kontrolleri (9J-2): fiziksel aralık (SERT = imkânsız), ani sıçrama, tekrar eden satır, birim, eksik gün (YUMUŞAK = şüpheli). ŞÜPHELİ DEĞER SİLİNMEZ: `veri_bayrak`'a yazılır.
Kova kuralı (ADR 0030): SERT bayraklı yağış/ET₀ kovaya GİRMEZ (veri eksik gibi, `rain_series.gecmis_hava`); YUMUŞAK bayraklı değer kovaya GİRER ama bayrak güven servisine sayılır.
Saf kurallar birim testli; tarama (`tara_*`) yazımdan sonra ve günlük iş olarak koşar, idempotent (aynı bayrak ikinci kez yazılmaz)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Literal

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.domain.agro.catalog import IzlemeKurali, VeriKontrolKurali, load_catalog

Siddet = Literal["sert", "yumusak"]


@dataclass(frozen=True)
class Bayrak:
    degisken: str
    tarih: date
    deger: float | None
    kural: str
    siddet: Siddet
    ayrinti: str


def kontrol_deger(degisken: str, tarih: date, deger: float | None, onceki: float | None, k: VeriKontrolKurali) -> list[Bayrak]:
    """Tek değer için bayraklar: aralık (sert; Kelvin/yanlış birim ipucu dahil), sıçrama (yumuşak)."""
    if deger is None:
        return []
    out: list[Bayrak] = []
    if (k.min is not None and deger < k.min) or (k.max is not None and deger > k.max):
        ipucu = " (Kelvin/yanlış birim olabilir)" if degisken.startswith("t_") and deger > 150 else ""
        out.append(Bayrak(degisken, tarih, deger, "aralik", "sert", f"{deger:g} {k.birim} aralık dışı [{k.min}, {k.max}]{ipucu}"))
    if k.sicrama is not None and onceki is not None and abs(deger - onceki) > k.sicrama:
        out.append(Bayrak(degisken, tarih, deger, "sicrama", "yumusak", f"önceki güne göre {deger - onceki:+g} {k.birim} (> {k.sicrama:g})"))
    return out


def eksik_gunler(gunler: set[date], bas: date, bit: date) -> list[date]:
    """[bas, bit] içinde veri günü olmayan günler (ilk ile son veri günü arasında; uçlar boşluk sayılmaz)."""
    ic = sorted(g for g in gunler if bas <= g <= bit)
    if len(ic) < 2:
        return []
    return [ic[0] + timedelta(days=i) for i in range((ic[-1] - ic[0]).days + 1) if ic[0] + timedelta(days=i) not in gunler]


async def _yaz(session: AsyncSession, kaynak: str, anahtar: str, b: Bayrak) -> int:
    r = await session.execute(text("INSERT INTO veri_bayrak (kaynak, anahtar, tarih, degisken, deger, kural, siddet, ayrinti) VALUES (:k, :a, :t, :d, :v, :r, :s, :y) ON CONFLICT ON CONSTRAINT uq_veri_bayrak DO NOTHING"), {"k": kaynak, "a": anahtar, "t": b.tarih, "d": b.degisken, "v": b.deger, "r": b.kural, "s": b.siddet, "y": b.ayrinti})
    return int(getattr(r, "rowcount", 0) or 0)


ERA5_DEGISKEN = {"yagis_mm": "yagis_mm", "et0_mm": "et0_mm", "t_max": "t_max_c", "t_min": "t_min_c", "sm0": "toprak_nemi", "sm1": "toprak_nemi", "sm2": "toprak_nemi", "sm3": "toprak_nemi"}


async def tara_era5(session: AsyncSession, bas: date, bit: date, kural: IzlemeKurali | None = None) -> int:
    """ERA5 günlük satırları: aralık/sıçrama/eksik gün. Önceki gün karşılaştırması için bir gün öncesinden okunur."""
    k = (kural or load_catalog().izleme).kontroller
    rows = (await session.execute(text("SELECT cell_id::text, tarih, yagis_mm, et0_mm, t_max, t_min, sm0, sm1, sm2, sm3 FROM era5_daily WHERE tarih BETWEEN :b AND :e ORDER BY cell_id, tarih"), {"b": bas - timedelta(days=1), "e": bit})).all()
    yeni = 0
    onceki: dict[tuple[str, str], tuple[date, float | None]] = {}
    gunler: dict[str, set[date]] = {}
    for r in rows:
        cell, t = r[0], r[1]
        gunler.setdefault(cell, set()).add(t)
        for i, kol in enumerate(("yagis_mm", "et0_mm", "t_max", "t_min", "sm0", "sm1", "sm2", "sm3"), start=2):
            kk = k.get(ERA5_DEGISKEN[kol])
            if kk is None:
                continue
            v = None if r[i] is None else float(r[i])
            on = onceki.get((cell, kol))
            prev = on[1] if on and (t - on[0]).days == 1 else None
            if t >= bas:
                for b in kontrol_deger(ERA5_DEGISKEN[kol] if kol not in ("sm1", "sm2", "sm3") else kol, t, v, prev, kk):
                    yeni += await _yaz(session, "era5", cell, b)
            onceki[(cell, kol)] = (t, v)
    for cell, g in gunler.items():
        for d in eksik_gunler(g, bas, bit):
            yeni += await _yaz(session, "era5", cell, Bayrak("gun", d, None, "eksik_gun", "yumusak", "ERA5 günlük satırı yok (serinin ortasında)"))
    return yeni


async def tara_acquisitions(session: AsyncSession, bas: date, bit: date, kural: IzlemeKurali | None = None) -> int:
    """Sentinel-2 indeks istatistikleri (NDVI/NDMI) aralık denetimi (−1..1)."""
    k = (kural or load_catalog().izleme).kontroller
    yeni = 0
    rows = (await session.execute(text("SELECT a.garden_id::text, a.tarih, s.indeks, s.ortalama FROM acquisitions a JOIN acquisition_stats s ON s.acquisition_id = a.id WHERE a.tarih BETWEEN :b AND :e AND s.indeks IN ('ndvi','ndmi')"), {"b": bas, "e": bit})).all()
    for g, t, idx, v in rows:
        for b in kontrol_deger(idx, t, None if v is None else float(v), None, k[idx]):
            yeni += await _yaz(session, "acquisition", g, b)
    return yeni


async def tara_gozlemler(session: AsyncSession, bas: date, bit: date, kural: IzlemeKurali | None = None) -> int:
    """İstasyon (Tmin) ve doğrulama gözlemleri (IMERG yağış, SMAP toprak nemi) aralık denetimi."""
    k = (kural or load_catalog().izleme).kontroller
    yeni = 0
    for ist, t, tmin, prcp in (await session.execute(text("SELECT istasyon_id, tarih, tmin, prcp FROM station_daily WHERE tarih BETWEEN :b AND :e"), {"b": bas, "e": bit})).all():
        for deg, v in (("t_min_c", tmin), ("yagis_mm", prcp)):
            for b in kontrol_deger(deg, t, None if v is None else float(v), None, k[deg]):
                yeni += await _yaz(session, "station", str(ist), b)
    for src, gid, t, v in (await session.execute(text("SELECT source_id, garden_id::text, tarih, deger FROM dogrulama_gozlem WHERE tarih BETWEEN :b AND :e AND source_id IN ('imerg-daily','smap-l3') AND deger IS NOT NULL"), {"b": bas, "e": bit})).all():
        deg = "yagis_mm" if src == "imerg-daily" else "toprak_nemi"
        for b in kontrol_deger(deg, t, float(v), None, k[deg]):
            yeni += await _yaz(session, "imerg" if src == "imerg-daily" else "smap", gid, b)
    return yeni


async def tara(session: AsyncSession, bas: date, bit: date) -> int:
    return await tara_era5(session, bas, bit) + await tara_acquisitions(session, bas, bit) + await tara_gozlemler(session, bas, bit)


async def sert_bayrakli_gunler(session: AsyncSession, kaynak: str, anahtar: str, degiskenler: tuple[str, ...]) -> set[date]:
    """Kova kuralı: SERT bayraklı (imkânsız) günler — o gün o değişken kovaya girmez."""
    rows = (await session.execute(text("SELECT tarih FROM veri_bayrak WHERE kaynak = :k AND anahtar = :a AND siddet = 'sert' AND degisken = ANY(:d)"), {"k": kaynak, "a": anahtar, "d": list(degiskenler)})).all()
    return {r[0] for r in rows}
