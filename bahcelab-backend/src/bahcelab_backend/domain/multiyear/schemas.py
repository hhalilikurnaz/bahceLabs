from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class BaslatIstegi(BaseModel):
    bolge_sayisi: Literal[3, 5] = 3


class YilDurumu(BaseModel):
    yil: int
    durum: Literal["bekliyor", "isleniyor", "tamam", "hata"]
    sahne_sayisi: int
    aday_sayisi: int
    kismi: bool
    hata_mesaji: str | None
    sure_saniye: float | None


class CokYillikDurum(BaseModel):
    """İlerleme: «2021 işleniyor · 4/8 yıl»."""

    durum: Literal["yok", "isleniyor", "tamam", "hata"]
    yillar: list[YilDurumu]
    tamamlanan: int
    toplam: int
    arsiv_baslangic: date | None
    baslangic_yili: int | None
    bitis_yili: int | None
    saglayici: str | None
    aktif_yil: int | None = None
    mesaj: str | None = None


class YilBilgisi(BaseModel):
    yil: int
    sahne_sayisi: int
    kismi: bool
    kapsam: float | None
    korelasyon: float | None
    uyumsuz: bool
    uyumsuz_nedeni: str | None
    yetersiz_veri: bool = False  # net sahne/dönem kapsamı eşiğin altında: kompozitte görünür, analize girmez, uyumsuzluk sorulmaz
    yetersiz_nedeni: str | None = None
    net_gun_sayisi: int | None = None
    donem_kapsami: float | None = None  # net sahne olan 10 günlük dönemlerin payı (0–1)
    aday_sayisi: int = 0
    dahil: bool  # sonuçta kullanıldı mı
    elle: bool | None  # kullanıcı seçimi (None = otomatik)


class BolgeOzeti(BaseModel):
    sinif: int
    ad: str
    alan_m2: float
    alan_dekar: float
    pay: float
    fark_yuzde: float | None
    istikrar: float | None
    istikrar_sinifi: Literal["yuksek", "orta", "dusuk"] | None
    kontrol_onerisi: bool  # yalnız anlamlı ve istikrarlı zayıf bölgede


class CokYillikSonuc(BaseModel):
    durum: Literal["hazir", "islem_suruyor", "yetersiz", "yok"]
    mesaj: str | None
    bolge_sayisi: int
    versiyon: int | None
    hesaplama: datetime | None
    yil_araligi: str | None
    yillar: list[YilBilgisi]
    bolgeler: dict[str, Any] | None = Field(description="GeoJSON FeatureCollection (EPSG:4326); properties = BolgeOzeti")
    istikrar: dict[str, Any] | None = Field(description="GeoJSON FeatureCollection: istikrar sınıfı poligonları")
    ozet: list[BolgeOzeti]
    homojen: bool
    yayilim_yuzde: float | None
    yorumlar: list[str]
    not_: str


class YilSecimi(BaseModel):
    yil: int
    dahil: bool | None = Field(description="true/false = elle seçim, null = otomatiğe dön")


class YillarGuncelle(BaseModel):
    yillar: list[YilSecimi] = Field(min_length=1, max_length=40)
    bolge_sayisi: Literal[3, 5] = 3


class YilDegerleri(BaseModel):
    """Bir yılın kompoziti: bahçe penceresi ızgarası (satır sırasıyla, geçersiz/bahçe dışı = null). Küçük harita, dağılım ve ridgeline için."""

    yil: int
    satir: int
    sutun: int
    koordinatlar: list[list[float]]  # KB, KD, GD, GB [boylam, enlem]
    degerler: list[float | None]
    indeks: str = "ndvi"
