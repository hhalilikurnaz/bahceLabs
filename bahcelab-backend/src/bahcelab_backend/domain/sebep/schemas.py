"""ADIM 10B · sebep API şemaları."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel


class SebepYaniti(BaseModel):
    """«Sebep buydu» — kullanıcı yanıtı."""

    sebep: Literal["su", "don", "besin", "hastalik_zararli", "budama_hasat", "bilmiyorum"]


class SebepKanitSatiri(BaseModel):
    kod: str
    yon: Literal["lehte", "aleyhte"]
    metin: str
    bagimsizlik: str  # bagimsiz:istasyon|dis_kayit|kullanici · bagimli:model|uydu|radar
    tur: Literal["dogrudan", "destekleyici", "dislayici"]
    agirlik: float
    baglanti: str | None = None


class SebepSirasi(BaseModel):
    sebep: str
    ad: str
    puan: float
    dogrudan_kanit: int
    bagimsiz_kanit: int
    kanitlar: list[SebepKanitSatiri]


class SebepKapisi(BaseModel):
    kapali: bool
    mesaj: str | None
    beklenen_gecis: str | None
    beklenen_gecis_tahmini: bool = True


class SebepCikti(BaseModel):
    """Olay sebep çıktısı (GET)."""

    surum: str
    durum: str
    aciklama: str
    secim: str | None
    secim_ad: str | None
    guven: Literal["daha_olasi", "olasi", "zayif", "belirsiz"]
    guven_dusuruldu: bool
    belirsiz_nedeni: str | None
    kararlilik: float | None
    kapi: SebepKapisi
    siralama: list[SebepSirasi]
    kontrol_listesi: dict[str, Any]
    secilemeyen: list[str]
    olay: dict[str, Any]
    kullanici_yaniti: str | None
