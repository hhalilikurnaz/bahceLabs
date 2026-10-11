from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel

SprayStatus = Literal["uygun", "sinirda", "uygun_degil"]


class Konum(BaseModel):
    enlem: float
    boylam: float


class Simdi(BaseModel):
    zaman: str
    sicaklik: float
    hissedilen: float | None
    nem: float | None
    yagis: float
    ruzgar: float
    hamle: float | None
    yon: float | None
    kod: int
    aciklama: str
    ikon: str


class IlaclamaGunu(BaseModel):
    uygun_saat: int
    sinirda_saat: int
    uygun_degil_saat: int
    en_iyi_aralik: tuple[str, str] | None


class GunTahmini(BaseModel):
    tarih: date
    min: float | None
    max: float | None
    yagis_mm: float | None
    yagis_olasiligi: float | None
    ruzgar_max: float | None
    hamle_max: float | None
    et0_mm: float | None
    kod: int | None
    aciklama: str
    ikon: str
    ilaclama: IlaclamaGunu
    gun_dogumu: str | None = None
    gun_batimi: str | None = None


class SaatTahmini(BaseModel):
    zaman: str
    sicaklik: float
    nem: float | None
    yagis: float
    yagis_olasiligi: float | None
    ruzgar: float
    hamle: float
    et0: float | None
    kod: int
    ilaclama: SprayStatus
    ilaclama_nedenleri: list[str]
    gunduz: bool = True


class HavaUyarisi(BaseModel):
    tur: Literal["don", "sicak"]
    seviye: Literal["sari", "kirmizi"]
    baslik: str
    mesaj: str
    baslangic: str
    bitis: str
    sure_saat: int
    deger: float


class SuDengesi(BaseModel):
    gun: int
    yagis_mm: float
    et0_mm: float
    denge_mm: float
    eksik_gun: int
    aciklama: str


class YagisToplami(BaseModel):
    etiket: str
    gun: int
    mm: float | None
    gecen_yil_mm: float | None


class HavaYanit(BaseModel):
    konum: Konum
    guncelleme: datetime
    # True: sağlayıcıya ulaşılamadı, son önbellek gösteriliyor
    onbellekten: bool
    kaynak: str
    atif: str
    simdi: Simdi
    gunler: list[GunTahmini]
    saatlik: list[SaatTahmini]
    uyarilar: list[HavaUyarisi]
    su_dengesi: list[SuDengesi]
    yagis_toplamlari: list[YagisToplami]
    sezon_baslangici: date


class GecmisGun(BaseModel):
    tarih: date
    min: float | None
    max: float | None
    yagis_mm: float | None
    et0_mm: float | None


class GecmisYanit(BaseModel):
    baslangic: date
    bitis: date
    gunler: list[GecmisGun]
    guncelleme: datetime | None
    onbellekten: bool
    atif: str


class IlaclamaAraligi(BaseModel):
    baslangic: str
    bitis: str


class HavaOzeti(BaseModel):
    """Bir bahçenin kısa hava özeti (sol şerit listesi)."""

    garden_id: str
    ad: str
    hata: str | None = None
    guncelleme: datetime | None = None
    onbellekten: bool = False
    simdi: Simdi | None = None
    bugun_min: float | None = None
    bugun_max: float | None = None
    bugun_yagis_mm: float | None = None
    bugun_yagis_olasiligi: float | None = None
    uyarilar: list[HavaUyarisi] = []
    sonraki_ilaclama: IlaclamaAraligi | None = None
