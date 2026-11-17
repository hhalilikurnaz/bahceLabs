"""ADIM 10B (ADR 0033) · olası sebep motoru — SAF, kural tabanlı, açıklanabilir (ML yok). Ağırlıklar katalogda (`sebep`), hepsi ön değer · mühendis onayı bekliyor.

İlkeler:
  · Puan yalnız SIRALAMA içindir; olasılık değildir. Ekranda yüzde yok.
  · ELEME İLE SEÇİM YOK: bir sebep ancak en az bir DOĞRUDAN lehte kanıtı varsa seçilebilir. «Başka açıklama yok» kanıt sayılmaz; besin/hastalık/mekanik için doğrudan uydu kanıtı yoktur,
    bu yüzden seçilemezler (yalnız «sahada kontrol edin» listesi).
  · Her kanıt satırı bağımsızlık etiketi taşır: bağımsız (istasyon · dış kayıt · kullanıcı yanıtı) ya da bağımlı (model/ERA5 · uydu · radar). Bağımsız kanıt `bagimsiz_carpan` ile ağırlaşır;
    bağımsız lehte kanıt yoksa güven sözcüğü «daha olası» olamaz.
  · Belirsizlik açıkça söylenir: seçim yoksa neden döner."""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import Literal

from bahcelab_backend.domain.agro.catalog import SebepKurali

Sebep = Literal["don", "su", "goruntu"]
SEBEPLER: tuple[str, ...] = ("don", "su", "goruntu")
Bagimsizlik = Literal[
    "bagimsiz:istasyon",
    "bagimsiz:dis_kayit",
    "bagimsiz:kullanici",
    "bagimli:model",
    "bagimli:uydu",
    "bagimli:radar",
]

#: Seçim için sayılan DOĞRUDAN kanıt kodları (yalnız lehte ağırlıklılar). Diğer lehte kanıtlar «destekleyici»dir: puana girer, tek başına seçtirmez.
DOGRUDAN = frozenset(
    {
        "don_kullanici_oldu",
        "don_istasyon_destek",
        "don_dis_kayit_destek",
        "don_era5_guclu",
        "don_era5_sifir",
        "su_toprak_kurak",
        "gor_toparlandi",
        "gor_bulut",
    }
)
SEBEP_ONEKI = {"don": "don_", "su": "su_", "goruntu": "gor_"}


@dataclass(frozen=True)
class HazirKanit:
    """Servisin dış kaynaklardan (istasyon, kamu kaydı, kullanıcı yanıtı) çıkardığı bağımsız kanıt; motor yalnız puanlar."""

    kod: str
    bagimsizlik: Bagimsizlik
    metin: str
    baglanti: str | None = None


@dataclass(frozen=True)
class Girdi:
    ay: int
    tmin_pencere: float | None = (
        None  # ERA5-Land: [önceki sahne + 1 − don_hasar_gun, düşüşü gören sahne] en düşük günlük hava (°C)
    )
    d_ndmi: float | None = None
    z_nem30: float | None = None  # 30 günlük toprak nemi, aynı pencerenin diğer yıllarına göre z
    dusen_pay: float | None = None
    kalici: bool | None = None  # None: sonraki net sahne henüz yok (bilinmiyor)
    toparlanma_orani: float | None = None
    sahne_bulut: float | None = None
    radar_degisim: bool = False  # aynı pencerede Sentinel-1 değişim olayı (bulutlardan etkilenmez)
    hazir: tuple[HazirKanit, ...] = ()


@dataclass(frozen=True)
class Kanit:
    kod: str
    sebep: str
    yon: Literal["lehte", "aleyhte"]
    agirlik: float  # bağımsızlık çarpanı uygulanmış etkin ağırlık (işaretli)
    ham_agirlik: float
    tur: Literal["dogrudan", "destekleyici", "dislayici"]
    bagimsizlik: str
    metin: str
    baglanti: str | None = None


@dataclass
class SebepPuan:
    sebep: str
    puan: float = 0.0
    kanitlar: list[Kanit] = field(default_factory=list)

    @property
    def dogrudan_lehte(self) -> int:
        return sum(1 for k in self.kanitlar if k.tur == "dogrudan" and k.agirlik > 0)

    @property
    def bagimsiz_lehte(self) -> int:
        return sum(
            1 for k in self.kanitlar if k.bagimsizlik.startswith("bagimsiz") and k.agirlik > 0
        )


