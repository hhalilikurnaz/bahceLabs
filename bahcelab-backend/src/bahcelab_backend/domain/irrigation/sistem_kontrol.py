"""Vana bazında «sulama sistemi kontrol» işareti — SAF kural (ADR 0029; veritabanı/ağ yok, birim testli).

Girdi: vananın (yoksa bahçenin) Sentinel-2 NDMI gözlemleri (bulutsuz), her gözlemin fenolojik evresi ve sezonu, o günlerin kova durumu.
Taban: AYNI fenolojik evrede, ÖNCEKİ sezonlardaki gözlemler (en az `min_sezon` farklı sezon ve `min_taban_sahne` sahne; yoksa işaret üretilmez, nedeni yazılır).
Kural: kova «yeterli/dolu» (Ks = 1) iken ardışık `art_arda_sahne` bulutsuz sahnede z ≤ `z_esik` → «V2'de sulama sistemini kontrol edin».
Karşılaştırma: aynı tarihlerde diğer vanalardan yalnız biri düşüyorsa güven YÜKSEK; vanaların `hepsi_dusuyor_orani`'ı düşüyorsa (hava/fenoloji) işaret ÜRETİLMEZ — ANCAK komşu halka (bahçe sınırından 100–300 m ağaçlık) normalse işaret üretilir;
karşılaştırılacak vana yoksa (tek sektör) işaret YALNIZ komşu halka normalken üretilir (güven ORTA-YÜKSEK). Halka da düşüyorsa ya da referansı yoksa (≥ 30 ağaçlık piksel / taban) işaret yok, nedeni yazılır.
Çok vanalı bahçede vana-arası kural aynen geçerlidir; halka ek kontrol olarak güveni yükseltir (orta → orta-yüksek).
Kova zaten eşik altındaysa bu işaret değildir: normal stres mesajı geçerlidir.
"""

from __future__ import annotations

import statistics
from dataclasses import dataclass, field
from datetime import date
from typing import Literal

from bahcelab_backend.domain.agro.catalog import SistemKontrolKurali


@dataclass(frozen=True)
class Gozlem:
    tarih: date
    ndmi: float
    sezon: int  # sezon başlangıç yılı (Ekim başlangıçlı)
    evre: str | None  # fenolojik evre kodu; yoksa None
    gecerli_oran: float = 1.0
    piksel: int = 0


@dataclass(frozen=True)
class HalkaSatir:
    """Komşu halkanın bir sahnedeki ölçümü; ndmi None ise geçerli ağaçlık piksel eşiğin altındaydı (referans yok)."""

    tarih: date
    ndmi: float | None
    piksel: int
    sezon: int
    evre: str | None


@dataclass(frozen=True)
class HalkaKarar:
    durum: Literal["normal", "dusuk", "yok"]
    neden: str
    z: tuple[float, ...] = ()
    piksel: tuple[int, ...] = ()


@dataclass(frozen=True)
class Taban:
    ort: float
    std: float
    n: int
    sezon_sayisi: int
    evre: str


@dataclass(frozen=True)
class SahneZ:
    tarih: date
    ndmi: float
    z: float
    kova_ok: bool


@dataclass(frozen=True)
class Karar:
    durum: Literal["isaret", "yok"]
    neden: str  # «yok» ise NEDEN (kullanıcıya/iç ekrana yazılır); «isaret» ise tek cümle gerekçe
    sahneler: tuple[SahneZ, ...] = ()
    taban: Taban | None = None
    guven: Literal["yuksek", "orta_yuksek", "orta"] | None = None
    karsilastirma: str | None = None
    diger_z: dict[str, float] = field(default_factory=dict)
    halka: HalkaKarar | None = None


def taban_hesapla(gecmis: list[Gozlem], hedef: Gozlem, kural: SistemKontrolKurali) -> tuple[Taban | None, str | None]:
    """Hedef sahnenin evresi için önceki sezonların tabanı; yetersizse (None, neden)."""
    if hedef.evre is None:
        return None, "fenolojik evre bilinmiyor (ürün/çeşit kuralı yok)"
    uygun = [g for g in gecmis if g.evre == hedef.evre and g.sezon < hedef.sezon and g.gecerli_oran >= kural.min_gecerli_oran]
    sezonlar = {g.sezon for g in uygun}
    if len(sezonlar) < kural.min_sezon:
        return None, f"taban yok: {hedef.evre} evresinde {len(sezonlar)} önceki sezon var, en az {kural.min_sezon} gerekir"
    if len(uygun) < kural.min_taban_sahne:
        return None, f"taban yok: {hedef.evre} evresinde {len(uygun)} önceki sahne var, en az {kural.min_taban_sahne} gerekir"
    v = [g.ndmi for g in uygun]
    return Taban(statistics.fmean(v), max(statistics.pstdev(v), kural.std_taban), len(v), len(sezonlar), hedef.evre), None


