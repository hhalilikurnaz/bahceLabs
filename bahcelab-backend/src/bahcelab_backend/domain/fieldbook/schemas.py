import uuid
from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

KayitTuru = Literal["gozlem", "ilaclama", "gubreleme", "sulama", "hasat", "tuzak"]
Sonuc = Literal["gerceklesti", "gerceklesmedi", "bilinmiyor"]
HedefTuru = Literal["olay", "uyari"]


class FotoYanit(BaseModel):
    id: uuid.UUID
    url: str
    boyut_bayt: int


class FotoOnerisi(BaseModel):
    """Fotoğrafın EXIF'inden ÖNERİ (saklanmaz): kullanıcı onaylamadan kayda yazılmaz."""

    tarih: date | None
    konum: dict[str, Any] | None  # GeoJSON Point; yalnız bahçeye en çok 500 m ise
    konum_mesafe_m: int | None  # fotoğrafın konumunun bahçeye uzaklığı (varsa)
    konum_bahceden_uzak: bool  # konum var ama bahçeden uzak: önerilmez
    aciklama: str


class KayitGirdisi(BaseModel):
    tur: KayitTuru
    tarih: date
    konum: dict[str, Any] | None = Field(default=None, description="GeoJSON Point (nokta) ya da Polygon (alan); bahçeye en çok 500 m uzaklıkta olmalı")
    aciklama: str | None = Field(default=None, max_length=1000)
    ayrinti: dict[str, Any] | None = None

    @field_validator("aciklama")
    @classmethod
    def _strip(cls, v: str | None) -> str | None:
        return (v.strip() or None) if v is not None else None


class KayitGuncelle(BaseModel):
    tur: KayitTuru | None = None
    tarih: date | None = None
    konum: dict[str, Any] | None = None
    aciklama: str | None = Field(default=None, max_length=1000)
    ayrinti: dict[str, Any] | None = None
    konumu_sil: bool = False


class KayitYanit(BaseModel):
    id: uuid.UUID
    tur: KayitTuru
    tarih: date
    konum_tur: Literal["nokta", "alan"] | None
    konum: dict[str, Any] | None
    aciklama: str | None
    ayrinti: dict[str, Any] | None
    fotograflar: list[FotoYanit]
    created_at: datetime


class KayitListesi(BaseModel):
    kayitlar: list[KayitYanit]


class DogrulamaGirdisi(BaseModel):
    hedef_tur: HedefTuru
    hedef_anahtar: str = Field(min_length=1, max_length=200)
    sonuc: Sonuc
    aciklama: str | None = Field(default=None, max_length=1000)


class DogrulamaKarti(BaseModel):
    """«Uydu haklı mıydı?» kartı: olay, uyarı ya da «doğrulama bekliyor» kaydı + (varsa) çiftçi yanıtı."""

    hedef_tur: HedefTuru
    hedef_anahtar: str
    baslik: str
    tur_grubu: str
    baslangic: date
    bitis: date
    guven: str | None
    durum: Literal["olay", "bekliyor", "suphe", "uyari"]
    olay_id: uuid.UUID | None
    sonuc: Sonuc | None
    aciklama: str | None
    dogrulama_id: uuid.UUID | None
    fotograflar: list[FotoYanit]
    dogrulandi: datetime | None


class DogrulamaListesi(BaseModel):
    kartlar: list[DogrulamaKarti]
    bekleyen: int  # yanıtsız kart sayısı
    not_: str


class TurOzetiYanit(BaseModel):
    tur: str
    ad: str
    gerceklesti: int
    gerceklesmedi: int
    bilinmiyor: int
    bekleyen: int
    dogrulanan: int
    yeterli: bool
    metin: str


class DogrulukOzeti(BaseModel):
    turler: list[TurOzetiYanit]
    asgari_dogrulama: int
    esik_durumu: str
    not_: str


class NoktaKonumu(BaseModel):
    lng: float
    lat: float


class TurNoktasi(BaseModel):
    anahtar: str
    tur: Literal["zayif_kesim", "stres_yamasi", "bekliyor"]
    baslik: str
    neden: str
    lng: float
    lat: float
    sira: int
    mesafe_m: float  # bir önceki noktadan (ilki için başlangıçtan) düz çizgi mesafe
    ziyaret_edildi: bool
    ziyaret_zamani: datetime | None
    kayit_id: uuid.UUID | None
    olay_anahtar: str | None = None


class SahaTuru(BaseModel):
    noktalar: list[TurNoktasi]
    baslangic: NoktaKonumu
    rota: list[list[float]]  # [[boylam, enlem], …] başlangıç + sıralı noktalar (YAKLAŞIK sıra; gerçek yürüyüş yolu değildir)
    toplam_m: float
    sure_dk: int
    ziyaret_edilen: int
    esik_durumu: str
    not_: str


class ZiyaretGirdisi(BaseModel):
    nokta_anahtar: str = Field(min_length=1, max_length=160)
    kayit_id: uuid.UUID | None = None
    ziyaret_edildi: bool = True
