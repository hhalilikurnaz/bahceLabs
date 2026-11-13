"""Veri kontrolleri (9J-2): fiziksel aralık (SERT = imkânsız), ani sıçrama, tekrar eden satır, birim, eksik gün (YUMUŞAK = şüpheli). ŞÜPHELİ DEĞER SİLİNMEZ: `veri_bayrak`'a yazılır.
Kova kuralı (ADR 0030): SERT bayraklı yağış/ET₀ kovaya GİRMEZ (veri eksik gibi, `rain_series.gecmis_hava`); YUMUŞAK bayraklı değer kovaya GİRER ama bayrak güven servisine sayılır.
Saf kurallar birim testli; tarama (`tara_*`) yazımdan sonra ve günlük iş olarak koşar, idempotent (aynı bayrak ikinci kez yazılmaz)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Literal

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.domain.agro.catalog import IzlemeKurali, VeriKontrolKurali, load_catalog
from bahcelab_backend.shared.clock import today_istanbul

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


async def tara_era5(session: AsyncSession, since: datetime, bit: date | None = None, kural: IzlemeKurali | None = None) -> int:
    """ERA5: `since`'den beri DEĞİŞEN satırlar (tetikleyiciyle tutulan `guncelleme`): yeni yazılan günler VE eski tarihli satırın sonradan güncellenmesi (model → ERA5 kesinleşmesi).
    Taranan satırın eski bayrakları (aralık/sıçrama) önce silinir: değer düzeldiyse bayrak kalkar. Eksik gün: dokunulan hücrelerin son 60 günü."""
    k = (kural or load_catalog().izleme).kontroller
    bit = bit or today_istanbul()
    rows = (await session.execute(text(
        "WITH ch AS (SELECT cell_id, tarih FROM era5_daily WHERE guncelleme > :s) "
        "SELECT e.cell_id::text, e.tarih, e.yagis_mm, e.et0_mm, e.t_max, e.t_min, e.sm0, e.sm1, e.sm2, e.sm3, (e.guncelleme > :s) AS degisti FROM era5_daily e "
        "JOIN ch ON e.cell_id = ch.cell_id AND (e.tarih = ch.tarih OR e.tarih = ch.tarih - 1) GROUP BY e.cell_id, e.tarih, e.yagis_mm, e.et0_mm, e.t_max, e.t_min, e.sm0, e.sm1, e.sm2, e.sm3, e.guncelleme ORDER BY e.cell_id, e.tarih"), {"s": since})).all()
    yeni = 0
    onceki: dict[tuple[str, str], tuple[date, float | None]] = {}
    cells: set[str] = set()
    silinecek: set[tuple[str, date]] = set()
    for r in rows:
        if r[10]:
            silinecek.add((r[0], r[1]))
    for cell, t in silinecek:
        await session.execute(text("DELETE FROM veri_bayrak WHERE kaynak = 'era5' AND anahtar = :a AND tarih = :t AND kural IN ('aralik', 'sicrama')"), {"a": cell, "t": t})
    for r in rows:
        cell, t, degisti = r[0], r[1], r[10]
        cells.add(cell)
        for i, kol in enumerate(("yagis_mm", "et0_mm", "t_max", "t_min", "sm0", "sm1", "sm2", "sm3"), start=2):
            kk = k.get(ERA5_DEGISKEN[kol])
            if kk is None:
                continue
            v = None if r[i] is None else float(r[i])
            on = onceki.get((cell, kol))
            prev = on[1] if on and (t - on[0]).days == 1 else None
            if degisti:
                for b in kontrol_deger(ERA5_DEGISKEN[kol] if kol not in ("sm1", "sm2", "sm3") else kol, t, v, prev, kk):
                    yeni += await _yaz(session, "era5", cell, b)
            onceki[(cell, kol)] = (t, v)
    for cell in cells:
        gunler = {x[0] for x in (await session.execute(text("SELECT tarih FROM era5_daily WHERE cell_id = CAST(:c AS uuid) AND tarih BETWEEN :a AND :b"), {"c": cell, "a": bit - timedelta(days=60), "b": bit})).all()}
        for d in eksik_gunler(gunler, bit - timedelta(days=60), bit):
            yeni += await _yaz(session, "era5", cell, Bayrak("gun", d, None, "eksik_gun", "yumusak", "ERA5 günlük satırı yok (serinin ortasında)"))
    return yeni


async def tara_acquisitions(session: AsyncSession, since: datetime, kural: IzlemeKurali | None = None) -> int:
    """Sentinel-2 indeks istatistikleri (NDVI/NDMI) aralık denetimi (−1..1): `since`'den beri eklenen sahneler."""
    k = (kural or load_catalog().izleme).kontroller
    yeni = 0
    rows = (await session.execute(text("SELECT a.garden_id::text, a.tarih, s.indeks, s.ortalama FROM acquisitions a JOIN acquisition_stats s ON s.acquisition_id = a.id WHERE a.created_at > :s AND s.indeks IN ('ndvi','ndmi')"), {"s": since})).all()
    for g, t, idx, v in rows:
        for b in kontrol_deger(idx, t, None if v is None else float(v), None, k[idx]):
            yeni += await _yaz(session, "acquisition", g, b)
    return yeni


