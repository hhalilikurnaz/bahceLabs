"""İç izleme ekranı şemaları (/ic/izleme). Kullanıcı şeması DEĞİL: yalnız iç ekip."""

import uuid
from datetime import date, datetime

from pydantic import BaseModel


class AkisSatiri(BaseModel):
    akis: str
    ad: str
    durum: str
    son_veri: date | None
    gecikme_gun: float | None
    bosluk_gun: int | None
    son_basari: datetime | None
    beklenen_gun: float
    kabul_gecikme_gun: float
    kopuk_gun: float
    neden: str


class AkisNokta(BaseModel):
    akis: str
    tarih: date
    gecikme_gun: float | None
    durum: str


class AkislarYanit(BaseModel):
    bugun: date
    guncel: list[AkisSatiri]
    zaman: list[AkisNokta]


class UyumNokta(BaseModel):
    tarih: date
    deger: float | None
    taban: float | None
    sapma: float | None
    n: int
    durum: str


class UyumSeri(BaseModel):
    kontrol: str
    garden_id: uuid.UUID | None
    bahce: str | None
    esik: float
    son_durum: str
    noktalar: list[UyumNokta]


class UyumYanit(BaseModel):
    seriler: list[UyumSeri]


class KuralSatiri(BaseModel):
    kural: str
    ad: str
    ay: date
    uretilen: int
    yanit: int
    yanit_orani: float | None
    isabet_n: int
    isabet: float | None
    durum: str
    neden: str


class KuralOzet(BaseModel):
    kural: str
    ad: str
    uretilen: int
    yanit: int
    isabet: float | None
    durum: str


class KurallarYanit(BaseModel):
    bas: date
    bit: date
    aylik: list[KuralSatiri]
    ozet: list[KuralOzet]


class BahceGuven(BaseModel):
    garden_id: uuid.UUID
    ad: str
    etiket: str
    puan: int
    toplam: int
    nedeni: str
    eksik: list[str]


class BahcelerYanit(BaseModel):
    bugun: date
    dagilim: dict[str, int]
    en_dusuk: list[BahceGuven]
    toplam_bahce: int
