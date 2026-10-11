"""Agro API yanıt/istek biçimleri (Türkçe alan adları, mevcut API diliyle uyumlu)."""

from __future__ import annotations

import re
from datetime import date
from typing import Literal

from pydantic import BaseModel, field_validator

from bahcelab_backend.domain.agro.score import Durum, GuvenSeviyesi

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


class KatalogYanit(BaseModel):
    surum: int
    urunler: list[KatalogUrun]


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


class BilesenYanit(BaseModel):
    kod: str
    ad: str
    puan: int | None
    agirlik: float
    kullanilabilir: bool
    neden: str


class GuvenYanit(BaseModel):
    seviye: GuvenSeviyesi
    aciklama: str
    gecmis_gun: int
    son_goruntu_yasi_gun: int | None


class DurumYanit(BaseModel):
    durum: Durum
    etiket: str
    skor: int | None
    ozet: str
    veri_yeterli: bool
    veri_yetersiz_nedeni: str | None
    bilesenler: list[BilesenYanit]
    guven: GuvenYanit
    hesaplama_tarihi: date


class BugunMaddesiYanit(BaseModel):
    tur: str
    oncelik: Literal["kritik", "uyari", "bilgi"]
    baslik: str
    metin: str
    sekme: Literal["durum", "analiz", "hava", "gunluk", "rapor"]


class BugunYanit(BaseModel):
    tarih: date
    maddeler: list[BugunMaddesiYanit]