async def tara_gozlemler(session: AsyncSession, since: datetime, kural: IzlemeKurali | None = None) -> int:
    """İstasyon (Tmin/yağış), doğrulama gözlemleri (IMERG yağış, SMAP toprak nemi) ve WaPOR L1 bağlamı (ET mm/gün; NRT→final değişimi dahil): `since`'den beri değişenler."""
    k = (kural or load_catalog().izleme).kontroller
    yeni = 0
    for ist, t, tmin, prcp in (await session.execute(text("SELECT istasyon_id, tarih, tmin, prcp FROM station_daily WHERE guncelleme > :s"), {"s": since})).all():
        await session.execute(text("DELETE FROM veri_bayrak WHERE kaynak = 'station' AND anahtar = :a AND tarih = :t AND kural IN ('aralik','sicrama')"), {"a": str(ist), "t": t})
        for deg, v in (("t_min_c", tmin), ("yagis_mm", prcp)):
            for b in kontrol_deger(deg, t, None if v is None else float(v), None, k[deg]):
                yeni += await _yaz(session, "station", str(ist), b)
    for src, gid, t, v in (await session.execute(text("SELECT source_id, garden_id::text, tarih, deger FROM dogrulama_gozlem WHERE guncelleme > :s AND source_id IN ('imerg-daily','smap-l3')"), {"s": since})).all():
        kay = "imerg" if src == "imerg-daily" else "smap"
        await session.execute(text("DELETE FROM veri_bayrak WHERE kaynak = :k AND anahtar = :a AND tarih = :t AND kural IN ('aralik','sicrama')"), {"k": kay, "a": gid, "t": t})
        if v is not None:
            for b in kontrol_deger("yagis_mm" if kay == "imerg" else "toprak_nemi", t, float(v), None, k["yagis_mm" if kay == "imerg" else "toprak_nemi"]):
                yeni += await _yaz(session, kay, gid, b)
    for gid, bas, v in (await session.execute(text("SELECT garden_id::text, bas, et_mm_gun FROM eta_baglam WHERE guncelleme > :s"), {"s": since})).all():
        await session.execute(text("DELETE FROM veri_bayrak WHERE kaynak = 'wapor' AND anahtar = :a AND tarih = :t AND kural IN ('aralik','sicrama')"), {"a": gid, "t": bas})
        if v is not None and "et_mm" in k:
            for b in kontrol_deger("et_mm", bas, float(v), None, k["et_mm"]):
                yeni += await _yaz(session, "wapor", gid, b)
    return yeni


async def tara(session: AsyncSession, bugun: date | None = None, kural: IzlemeKurali | None = None) -> int:
    """Son taramadan beri değişen satırları tarar; tarama işaretçisi (`izleme_tarama`) taramanın BAŞLANGIÇ anına ilerler (eşzamanlı yazım kaçmaz). İlk koşuda son 30 gün."""
    # saat VERİTABANINDAN (tetikleyici de onun saatini kullanır): uygulama saatiyle karışmaz. İşaretçi 5 dk GERİ alınır: tarama sırasında işlemi henüz kesinleşmemiş yazımlar kaçmasın (tarama idempotent).
    bas_an = (await session.execute(text("SELECT clock_timestamp() - interval '5 minutes'"))).scalar_one()
    r = (await session.execute(text("SELECT son_tarama FROM izleme_tarama WHERE kaynak = 'veri'"))).scalar()
    since = r or (bas_an - timedelta(days=30))
    n = await tara_era5(session, since, bugun, kural) + await tara_acquisitions(session, since, kural) + await tara_gozlemler(session, since, kural)
    await session.execute(text("INSERT INTO izleme_tarama (kaynak, son_tarama) VALUES ('veri', :t) ON CONFLICT (kaynak) DO UPDATE SET son_tarama = EXCLUDED.son_tarama"), {"t": bas_an})
    return n


async def sert_bayrakli_gunler(session: AsyncSession, kaynak: str, anahtar: str, degiskenler: tuple[str, ...]) -> set[date]:
    """Kova kuralı: SERT bayraklı (imkânsız) günler — o gün o değişken kovaya girmez."""
    rows = (await session.execute(text("SELECT tarih FROM veri_bayrak WHERE kaynak = :k AND anahtar = :a AND siddet = 'sert' AND degisken = ANY(:d)"), {"k": kaynak, "a": anahtar, "d": list(degiskenler)})).all()
    return {r[0] for r in rows}