@dataclass
class Sonuc:
    siralama: list[SebepPuan]
    secim: str | None
    guven: Literal["daha_olasi", "olasi", "belirsiz"]
    belirsiz_nedeni: str | None
    kapi: bool = False  # «görüntü kaynaklı olabilir» kapısı (uyarı/bildirim bastırma)

    def puan_of(self, sebep: str) -> SebepPuan:
        return next(s for s in self.siralama if s.sebep == sebep)


def _kanit(
    kural: SebepKurali,
    kod: str,
    sebep: str,
    metin: str,
    bagimsizlik: str,
    baglanti: str | None = None,
    carpan: float = 1.0,
) -> Kanit:
    ham = kural.agirlik[kod]
    etkin = ham * (kural.bagimsiz_carpan if bagimsizlik.startswith("bagimsiz") else 1.0) * carpan
    tur: Literal["dogrudan", "destekleyici", "dislayici"] = "dogrudan" if kod in DOGRUDAN else ("destekleyici" if ham > 0 else "dislayici")
    return Kanit(
        kod, sebep, "lehte" if ham > 0 else "aleyhte", etkin, ham, tur, bagimsizlik, metin, baglanti
    )


def kanitlari_topla(
    g: Girdi, k: SebepKurali, carpan: dict[str, float] | None = None
) -> dict[str, list[Kanit]]:
    """Girdiden her sebep için lehte/aleyhte kanıt satırları. `carpan`: sebep → ağırlık çarpanı (yalnız kararlılık sınaması)."""
    c = carpan or {}
    out: dict[str, list[Kanit]] = {s: [] for s in SEBEPLER}

    def ekle(kod: str, sebep: str, metin: str, bag: str, baglanti: str | None = None) -> None:
        out[sebep].append(_kanit(k, kod, sebep, metin, bag, baglanti, c.get(sebep, 1.0)))

    # ---- don: bağımsız (istasyon, dış kayıt, kullanıcı) + bağımlı (ERA5-Land)
    for h in g.hazir:
        sebep = next((s for s, p in SEBEP_ONEKI.items() if h.kod.startswith(p)), None)
        if sebep:
            ekle(h.kod, sebep, h.metin, h.bagimsizlik, h.baglanti)
    t = g.tmin_pencere
    if t is not None:
        if t <= k.don_c_guclu:
            ekle(
                "don_era5_guclu",
                "don",
                f"Pencerede en düşük hava {t:.1f} °C ≤ {k.don_c_guclu:g} °C (ERA5-Land, model)",
                "bagimli:model",
            )
        elif t <= 0.0:
            ekle(
                "don_era5_sifir",
                "don",
                f"Pencerede en düşük hava {t:.1f} °C ≤ 0 °C (ERA5-Land, model)",
                "bagimli:model",
            )
        elif t <= k.don_c_sinir:
            ekle(
                "don_era5_sinir",
                "don",
                f"Pencerede en düşük hava {t:.1f} °C (0 ile +{k.don_c_sinir:g} °C arası: ölçüm belirsizliği içinde, model)",
                "bagimli:model",
            )
        else:
            ekle(
                "don_era5_imkansiz",
                "don",
                f"Pencerede hava hep > +{k.don_c_imkansiz:g} °C (en düşük {t:.1f} °C, ERA5-Land): don fiziksel olarak olası değil",
                "bagimli:model",
            )
    if g.kalici and g.ay in k.kis_aylari:
        ekle(
            "don_kis_kalici",
            "don",
            "Kış/erken ilkbahar ve düşüş kalıcı (sonraki net görüntüde sürüyor)",
            "bagimli:uydu",
        )
    # ---- su
    if g.z_nem30 is not None and g.z_nem30 <= k.z_kurak:
        ekle(
            "su_toprak_kurak",
            "su",
            f"30 günlük toprak nemi aynı dönemin diğer yıllarına göre düşük (z = {g.z_nem30:.1f}, ERA5-Land, model)",
            "bagimli:model",
        )
    if g.z_nem30 is not None and g.z_nem30 >= k.z_nemli:
        ekle(
            "su_toprak_nemli",
            "su",
            f"30 günlük toprak nemi normalin üstünde (z = {g.z_nem30:.1f}, ERA5-Land, model)",
            "bagimli:model",
        )
    if g.d_ndmi is not None and g.d_ndmi <= k.ndmi_dusus:
        ekle(
            "su_ndmi_dusus",
            "su",
            f"NDMI {g.d_ndmi:+.2f} düştü (su içeriği göstergesi; don ve diğer hasarlar da düşürür, özgül değil)",
            "bagimli:uydu",
        )
    elif g.d_ndmi is not None:
        ekle("su_ndmi_yok", "su", f"NDMI belirgin düşmedi ({g.d_ndmi:+.2f})", "bagimli:uydu")
    if g.ay in k.yaz_aylari:
        ekle("su_yaz", "su", "Yaz ayı (su stresi mevsimi)", "bagimli:model")
    # ---- görüntü kaynaklı
    gecici = g.kalici is False or (
        g.toparlanma_orani is not None and g.toparlanma_orani >= k.toparlanma_orani
    )
    if gecici:
        ekle(
            "gor_toparlandi",
            "goruntu",
            "Sonraki net görüntüde düşüş geri geldi (toparlandı)",
            "bagimli:uydu",
        )
    if g.sahne_bulut is not None and g.sahne_bulut >= k.bulut_pct:
        ekle(
            "gor_bulut",
            "goruntu",
            f"Düşüşü gören sahne %{g.sahne_bulut:.0f} bulutlu",
            "bagimli:uydu",
        )
    if g.dusen_pay is not None and g.dusen_pay >= k.tum_bahce_pay:
        ekle(
            "gor_tum_bahce",
            "goruntu",
            f"Bahçenin %{g.dusen_pay * 100:.0f}'i tek adımda düştü (bulut/gölge deseni; yayılan küme değil)",
            "bagimli:uydu",
        )
    if g.kalici and not gecici:
        ekle("gor_kalici", "goruntu", "Düşüş sonraki net görüntüde de sürüyor", "bagimli:uydu")
    if g.radar_degisim:
        ekle(
            "gor_radar_degisim",
            "goruntu",
            "Aynı dönemde radar (Sentinel-1, buluttan etkilenmez) de değişim gösterdi",
            "bagimli:radar",
        )
    return out


