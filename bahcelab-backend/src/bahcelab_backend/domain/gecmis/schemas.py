from datetime import date
from typing import Literal

from pydantic import BaseModel

Seviye = Literal["belirgin_dusuk", "normalin_alti", "normal", "normalin_ustu", "belirgin_yuksek"]


class OlaySayisi(BaseModel):
    tur_adi: str
    sayi: int


class HasatOzeti(BaseModel):
    """Hasat bilgisi yalnız Saha Defteri kaydından gelir; kayıt yoksa «kayıt yok» (uydurma yok)."""

    durum: Literal["kayit_yok", "kayit"]
    adet: int = 0
    son_tarih: date | None = None


class YilSatiri(BaseModel):
    yil: int
    canlilik: Seviye | None  # diğer yıllara göre yaz canlılığı; yetersizse null
    canlilik_nedeni: str | None = None  # null ise neden «yetersiz» (örn. «yaz verisi yetersiz»)
    olay_sayisi: int
    olaylar: list[OlaySayisi]
    uyumsuz: bool | None  # çok yıllı analizdeki uyumsuz yıl; analiz yoksa null
    uyumsuz_nedeni: str | None = None
    hasat: HasatOzeti


class Yesillenme(BaseModel):
    yil: int
    tarih: date
    etiket: str  # «ön değer»
    gozlem_sayisi: int


class GecmisOzeti(BaseModel):
    ilk_yil: int | None
    son_yil: int
    yillar: list[YilSatiri]  # eskiden yeniye
    yesillenme: list[Yesillenme]  # yalnız güvenilir yıllar; diğerleri yok
    esik_durumu: str
    not_: str
