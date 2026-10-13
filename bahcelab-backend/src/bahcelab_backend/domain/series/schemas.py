from datetime import date
from typing import Literal

from pydantic import BaseModel


class EgriNoktasi(BaseModel):
    tarih: date
    deger: float
    alt: float
    ust: float
    tahmini: bool  # gözlemden uzak: kesikli çizgi + soluk bant + «tahmini» etiketi


class Gozlem(BaseModel):
    tarih: date
    deger: float
    kaynak: Literal["s2", "hls"]
    agirlik: float


class RadarIsareti(BaseModel):
    """Optik gözlem boşluğunda radar geçişi: yalnız değişim var/yok (radar NDVI üretmez)."""

    tarih: date
    degisim: bool


class CanlilikEgrisi(BaseModel):
    baslangic: date
    bitis: date
    noktalar: list[EgriNoktasi]
    gozlemler: list[Gozlem]
    radar_isaretleri: list[RadarIsareti]
    yeterli: bool  # en az 3 gözlem var mı (yoksa eğri çizilmez)
    kaynaklar: str  # «Sentinel-2 (10 m) + HLS (30 m, 2020→)»
    yontem: str  # kısa açıklama (ön değer)
    kademe_notu: str  # kademe yalnız gerçek gözleme dayanır