def degerlendir(g: Girdi, k: SebepKurali, carpan: dict[str, float] | None = None) -> Sonuc:
    kanit = kanitlari_topla(g, k, carpan)
    puanlar = [
        SebepPuan(s, round(sum(x.agirlik for x in kanit[s]), 3), kanit[s])
        for s in SEBEPLER
        if s in k.siralanan
    ]
    siralama = sorted(puanlar, key=lambda p: (-p.puan, p.sebep))
    secim: str | None = None
    neden: str | None = None
    secilen: SebepPuan | None = None
    uygun = [p for p in siralama if p.dogrudan_lehte > 0]
    if not uygun:
        neden = "Hiçbir sebep için doğrudan (pozitif) kanıt yok; başka açıklamanın yokluğu kanıt sayılmaz."
    else:
        en = uygun[0]
        ikinci = next((p.puan for p in siralama if p.sebep != en.sebep), float("-inf"))
        if en.puan < k.secim_esik:
            neden = f"Doğrudan kanıtı olan en yüksek puan ({en.puan:g}) seçim eşiğinin ({k.secim_esik:g}) altında."
        elif en.puan - ikinci < k.secim_marj:
            neden = f"İlk iki sebep birbirine yakın (fark < {k.secim_marj:g})."
        else:
            secim, secilen = en.sebep, en
    guven: Literal["daha_olasi", "olasi", "belirsiz"] = "belirsiz"
    if secim:
        guven = "daha_olasi" if secilen is not None and secilen.bagimsiz_lehte > 0 else "olasi"
    s = Sonuc(siralama, secim, guven, neden)
    s.kapi = kapi_kapali_mi(s, k)
    return s


def kapi_kapali_mi(s: Sonuc, k: SebepKurali) -> bool:
    """«Görüntü kaynaklı olabilir» kapısı: görüntü seçildi, puanı ≥ kapı eşiği ve don puanı azami altında → bu düşüş için uyarı/bildirim üretilmez."""
    if s.secim != "goruntu":
        return False
    return s.puan_of("goruntu").puan >= k.kapi_esik and s.puan_of("don").puan < k.kapi_don_azami


def kararlilik(g: Girdi, k: SebepKurali, tohum: int = 7) -> float:
    """Sebep başına ağırlık çarpanı U(1−a, 1+a), `kararlilik_deneme` kez: seçimin (çekimserlik dahil) değişmeme oranı. Sabit tohum → deterministik."""
    ref = degerlendir(g, k).secim
    rng = random.Random(tohum)
    sabit = 0
    for _ in range(k.kararlilik_deneme):
        c = {s: rng.uniform(1 - k.kararlilik_aralik, 1 + k.kararlilik_aralik) for s in SEBEPLER}
        sabit += degerlendir(g, k, c).secim == ref
    return round(sabit / k.kararlilik_deneme, 2)
