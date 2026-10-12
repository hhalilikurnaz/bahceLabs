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
    degisim_yuzde: float | None = None  # negatif: düşüş (ham değişim)
    # Mevsim normu (skorla aynı): geçen yıl aynı dönem ya da bahçenin kendi son günleri
    norm_degeri: float | None = None
    norm_kaynagi: str | None = None
    beklenen_degisim_yuzde: float | None = None  # normun aynı aralıktaki beklenen (mevsimsel) değişimi
    normdan_sapma_yuzde: float | None = None  # son değerin normdan sapması (negatif: altında)


class TipikBantBilgi(BaseModel):
    alt: float
    ust: float
    durum: Literal["dogrulanmadi", "muhendis_onayli"]  # «ön değer · mühendis onayı bekliyor» rozeti için


class IndeksYanit(BaseModel):
    gozlemler: list[SahneGozlemi]
    tipik_bantlar: dict[str, TipikBantBilgi] = {}  # ürünün indeks başına tipik aralığı (ön değer)
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


class ArsivSahne(BaseModel):
    tarih: date
    durum: Literal["tamam", "bulutlu"]
    deger: float | None  # seçili parametrenin bahçe ortalaması (bulutlu / gerçek renk için yok)
    bulut_orani: float | None
    gecerli_piksel_orani: float
    net: bool  # bulut oranı eşiğin altında
    en_net: bool  # ayın en net görüntüsü
    kucuk_resim_url: str | None
    ham_veri_var: bool  # değişim haritası ve karşılaştırma için ızgara hazır


class ArsivYanit(BaseModel):
    parametre: str
    sezon: int
    sezonlar: list[int]
    toplam: int
    net_sayisi: int
    bulutlu_sayisi: int
    sayfa: int
    boyut: int
    sayfa_sayisi: int
    sahneler: list[ArsivSahne]
