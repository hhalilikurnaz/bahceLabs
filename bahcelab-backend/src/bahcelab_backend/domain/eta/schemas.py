"""İç kalite ekranı şemaları (/ic/eta). Kullanıcı şeması DEĞİL: yalnız iç ekip."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel


class EtaDurumOzeti(BaseModel):
    garden_id: UUID
    ad: str
    alan_dekar: float | None
    kapi: str  # kapali | acik
    neden: str
    tutarlilik_p90: float | None
    tutarlilik_medyan: float | None
    cift_sayisi: int
    esik: float
    sahne_sayisi: int
    hesaplanan: int
    guncelleme: datetime


class EtaSahneSatiri(BaseModel):
    tarih: date
    sahne_id: str
    platform: str | None
    durum: str
    neden: str | None
    gecerli_oran: float
    bahce_piksel: int
    ic_piksel: int
    karisik_pay: float  # 1 − iç/tüm
    termal_m: float | None
    lst_k: float | None
    ndvi: float | None
    dt_k: float | None
    c_sahne: float | None
    c_uzun: float | None
    tc_k: float | None
    etf: float | None
    etf_ic: float | None
    etf_sigma: float | None
    et0_mm: float | None
    eta_mm: float | None
    delta_etf: float | None  # önceki hesaplanan geçişe göre


class EtaBaglamSatiri(BaseModel):
    bas: date
    bit: date
    et_mm_gun: float | None
    piksel_dokunan: int
    piksel_gecerli: int
    piksel_m: float | None


class EtaDogrulamaSatiri(BaseModel):
    tarih: date
    sahne_id: str
    et_mm_gun: float | None
    piksel_gecerli: int
    piksel_dokunan: int


class EtaKalibrasyonSatiri(BaseModel):
    tur: str
    anahtar: str
    deger: float | None
    yayilim: float | None
    n: int


class EtaKaliteDetay(BaseModel):
    durum: EtaDurumOzeti | None
    sahneler: list[EtaSahneSatiri]
    baglam: list[EtaBaglamSatiri]
    dogrulama: list[EtaDogrulamaSatiri]
    kalibrasyon: list[EtaKalibrasyonSatiri]
    notlar: list[str]