def z_skor(ndmi: float, taban: Taban) -> float:
    return (ndmi - taban.ort) / taban.std


def _son_temiz(seri: list[Gozlem], bugun: date, kural: SistemKontrolKurali) -> list[Gozlem]:
    """Bugüne kadarki bulutsuz (≥ min_gecerli_oran) sahneler, en yeni sonda."""
    return sorted((g for g in seri if g.tarih <= bugun and g.gecerli_oran >= kural.min_gecerli_oran and g.piksel >= kural.min_piksel), key=lambda g: g.tarih)


def vana_z(seri: list[Gozlem], bugun: date, kural: SistemKontrolKurali, kova_ok: dict[date, bool] | None = None) -> tuple[list[SahneZ], Taban | None, str | None]:
    """Son `art_arda_sahne` bulutsuz sahnenin z-skorları (taban son sahnenin evresinden). Tüm tabanlar yalnız ÖNCEKİ sezonlardan (geleceğe bakmaz)."""
    temiz = _son_temiz(seri, bugun, kural)
    if len(temiz) < kural.art_arda_sahne:
        return [], None, f"yetersiz bulutsuz sahne: {len(temiz)} < {kural.art_arda_sahne}"
    son = temiz[-kural.art_arda_sahne :]
    if (son[-1].tarih - son[0].tarih).days > kural.max_gun_arasi * (kural.art_arda_sahne - 1):
        return [], None, f"son bulutsuz sahneler {(son[-1].tarih - son[0].tarih).days} gün arayla (en çok {kural.max_gun_arasi * (kural.art_arda_sahne - 1)})"
    out: list[SahneZ] = []
    taban0: Taban | None = None
    for g in son:
        taban, neden = taban_hesapla(temiz, g, kural)
        if taban is None:
            return [], None, neden
        taban0 = taban0 or taban
        out.append(SahneZ(g.tarih, g.ndmi, z_skor(g.ndmi, taban), (kova_ok or {}).get(g.tarih, False)))
    return out, taban0, None


def z_tarihlerde(seri: list[Gozlem], tarihler: list[date], kural: SistemKontrolKurali) -> list[float]:
    """Verilen tarihlerdeki sahneler için z (taban yine önceki sezonlardan); o tarihte temiz sahne ya da taban yoksa o tarih atlanır."""
    temiz = sorted((g for g in seri if g.gecerli_oran >= kural.min_gecerli_oran and g.piksel >= kural.min_piksel), key=lambda g: g.tarih)
    out: list[float] = []
    for t in tarihler:
        g = next((x for x in temiz if x.tarih == t), None)
        if g is None:
            continue
        taban, _ = taban_hesapla(temiz, g, kural)
        if taban is not None:
            out.append(z_skor(g.ndmi, taban))
    return out


def halka_degerlendir(halka: list[HalkaSatir] | None, tarihler: list[date], kural: SistemKontrolKurali) -> HalkaKarar:
    """Halkanın aynı sahnelerdeki z-skoru (taban: halkanın KENDİ önceki sezonları, aynı evre). Her sahnede referans gerekir; eksikse nedeniyle `yok`."""
    if not halka:
        return HalkaKarar("yok", "komşu halka referansı hesaplanmamış")
    by = {h.tarih: h for h in halka}
    gec = [Gozlem(h.tarih, h.ndmi, h.sezon, h.evre, 1.0, h.piksel) for h in halka if h.ndmi is not None]
    zler: list[float] = []
    pik: list[int] = []
    for t in tarihler:
        h = by.get(t)
        if h is None:
            return HalkaKarar("yok", f"komşu halka {t:%d.%m.%Y} sahnesinde ölçülmemiş")
        if h.ndmi is None:
            return HalkaKarar("yok", f"komşu halkada {t:%d.%m.%Y} sahnesinde {h.piksel} geçerli ağaçlık piksel var, en az {kural.halka_min_piksel} gerekir")
        g = next(x for x in gec if x.tarih == t)
        taban, neden = taban_hesapla(gec, g, kural)
        if taban is None:
            return HalkaKarar("yok", f"komşu halka {neden}")
        zler.append(z_skor(g.ndmi, taban))
        pik.append(h.piksel)
    normal = all(z > kural.halka_z_normal for z in zler)
    z_metin = ", ".join(f"{z:.1f}" for z in zler)
    return HalkaKarar("normal" if normal else "dusuk", f"komşu halka z: {z_metin} (eşik > {kural.halka_z_normal})", tuple(zler), tuple(pik))


