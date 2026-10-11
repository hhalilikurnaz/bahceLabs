import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class BildirimYanit(BaseModel):
    id: uuid.UUID
    bahce_id: uuid.UUID | None
    tur: str
    tur_adi: str
    oncelik: Literal["kritik", "uyari", "bilgi"]
    baslik: str
    metin: str
    baglanti: str
    okundu: bool
    olusturma: datetime


class BildirimListesi(BaseModel):
    sayfa: int
    boyut: int
    toplam: int
    sayfa_sayisi: int
    okunmamis_sayisi: int
    ogeler: list[BildirimYanit]


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
