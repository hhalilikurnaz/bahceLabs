"""Agro API yanıt/istek biçimleri (Türkçe alan adları, mevcut API diliyle uyumlu)."""

from __future__ import annotations

import re
from datetime import date
from typing import Literal

from pydantic import BaseModel, field_validator

from bahcelab_backend.domain.agro.tiers import Durum, GuvenSeviyesi

_MMDD = re.compile(r"^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$")


class KuralMeta(BaseModel):
    """Bir kuralın doğrulama durumu: arayüz `dogrulanmadi` için "ön değer – mühendis onayı bekleniyor" rozeti gösterir."""

    durum: Literal["dogrulanmadi", "muhendis_onayli"]
    kaynak: str
    onaylayan: str | None = None
    onay_tarihi: date | None = None


class KatalogCesit(BaseModel):
    kod: str
    ad: str
    not_: str | None = None


class KatalogUrun(BaseModel):
    kod: str
    ad: str
    cesitler: list[KatalogCesit]
    fenoloji: KuralMeta | None
    kc: KuralMeta | None
    gdd: KuralMeta | None
    gdd_taban_c: float | None


class KatalogGorsel(BaseModel):
    """Harita skalası eşikleri (ön değer): bahçe-içi aralık bunun altındaysa gerilmiş skala kapalı."""

    meta: KuralMeta
    gerilme_min_aralik: dict[str, float]


class KatalogYanit(BaseModel):
    surum: int
    urunler: list[KatalogUrun]
    gorsel: KatalogGorsel


class EvreYanit(BaseModel):
    kod: str
    ad: str
    baslangic: date
    bitis: date
    baslangic_aagg: str
    bitis_aagg: str
    ozel: bool  # bahçe düzeyinde düzeltilmiş
    kc: float | None
    sezon: int  # bu pencerenin ait olduğu sezon (başlangıç yılı)


class FenolojiYanit(BaseModel):
    sezon: int
    urun: str
    cesit_kodu: str | None
    kural: KuralMeta | None
    kc_kural: KuralMeta | None
    kural_yok: bool
    evreler: list[EvreYanit]  # sezon-1, sezon ve sezon+1 pencereleri (aralık seçimi için)


class FenolojiDuzeltme(BaseModel):
    baslangic: str  # AA-GG
    bitis: str

    @field_validator("baslangic", "bitis")
    @classmethod
    def _mmdd(cls, value: str) -> str:
        if not _MMDD.match(value):
            raise ValueError("Tarih 'AA-GG' biçiminde olmalı (örn. 03-15).")
        month, day = (int(p) for p in value.split("-"))
        if (month, day) == (2, 29) or day > [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]:
            raise ValueError("Geçersiz gün; 29 Şubat kullanılamaz.")
        return value


class SeriGunu(BaseModel):
    tarih: date
    tmin: float | None
    tmax: float | None
    yagis_mm: float | None
    yagis_birikimli_mm: float
    onceki_yagis_birikimli_mm: float | None
    gdd: float | None
    gdd_birikimli: float | None
    onceki_gdd_birikimli: float | None


class SeriOzeti(BaseModel):
    son_gun: date | None
    yagis_birikimli_mm: float | None
    onceki_ayni_gun_yagis_mm: float | None
    gdd_birikimli: float | None
    onceki_ayni_gun_gdd: float | None


class SerilerYanit(BaseModel):
    sezon: int
    sezon_baslangici: date
    sezon_bitisi: date
    gdd_taban_c: float | None
    gdd_kural: KuralMeta | None
    gunler: list[SeriGunu]
    ozet: SeriOzeti
    eksik_gun: int
    onceki_sezon_var: bool
    notlar: list[str]


class BilesenV2Yanit(BaseModel):
    kod: Literal["agac_gucu", "su", "beslenme", "ani_degisim", "isi"]
    ad: str
    seviye: Literal["belirgin_dusuk", "normalin_alti", "normal", "normalin_ustu", "belirgin_yuksek"] | None  # tek etiket kuralı: p25–p75 normal, p10–p25/p75–p90 altı/üstü, <p10/>p90 belirgin; None = veri yok
    kullanilabilir: bool
    bayat: bool
    neden: str
    veri_tarihi: date | None


class DurumV2Yanit(BaseModel):
    """Durum v2 (ADR 0018): kademe + 5 bileşen çipi + risk satırı. İç puan bu yanıtta YOKTUR."""

    durum: Durum
    etiket: str
    ozet: str
    bilesenler: list[BilesenV2Yanit]
    riskler: list[str]
    guven: GuvenSeviyesi
    guven_nedeni: str
    nasil: list[str]  # «Nasıl hesaplandı?»: en çok 3 cümle
    dusuren: list[str]
    risk_sinirladi: bool
    esik_durumu: str
    hesaplama_tarihi: date


class BugunMaddesiYanit(BaseModel):
    tur: str
    oncelik: Literal["kritik", "onemli", "bilgi"]
    baslik: str
    metin: str
    sekme: Literal["durum", "analiz", "hava", "gunluk", "rapor"]
    ayrinti: str | None = None


class BugunYanit(BaseModel):
    tarih: date
    maddeler: list[BugunMaddesiYanit]


# ----------------------------------------------------------------------------- sulama
class SulamaPenceresi(BaseModel):
    gun: int
    etc_mm: float
    etkili_yagis_mm: float
    net_mm: float  # ETc − etkili yağış (pozitif = su açığı)
    eksik_gun: int


class SulamaSistemiYanit(BaseModel):
    kod: str | None
    ad: str | None
    verimlilik: float | None


class SulamaYanit(BaseModel):
    veri_yeterli: bool
    veri_yetersiz_nedeni: str | None
    son_gunler: SulamaPenceresi | None
    onumuzdeki_gunler: SulamaPenceresi | None
    ihtiyac_mm: float | None  # önümüzdeki günlerin net ihtiyacı
    brut_ihtiyac_mm: float | None  # sistem verimliliğine bölünmüş
    ton_dekar: float | None  # 1 mm = 1 ton/dekar
    toplam_ton: float | None
    sistem: SulamaSistemiYanit
    gerekli: bool
    cumle: str
    karar_kaynagi: Literal["su", "hava"] = "hava"  # su: karar Su sekmesindekiyle aynı fonksiyondan gelir
    not_: str
    etkili_yagis_kural: KuralMeta
    sistem_kural: KuralMeta
    kc_kural: KuralMeta | None


# ----------------------------------------------------------------------------- riskler
class RiskYanit(BaseModel):
    kod: str
    ad: str
    kisa: str
    seviye: Literal["dusuk", "orta", "yuksek"]
    gerekce: str
    gecerlilik_baslangic: date
    gecerlilik_bitis: date
    veri_yeterli: bool
    kural: KuralMeta


class TuzakArayuzu(BaseModel):
    """Adım 12: tuzak sayımı girişi bu motora bağlanacak (arayüz şimdi hazır, giriş henüz yok)."""

    desteklenir: bool
    adim: str
    aciklama: str


class RiskleriYanit(BaseModel):
    tarih: date
    riskler: list[RiskYanit]
    tuzak: TuzakArayuzu
    not_: str