def degerlendir(ad: str, seri: list[Gozlem], digerleri: dict[str, list[Gozlem]], bugun: date, kural: SistemKontrolKurali, kova_ok: dict[date, bool], halka: list[HalkaSatir] | None = None) -> Karar:
    """Tek vana için karar. `digerleri`: öbür vanaların serileri (aynı tarihlerde karşılaştırma için)."""
    sahneler, taban, neden = vana_z(seri, bugun, kural, kova_ok)
    if not sahneler:
        return Karar("yok", neden or "veri yok")
    if not all(s.kova_ok for s in sahneler):
        return Karar("yok", "kova bu sahnelerde «yeterli/dolu» değil: normal stres mesajı geçerli (bu işaret değil)", tuple(sahneler), taban)
    if not all(s.z <= kural.z_esik for s in sahneler):
        return Karar("yok", f"NDMI normal aralıkta (son {len(sahneler)} sahne z: " + ", ".join(f"{s.z:.1f}" for s in sahneler) + f"; eşik {kural.z_esik})", tuple(sahneler), taban)
    # diğer vanalarla aynı tarihlerde karşılaştır
    diger_z: dict[str, float] = {}
    dusen = 0
    tarihler = [x.tarih for x in sahneler]
    for d_ad, d_seri in digerleri.items():
        zler = z_tarihlerde(d_seri, tarihler, kural)
        if not zler:
            continue  # aynı tarihlerde ölçümü/tabanı olmayan vana karşılaştırmaya girmez
        zort = statistics.fmean(zler)
        diger_z[d_ad] = zort
        if zort <= kural.z_esik:
            dusen += 1
    hepsi = bool(diger_z) and (dusen + 1) / (len(diger_z) + 1) >= kural.hepsi_dusuyor_orani and dusen >= 1
    tek = not diger_z
    hk = halka_degerlendir(halka, tarihler, kural)
    if tek or hepsi:
        sebep = "bahçe tek sektör" if tek else f"vanaların çoğu birlikte düşüyor ({dusen + 1}/{len(diger_z) + 1})"
        if hk.durum == "yok":
            return Karar("yok", f"{sebep}: ek kontrol olan komşu halka referansı yok — {hk.neden}; işaret üretilmedi", tuple(sahneler), taban, diger_z=diger_z, halka=hk)
        if hk.durum == "dusuk":
            return Karar("yok", f"{sebep}; komşu halka da düşüyor ({hk.neden}): hava ya da fenoloji kaynaklı olabilir, işaret üretilmedi", tuple(sahneler), taban, diger_z=diger_z, halka=hk)
        return Karar("isaret", f"{ad}'de sulama sistemini kontrol edin — tıkalı damlatıcı, arızalı vana ya da basınç sorunu olabilir.", tuple(sahneler), taban, "orta_yuksek", f"{sebep}; komşu halka (100–300 m ağaçlık) normal: {hk.neden}", diger_z, hk)
    if all(z > kural.diger_vana_esik for z in diger_z.values()):
        guven: Literal["yuksek", "orta_yuksek", "orta"] = "yuksek"
        karsi = "aynı tarihte diğer vanalar normal: yalnız bu vana düşüyor"
    else:
        guven = "orta"
        karsi = "diğer vanalardan biri de belirgin düşük (ama çoğunluk değil)"
    if hk.durum == "normal":
        karsi += f"; komşu halka normal ({hk.neden})"
        if guven == "orta":
            guven = "orta_yuksek"
    elif hk.durum == "dusuk":
        karsi += f"; ancak komşu halka da düşük ({hk.neden}) — hava/fenoloji etkisi olabilir"
    return Karar("isaret", f"{ad}'de sulama sistemini kontrol edin — tıkalı damlatıcı, arızalı vana ya da basınç sorunu olabilir.", tuple(sahneler), taban, guven, karsi, diger_z, hk)
