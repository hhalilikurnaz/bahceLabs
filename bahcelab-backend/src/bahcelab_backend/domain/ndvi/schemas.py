import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel


class NdviGozlem(BaseModel):
    tarih: date
    durum: Literal["tamam", "bulutlu"]
    scene_id: str
    bulut_orani: float | None
    gecerli_piksel_orani: float
    ortalama: float | None
    medyan: float | None
    p10: float | None
    p90: float | None
    min: float | None
    max: float | None
    png_var: bool
    # PNG köşeleri [boylam, enlem]: KB, KD, GD, GB
    koordinatlar: list[list[float]] | None
    sorunlu_bolge_sayisi: int
    kaynak: Literal["sentinel-2", "ornek"]
    # Görüntü yeniden üretilince değişir; istemci önbelleğini geçersiz kılmak için URL'e eklenir
    surum: int


class NdviIs(BaseModel):
    id: uuid.UUID
    tur: Literal["ilk", "guncelleme", "yeniden"]
    durum: Literal["bekliyor", "isleniyor", "tamam", "hata"]
    toplam: int
    islenen: int
    hata_mesaji: str | None
    baslangic: datetime | None
    bitis: datetime | None


class NdviUyari(BaseModel):
    tur: Literal["ndvi_dusus"]
    mesaj: str
    onceki_tarih: date
    onceki_ortalama: float
    son_tarih: date
    son_ortalama: float
    degisim_yuzde: float  # negatif: düşüş


class NdviYanit(BaseModel):
    gozlemler: list[NdviGozlem]
    isleme: NdviIs | None
    son_kontrol: datetime | None
    uyarilar: list[NdviUyari]
    ornek_veri: bool
