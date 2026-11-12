"""Vana bazında «sulama sistemi kontrol» işareti — SAF kural (ADR 0029; veritabanı/ağ yok, birim testli).

Girdi: vananın (yoksa bahçenin) Sentinel-2 NDMI gözlemleri (bulutsuz), her gözlemin fenolojik evresi ve sezonu, o günlerin kova durumu.
Taban: AYNI fenolojik evrede, ÖNCEKİ sezonlardaki gözlemler (en az `min_sezon` farklı sezon ve `min_taban_sahne` sahne; yoksa işaret üretilmez, nedeni yazılır).
Kural: kova «yeterli/dolu» (Ks = 1) iken ardışık `art_arda_sahne` bulutsuz sahnede z ≤ `z_esik` → «V2'de sulama sistemini kontrol edin».
Karşılaştırma: aynı tarihlerde diğer vanalardan yalnız biri düşüyorsa güven YÜKSEK; vanaların `hepsi_dusuyor_orani`'ı düşüyorsa (hava/fenoloji) işaret ÜRETİLMEZ; karşılaştırılacak vana yoksa güven ORTA.
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
    guven: Literal["yuksek", "orta"] | None = None
    karsilastirma: str | None = None
    diger_z: dict[str, float] = field(default_factory=dict)


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


def degerlendir(ad: str, seri: list[Gozlem], digerleri: dict[str, list[Gozlem]], bugun: date, kural: SistemKontrolKurali, kova_ok: dict[date, bool]) -> Karar:
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
    if diger_z and (dusen + 1) / (len(diger_z) + 1) >= kural.hepsi_dusuyor_orani and dusen >= 1:
        return Karar("yok", f"vanaların çoğu birlikte düşüyor ({dusen + 1}/{len(diger_z) + 1}): hava ya da fenoloji kaynaklı olabilir, işaret üretilmedi", tuple(sahneler), taban, diger_z=diger_z)
    if not diger_z:
        guven: Literal["yuksek", "orta"] = "orta"
        karsi = "karşılaştırılacak başka vana yok (bahçe tek sektör)"
    elif all(z > kural.diger_vana_esik for z in diger_z.values()):
        guven = "yuksek"
        karsi = "aynı tarihte diğer vanalar normal: yalnız bu vana düşüyor"
    else:
        guven = "orta"
        karsi = "diğer vanalardan biri de belirgin düşük (ama çoğunluk değil)"
    return Karar("isaret", f"{ad}'de sulama sistemini kontrol edin — tıkalı damlatıcı, arızalı vana ya da basınç sorunu olabilir.", tuple(sahneler), taban, guven, karsi, diger_z)
