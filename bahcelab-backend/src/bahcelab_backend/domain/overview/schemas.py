import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel

from bahcelab_backend.domain.overview.status import Durum, Seviye


class SeriNoktasi(BaseModel):
    tarih: date
    deger: float


class SonGoruntu(BaseModel):
    tarih: date
    kucuk_resim_url: str


class UyariOzeti(BaseModel):
    kaynak: Literal["uydu", "hava"]
    tur: Literal["indeks_dusus", "coklu_indeks", "don", "sicak"]
    seviye: Seviye
    baslik: str


class HavaOzeti(BaseModel):
    sicaklik: float
    kod: int
    aciklama: str
    ikon: str
    guncelleme: datetime
    bayat: bool


class BahceOzeti(BaseModel):
    id: uuid.UUID
    ad: str
    urun: str
    cesit: str | None
    dekar: float
    il: str | None
    ilce: str | None
    durum: Durum
    durum_nedeni: str | None
    indeks: str
    son_goruntu: SonGoruntu | None
    seri: list[SeriNoktasi]
    uyarilar: list[UyariOzeti]
    hava: HavaOzeti | None


class Toplamlar(BaseModel):
    bahce_sayisi: int
    toplam_dekar: float
    dikkat_sayisi: int
    izle_sayisi: int


class BahceOzetiYanit(BaseModel):
    toplamlar: Toplamlar
    bahceler: list[BahceOzeti]
