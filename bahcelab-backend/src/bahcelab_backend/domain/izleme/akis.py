"""Akış tazeliği (9J-1): her kaynak için son veri günü, gecikme, boşluk günleri ve durum (taze / gecikmeli / kopuk). Beklenen sıklık ve kabul edilebilir gecikme KATALOGDA.
Kopuk ya da `uyari_ardisik_gun` gündür gecikmeli olunca iç uyarı (INTERNAL_EMAILS)."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any, Literal

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.domain.agro.catalog import AkisKurali, IzlemeKurali, load_catalog

logger = logging.getLogger(__name__)
Durum = Literal["taze", "gecikmeli", "kopuk", "bos"]

# kaynak → (son veri günü sorgusu, günlük seri için gün sorgusu (boşluk sayımı), feed_runs kaynak adı)
SORGULAR: dict[str, tuple[str, str | None, str | None]] = {
    "era5": ("SELECT max(tarih) FROM era5_daily WHERE hava_kaynak = 'era5_land'", "SELECT DISTINCT tarih FROM era5_daily WHERE hava_kaynak = 'era5_land' AND tarih >= :bas", "era5"),
    "openmeteo_tahmin": ("SELECT max(created_at)::date FROM weather_daily", None, None),
    "imerg": ("SELECT max(tarih) FROM dogrulama_gozlem WHERE source_id = 'imerg-daily'", "SELECT DISTINCT tarih FROM dogrulama_gozlem WHERE source_id = 'imerg-daily' AND tarih >= :bas", "imerg"),
    "meteostat": ("SELECT max(tarih) FROM station_daily", None, None),
    "sentinel2": ("SELECT max(tarih) FROM acquisitions WHERE source_id = 'sentinel2-l2a' AND durum = 'net'", None, None),
    "sentinel1": ("SELECT max(tarih) FROM acquisitions WHERE source_id = 'sentinel1-rtc' AND durum = 'net'", None, None),
    "landsat": ("SELECT max(tarih) FROM acquisitions WHERE source_id = 'landsat-c2-l2' AND durum = 'net'", None, None),
    "smap": ("SELECT max(tarih) FROM dogrulama_gozlem WHERE source_id = 'smap-l3'", "SELECT DISTINCT tarih FROM dogrulama_gozlem WHERE source_id = 'smap-l3' AND tarih >= :bas", "smap"),
    "wapor": ("SELECT max(bit) FROM eta_baglam", None, None),
    "ecostress": ("SELECT max(tarih) FROM eta_dogrulama", None, None),
}


@dataclass(frozen=True)
class AkisDurumu:
    akis: str
    ad: str
    durum: Durum
    son_veri: date | None
    gecikme_gun: float | None
    bosluk_gun: int | None
    son_basari: datetime | None
    beklenen_gun: float
    kabul_gecikme_gun: float
    kopuk_gun: float
    neden: str


def siniflandir(gecikme: float | None, k: AkisKurali) -> Durum:
    """Gecikme ≤ kabul → taze; ≤ kopuk → gecikmeli; aksi kopuk; veri hiç yoksa bos."""
    if gecikme is None:
        return "bos"
    return "taze" if gecikme <= k.kabul_gecikme_gun else "gecikmeli" if gecikme <= k.kopuk_gun else "kopuk"


def bosluk_say(gunler: set[date], bugun: date, pencere: int, son_veri: date | None) -> int:
    """Pencere içinde (bugünden geri), ilk ve son veri günü arasında EKSİK gün sayısı (veri bitiş gecikmesi boşluk sayılmaz)."""
    if not gunler or pencere <= 0:
        return 0
    bas = bugun - timedelta(days=pencere)
    ic = [g for g in gunler if g >= bas]
    if len(ic) < 2:
        return 0
    return sum(1 for i in range((max(ic) - min(ic)).days + 1) if min(ic) + timedelta(days=i) not in gunler)


async def tarife_durumu(kural: AkisKurali, bugun: date) -> tuple[date | None, str]:
    """Fiyat akışı: katalogda EPDK tarifesi (birim fiyat + geçerlilik başlangıcı) tanımlı mı; boşsa KOPUK («fiyat ve geçerlilik tarihi boş»: sayı uydurulmaz)."""
    t = load_catalog().sulama_plani.tarife
    if t.birim_fiyat_tl_kwh is None or t.gecerlilik_baslangic is None:
        return None, "tarife birim fiyatı ve geçerlilik tarihi katalogda boş (doğrulanamadı)"
    return t.gecerlilik_baslangic, f"tarife {t.birim_fiyat_tl_kwh} TL/kWh, geçerlilik {t.gecerlilik_baslangic}"


async def akis_durumlari(session: AsyncSession, bugun: date, kural: IzlemeKurali | None = None) -> list[AkisDurumu]:
    k = kural or load_catalog().izleme
    out: list[AkisDurumu] = []
    basarilar = {r[0]: r[1] for r in (await session.execute(text("SELECT kaynak, max(bitis) FROM feed_runs WHERE durum = 'tamam' GROUP BY kaynak"))).all()}
    for akis, ak in k.akislar.items():
        neden = ""
        son: date | None = None
        bosluk: int | None = None
        basari = None
        if akis == "tarife":
            son, neden = await tarife_durumu(ak, bugun)
        elif akis in SORGULAR:
            q, gun_q, fr = SORGULAR[akis]
            try:
                son = (await session.execute(text(q))).scalar()
                if gun_q and ak.bosluk_penceresi_gun:
                    gunler = {r[0] for r in (await session.execute(text(gun_q), {"bas": bugun - timedelta(days=ak.bosluk_penceresi_gun)})).all()}
                    bosluk = bosluk_say(gunler, bugun, ak.bosluk_penceresi_gun, son)
                basari = basarilar.get(fr) if fr else None
            except Exception as e:  # noqa: BLE001 - bir kaynağın sorgusu diğerlerini düşürmesin
                logger.warning("Akış durumu okunamadı (%s): %s", akis, str(e)[:100])
                neden = "sorgu hatası"
        gecikme = None if son is None else float((bugun - son).days)
        durum = siniflandir(gecikme, ak)
        if not neden:
            neden = {"taze": f"son veri {son} ({gecikme:.0f} gün önce)", "gecikmeli": f"son veri {son}: {gecikme:.0f} gün gecikmeli (kabul ≤ {ak.kabul_gecikme_gun:.0f})", "kopuk": f"son veri {son}: {gecikme:.0f} gün, kopuk (> {ak.kopuk_gun:.0f})", "bos": "hiç veri yok"}[durum] if gecikme is not None else "hiç veri yok"
        out.append(AkisDurumu(akis, ak.ad, durum, son, gecikme, bosluk, basari, ak.beklenen_gun, ak.kabul_gecikme_gun, ak.kopuk_gun, neden))
    return out


async def anlik_goruntu_yaz(session: AsyncSession, bugun: date, durumlar: list[AkisDurumu]) -> None:
    for d in durumlar:
        await session.execute(text("INSERT INTO izleme_akis (tarih, akis, durum, son_veri, gecikme_gun, bosluk_gun, son_basari, neden) VALUES (:t, :a, :d, :s, :g, :b, :sb, :n) ON CONFLICT (tarih, akis) DO UPDATE SET durum = EXCLUDED.durum, son_veri = EXCLUDED.son_veri, gecikme_gun = EXCLUDED.gecikme_gun, bosluk_gun = EXCLUDED.bosluk_gun, son_basari = EXCLUDED.son_basari, neden = EXCLUDED.neden"), {"t": bugun, "a": d.akis, "d": d.durum, "s": d.son_veri, "g": d.gecikme_gun, "b": d.bosluk_gun, "sb": d.son_basari, "n": d.neden})


async def uyari_gerektirenler(session: AsyncSession, bugun: date, kural: IzlemeKurali | None = None) -> list[tuple[str, str, str]]:
    """İç uyarı: KOPUK hemen; GECİKMELİ `uyari_ardisik_gun` ardışık günse. (akış, durum, ilk_gün) listesi."""
    k = kural or load_catalog().izleme
    out: list[tuple[str, str, str]] = []
    for akis in k.akislar:
        rows = (await session.execute(text("SELECT tarih, durum FROM izleme_akis WHERE akis = :a AND tarih <= :t ORDER BY tarih DESC LIMIT :n"), {"a": akis, "t": bugun, "n": k.uyari_ardisik_gun})).all()
        if not rows:
            continue
        if rows[0][1] == "kopuk":
            out.append((akis, "kopuk", str(rows[0][0])))
        elif len(rows) >= k.uyari_ardisik_gun and all(r[1] in ("gecikmeli", "kopuk") for r in rows) and (rows[0][0] - rows[-1][0]).days == len(rows) - 1:
            out.append((akis, "gecikmeli", str(rows[-1][0])))
    return out


def _tur(x: Any) -> Any:  # tür bütünlüğü
    return x
