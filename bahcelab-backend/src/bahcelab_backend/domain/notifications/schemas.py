import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class BildirimYanit(BaseModel):
    id: uuid.UUID
    bahce_id: uuid.UUID | None
    tur: str
    tur_adi: str
    oncelik: Literal["kritik", "onemli", "bilgi"]
    baslik: str
    metin: str
    baglanti: str
    okundu: bool
    sistem: bool = False  # veri akışı (sistem) bildirimi; ürün uyarısı değildir
    durum: Literal["olustu", "goruldu", "cozuldu", "ertelendi"]
    ertelendi_bitis: datetime | None = None
    olusturma: datetime
    ogeler: list[dict[str, str]] = Field(default_factory=list)  # özet kartı: kapsanan maddeler (önem, başlık, metin, bağlantı, tür)


class BildirimListesi(BaseModel):
    sayfa: int
    boyut: int
    toplam: int
    sayfa_sayisi: int
    okunmamis_sayisi: int  # hepsi
    okunmamis_urun_sayisi: int = 0  # rozet bunu gösterir
    okunmamis_sistem_sayisi: int = 0
    ogeler: list[BildirimYanit]


class DurumDegistir(BaseModel):
    """Yaşam döngüsü geçişi. «olustu» istemciden verilemez; «ertelendi» için süre (gün) zorunludur."""

    durum: Literal["goruldu", "cozuldu", "ertelendi"]
    erteleme_gun: int | None = Field(default=None, ge=1, le=30)

    @model_validator(mode="after")
    def _snooze_needs_days(self) -> "DurumDegistir":
        if self.durum == "ertelendi" and self.erteleme_gun is None:
            raise ValueError("Erteleme için gün sayısı gerekir.")
        return self


class TercihYanit(BaseModel):
    tur: str
    ad: str
    aciklama: str
    acik: bool


class TercihGuncelle(BaseModel):
    acik: bool


class TopluOkundu(BaseModel):
    guncellenen: int
    okunmamis_sayisi: int
