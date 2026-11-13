"""TEK GÜVEN SERVİSİ (9J-5, ADR 0030): bahçe panellerinde «Güven: orta (3/5)» artık burada hesaplanır; her ekran aynı sonucu ve aynı «nasıl hesaplandı» metnini alır.

Koşullar (her biri sağlandı / sağlanmadı / ölçülemiyor): uydu görüntüsü taze · hava verisi güncel · akışlar kopuk değil · geçici (kesinleşmemiş) gün sayısı az ·
profil/beyan eksiksiz · kaynaklar uyumlu (drift yok) · ölçüm bayrağı (şüpheli veri) yok · kural geri bildirimi (işaret isabeti). «Ölçülemiyor» koşul payda DIŞIDIR.
Etiket = sağlanan / ölçülebilen oranı: ≥ `guven_yuksek_oran` yüksek, ≥ `guven_orta_oran` orta, aksi düşük (katalog `izleme`).
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Literal

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.domain.agro.catalog import IzlemeKurali, load_catalog
from bahcelab_backend.domain.water.era5_sync import garden_cell

Etiket = Literal["yuksek", "orta", "dusuk"]
Baglam = Literal["sulama", "durum"]


@dataclass(frozen=True)
class Kosul:
    ad: str
    ok: bool | None  # None: ölçülemiyor (payda dışı)
    ek: str | None = None


@dataclass(frozen=True)
class GuvenSonuc:
    etiket: Etiket
    puan: int
    toplam: int
    kosullar: list[Kosul] = field(default_factory=list)
    nasil: str = ""
    nedeni: str = ""


def etiketle(puan: int, toplam: int, k: IzlemeKurali) -> Etiket:
    if toplam == 0:
        return "dusuk"
    oran = puan / toplam
    return "yuksek" if oran >= k.guven_yuksek_oran else "orta" if oran >= k.guven_orta_oran else "dusuk"


def olustur(kosullar: list[Kosul], k: IzlemeKurali) -> GuvenSonuc:
    olculen = [c for c in kosullar if c.ok is not None]
    puan = sum(1 for c in olculen if c.ok)
    et = etiketle(puan, len(olculen), k)
    olculemedi = len(kosullar) - len(olculen)
    yetersiz = len(olculen) < k.guven_min_olculen
    if yetersiz and et == "yuksek":
        et = "orta"  # yeterince koşul ölçülemediyse «yüksek» iddia edilmez
    eksik = [c.ad for c in olculen if not c.ok]
    nasil = (f"Güven = sağlanan koşul / ölçülebilen koşul; ≥ %{k.guven_yuksek_oran * 100:.0f} yüksek, ≥ %{k.guven_orta_oran * 100:.0f} orta, altı düşük. «Ölçülemiyor» koşullar paydaya girmez (uydurulmaz). "
             "Koşullar: uydu görüntüsü taze, hava verisi güncel, veri akışları kopuk değil, geçici gün sayısı az, beyan/profil eksiksiz, kaynaklar uyumlu, şüpheli ölçüm yok, kural geri bildirimi olumlu. Eşikler ön değerdir.")  # TÜM ekranlarda AYNI metin (sayılar `nedeni`nde)
    nedeni = f"{puan}/{len(olculen)} koşul sağlanıyor" + (f"; eksik: {', '.join(eksik)}" if eksik else "") + (f"; {olculemedi} koşul ölçülemedi" if olculemedi else "") + (f" (en az {k.guven_min_olculen} koşul ölçülmeden güven en çok «orta»)" if yetersiz else "") + "."
    if yetersiz:
        nasil += f" Bu bahçede yalnız {len(olculen)} koşul ölçülebildi ({olculemedi} koşul ölçülemedi); en az {k.guven_min_olculen} koşul ölçülmeden güven en çok «orta» olur."
    return GuvenSonuc(et, puan, len(olculen), kosullar, nasil, nedeni)


async def topla(session: AsyncSession, garden_id: uuid.UUID, bugun: date, baglam: Baglam, *, ndvi_tarih: date | None = None, agac_beyan: bool = True, profil_tam: bool | None = None, ek: list[Kosul] | None = None, kural: IzlemeKurali | None = None) -> GuvenSonuc:
    """Girdileri veritabanından toplar. `ndvi_tarih`: çağıranın bildiği son net görüntü (yoksa sorgulanır); `profil_tam`: sulama bağlamında profil/pompa/damlatıcı eksiksiz mi (None: ilgisiz)."""
    k = kural or load_catalog().izleme
    kos: list[Kosul] = []
    # 1) bulutsuz sahne yaşı
    if ndvi_tarih is None:
        ndvi_tarih = (await session.execute(text("SELECT max(tarih) FROM acquisitions WHERE garden_id = :g AND source_id = 'sentinel2-l2a' AND durum = 'net' AND tarih <= :b"), {"g": garden_id, "b": bugun})).scalar()
    yas = None if ndvi_tarih is None else (bugun - ndvi_tarih).days
    kos.append(Kosul("Uydu görüntüsü taze", False if yas is None else yas <= k.guven_ndvi_taze_gun, None if yas is None else f"son net görüntü {ndvi_tarih:%d.%m.%Y} ({yas} gün önce)"))
    # 2) hava verisi güncel (model/tahmin günleri dahil)
    cell, _, _ = await garden_cell(session, garden_id)
    son_hava = (await session.execute(text("SELECT max(tarih) FROM era5_daily WHERE cell_id = :c AND tarih <= :b AND yagis_mm IS NOT NULL"), {"c": cell, "b": bugun})).scalar()
    kos.append(Kosul("Hava verisi güncel", son_hava is not None and (bugun - son_hava).days <= k.guven_hava_taze_gun, None if son_hava is None else f"son gün {son_hava:%d.%m.%Y}"))
    # 3) bu bahçeyi besleyen akışlar kopuk değil (bahçeye/hücreye özgü; küresel tablolardan bağımsız → deterministik): ERA5 hücresi, bahçenin Sentinel-2'si, hava tahmini
    kopuk: list[str] = []
    olculen = 0
    era5_kural, s2_kural, tahmin_kural = k.akislar["era5"], k.akislar["sentinel2"], k.akislar["openmeteo_tahmin"]
    kesin = (await session.execute(text("SELECT max(tarih) FROM era5_daily WHERE cell_id = :c AND hava_kaynak = 'era5_land' AND tarih <= :b"), {"c": cell, "b": bugun})).scalar()
    if kesin is not None:
        olculen += 1
        if (bugun - kesin).days > era5_kural.kopuk_gun:
            kopuk.append(era5_kural.ad)
    if ndvi_tarih is not None:
        olculen += 1
        if (bugun - ndvi_tarih).days > s2_kural.kopuk_gun:
            kopuk.append(s2_kural.ad)
    tz = (await session.execute(text("SELECT tahmin_zamani FROM weather_cells WHERE id = :c"), {"c": cell})).scalar()
    if tz is not None:
        olculen += 1
        if (bugun - tz.date()).days > tahmin_kural.kopuk_gun:
            kopuk.append(tahmin_kural.ad)
    kos.append(Kosul("Veri akışları kopuk değil", None if not olculen else not kopuk, None if not kopuk else "kopuk: " + ", ".join(kopuk)))
    # 4) geçici (kesinleşmemiş) gün sayısı
    if True:
        gec = int((await session.execute(text("SELECT count(*) FROM era5_daily WHERE cell_id = :c AND hava_kaynak <> 'era5_land' AND tarih BETWEEN :a AND :b"), {"c": cell, "a": bugun - timedelta(days=30), "b": bugun})).scalar() or 0)
        kos.append(Kosul("Geçici (kesinleşmemiş) gün sayısı az", gec <= k.guven_gecici_gun_en_cok, f"son 30 günde {gec} geçici gün (en çok {k.guven_gecici_gun_en_cok})"))
    # 5) profil / beyan
    kos.append(Kosul("Ağaç sayısı beyan edilmiş", agac_beyan))
    if baglam == "sulama" and profil_tam is not None:
        kos.append(Kosul("Sulama sistemi ve pompa bilgisi tam", profil_tam))
    # 6) kaynak uyumu (drift)
    dr = (await session.execute(text("SELECT kontrol FROM izleme_uyum WHERE (garden_id = :g OR garden_id IS NULL) AND durum = 'drift' AND tarih = (SELECT max(tarih) FROM izleme_uyum u2 WHERE u2.kontrol = izleme_uyum.kontrol AND (u2.garden_id IS NOT DISTINCT FROM izleme_uyum.garden_id))"), {"g": garden_id})).all()
    var = (await session.execute(text("SELECT count(*) FROM izleme_uyum WHERE (garden_id = :g OR garden_id IS NULL) AND durum <> 'yetersiz'"), {"g": garden_id})).scalar()
    kos.append(Kosul("Kaynaklar birbiriyle uyumlu", None if not var else not dr, None if not dr else "kayan sapma: " + ", ".join(r[0] for r in dr)))
    # 7) ölçüm bayrağı (sert) — son 30 gün
    if True:
        sert = int((await session.execute(text("SELECT count(*) FROM veri_bayrak WHERE kaynak = 'era5' AND anahtar = :c AND siddet = 'sert' AND tarih BETWEEN :a AND :b"), {"c": str(cell), "a": bugun - timedelta(days=30), "b": bugun})).scalar() or 0)
        kos.append(Kosul("Şüpheli (imkânsız) ölçüm yok", sert == 0, None if sert == 0 else f"son 30 günde {sert} imkânsız değer (kovaya girmedi)"))
    # 8) kural geri bildirimi (sistem kontrol işareti isabeti; yeterli yanıt yoksa ölçülemiyor)
    r = (await session.execute(text("SELECT count(*), count(*) FILTER (WHERE yanit IN ('damlatici_tikali','baska_sorun')) FROM sk_yanit WHERE garden_id = :g"), {"g": garden_id})).one()
    if baglam == "sulama":
        yeterli = r[0] >= k.kural_min_yanit
        kos.append(Kosul("Kural geri bildirimi olumlu", (r[1] / r[0] >= 0.4) if yeterli else None, f"{r[1]}/{r[0]} işaret isabetli" if yeterli else None))
    return olustur([*kos, *(ek or [])], k)


# Kullanıcıya TEK satır «Veri durumu»: yalnız veri tarafında bir şey bozuksa (aşağıdaki öncelik sırasıyla en ağır olan); hepsi yolundaysa None → ekranda hiçbir şey gösterilmez.
# Sebep UYDURULMAZ: ölçülen gerçek (son net görüntü tarihi, son hava günü, kopuk akış adı) söylenir; «bulutlu» gibi nedensellik yalnız bilindiğinde eklenir.
_VERI_DURUMU: list[tuple[str, str, str]] = [  # (koşul, ölçüldüğünde başlık, ölçü yokken başlık)
    ("Uydu görüntüsü taze", "Uydu görüntüsü eski", "Bu bahçe için henüz net uydu görüntüsü yok"),
    ("Hava verisi güncel", "Hava verisi gecikmeli", "Bu bahçe için hava verisi henüz yok"),
    ("Veri akışları kopuk değil", "Veri akışı kesik", "Veri akışı kesik"),
    ("Şüpheli (imkânsız) ölçüm yok", "Şüpheli ölçüm ayıklandı", "Şüpheli ölçüm ayıklandı"),
]


def veri_durumu(g: GuvenSonuc) -> str | None:
    by = {c.ad: c for c in g.kosullar}
    for ad, baslik, yok in _VERI_DURUMU:
        c = by.get(ad)
        if c is not None and c.ok is False:
            return f"{baslik} — {c.ek}" if c.ek else yok
    return None
