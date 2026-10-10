import uuid
from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel

IndexId = Literal["ndvi", "msavi", "ndre", "ndmi", "cigreen"]


class IndeksOzeti(BaseModel):
    ortalama: float
    medyan: float
    p10: float
    p90: float
    min: float
    max: float
    png_var: bool
    veri_var: bool  # ham ızgara hazır (kontrastlı mod, değişim haritası, karşılaştırma için)
    sorunlu_bolge_sayisi: int


class SahneGozlemi(BaseModel):
    tarih: date
    durum: Literal["tamam", "bulutlu"]
    scene_id: str
    bulut_orani: float | None
    gecerli_piksel_orani: float
    satir: int | None
    sutun: int | None
    # Görüntü köşeleri [boylam, enlem]: KB, KD, GD, GB
    koordinatlar: list[list[float]] | None
    gercek_renk_var: bool
    indeksler: dict[str, IndeksOzeti]
    kaynak: str
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


class Uyari(BaseModel):
    tur: Literal["indeks_dusus", "coklu_indeks"]
    indeks: str | None
    indeksler: list[str]
    oncelik: Literal["normal", "yuksek"]
    baslik: str
    mesaj: str
    onceki_tarih: date | None = None
    onceki_ortalama: float | None = None
    son_tarih: date
    son_ortalama: float | None = None
    degisim_yuzde: float | None = None  # negatif: düşüş


class IndeksYanit(BaseModel):
    gozlemler: list[SahneGozlemi]
    isleme: NdviIs | None
    son_kontrol: datetime | None
    uyarilar: list[Uyari]
    eksik_cikti: bool  # bazı sahnelerde yeni indeksler henüz tamamlanmadı


class VerimlilikYanit(BaseModel):
    indeks: str
    gozlem_sayisi: int
    ilk_tarih: date
    son_tarih: date
    toplam_alan_m2: float
    bolgeler: dict[str, Any]  # GeoJSON FeatureCollection


class BahceUyariOzeti(BaseModel):
    """Bahçe listesindeki uyarı simgesi için: bahçenin aktif uydu uyarıları (kısa)."""

    garden_id: uuid.UUID
    uyarilar: list[Uyari]
