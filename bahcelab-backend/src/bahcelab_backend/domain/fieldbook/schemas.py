import uuid
from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

KayitTuru = Literal["gozlem", "ilaclama", "gubreleme", "sulama", "hasat", "tuzak", "yagis"]
YAGIS_AZAMI_MM = 500.0  # tek günlük ölçüm üst sınırı (daha büyüğü yazım hatası sayılır)


def yagis_mm(ayrinti: dict[str, Any] | None) -> float:
    """«Yağış ölçümü» kaydının mm değeri: `ayrinti.mm` sayı, 0 ≤ mm ≤ 500. Aksi hâlde ValueError."""
    v = (ayrinti or {}).get("mm")
    if isinstance(v, bool) or not isinstance(v, (int, float)) or not 0 <= v <= YAGIS_AZAMI_MM:
        raise ValueError(f"Yağış ölçümü için 0–{YAGIS_AZAMI_MM:.0f} mm arası bir değer (ayrinti.mm) gerekir.")
    return float(v)
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


class GozlemGirdisi(BaseModel):
    """Etiketli gözlem (ADR 0034): kategori/etiket/şiddet/yaygınlık katalogdan (`gunluk`) doğrulanır; vana bahçeye ait olmalı."""

    kategori: str = Field(min_length=1, max_length=20)
    etiket: str = Field(min_length=1, max_length=32)
    siddet: str | None = None
    yayginlik: str | None = None
    sector_id: uuid.UUID | None = None
    konum_dogruluk_m: float | None = Field(default=None, ge=0, le=100_000)  # GPS doğruluğu; haritadan seçimde yok


class GozlemYanit(BaseModel):
    kategori: str
    kategori_ad: str
    etiket: str
    etiket_ad: str
    siddet: str | None
    siddet_ad: str | None
    yayginlik: str | None
    yayginlik_ad: str | None
    sector_id: uuid.UUID | None
    kaynak: Literal["kullanici", "sistem"]
    iliski_anahtar: str | None
    konum_dogruluk_m: float | None


class KayitGirdisi(BaseModel):
    tur: KayitTuru
    tarih: date
    konum: dict[str, Any] | None = Field(default=None, description="GeoJSON Point (nokta) ya da Polygon (alan); bahçeye en çok 500 m uzaklıkta olmalı")
    aciklama: str | None = Field(default=None, max_length=1000)
    ayrinti: dict[str, Any] | None = None
    gozlem: GozlemGirdisi | None = None  # yalnız tur = gozlem

    @field_validator("aciklama")
    @classmethod
    def _strip(cls, v: str | None) -> str | None:
        return (v.strip() or None) if v is not None else None

    @model_validator(mode="after")
    def _yagis(self) -> "KayitGirdisi":
        if self.tur == "yagis":
            yagis_mm(self.ayrinti)
        return self


class KayitGuncelle(BaseModel):
    tur: KayitTuru | None = None
    tarih: date | None = None
    konum: dict[str, Any] | None = None
    aciklama: str | None = Field(default=None, max_length=1000)
    ayrinti: dict[str, Any] | None = None
    konumu_sil: bool = False
    gozlem: GozlemGirdisi | None = None


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
    gozlem: GozlemYanit | None = None


class KayitListesi(BaseModel):
    kayitlar: list[KayitYanit]


class DogrulamaGirdisi(BaseModel):
    hedef_tur: HedefTuru
    hedef_anahtar: str = Field(min_length=1, max_length=200)
    sonuc: Sonuc
    aciklama: str | None = Field(default=None, max_length=1000)


class KanitYanit(BaseModel):
    kaynak: Literal["istasyon", "dis_kayit"]
    yon: Literal["destek", "celisme", "sinirda"]
    metin: str
    baglanti: str | None
    il_duzeyi: bool = False


class OnYargiYanit(BaseModel):
    """Bağımsız kaynaklardan ön yargı (çiftçi yargısının YERİNE GEÇMEZ). Olay motorunun kendi girdileri (ERA5, S2, HLS, radar) kanıt sayılmaz."""

    sonuc: Literal["destekleniyor", "celisiyor", "belirsiz", "kanit_yok"]
    kanitlar: list[KanitYanit]
    neden: str


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
    on_yargi: OnYargiYanit | None = None  # yalnız olay kartlarında


class DogrulamaListesi(BaseModel):
    kartlar: list[DogrulamaKarti]
    bekleyen: int  # yanıtsız kart sayısı
    dogrulanacak: int  # yanıtsız VE ön yargısı «çelişiyor», «belirsiz» ya da «kanıt yok» olan olay sayısı (üretici yalnız bunlara bakar)
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
    dis_destekleniyor: int = 0  # ikinci, AYRI sayı: bağımsız kaynakların ön yargısı
    dis_celisiyor: int = 0
    dis_belirsiz: int = 0
    dis_kanit_yok: int = 0
    dis_metin: str = ""


class DogrulukOzeti(BaseModel):
    turler: list[TurOzetiYanit]
    asgari_dogrulama: int
    esik_durumu: str
    not_: str


class NoktaKonumu(BaseModel):
    lng: float
    lat: float


class KontrolMaddesi(BaseModel):
    metin: str
    kaynak: str | None = None
    url: str | None = None


class KontrolGrubu(BaseModel):
    sebep: str
    ad: str
    maddeler: list[KontrolMaddesi]


class TurNoktasi(BaseModel):
    anahtar: str
    tur: Literal["zayif_kesim", "stres_yamasi", "bekliyor", "sebep_belirsiz"]
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
    olay_id: uuid.UUID | None = None  # sebep_belirsiz: «Sebep buydu» yanıtı bu olaya yazılır
    kontrol: list[KontrolGrubu] | None = None  # sebep_belirsiz: «Sahada şunlara bakın» maddeleri (katalog sebep.kontrol_listesi)


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


class SozlukEtiket(BaseModel):
    kod: str
    ad: str


class SozlukKategori(BaseModel):
    kod: str
    ad: str
    siddet_zorunlu: bool
    etiketler: list[SozlukEtiket]


class GunlukSozlugu(BaseModel):
    """Gözlem sözlüğü (katalog `gunluk`; ön değer · mühendis onayı bekliyor): arayüz etiket seçeneklerini buradan alır, kod içine gömmez."""

    surum: str
    durum: str
    kategoriler: list[SozlukKategori]
    siddet: list[SozlukEtiket]
    yayginlik: list[SozlukEtiket]
    foto_uzun_kenar_px: int  # istemcide küçültme hedefi (uzun kenar)
    foto_hedef_bayt: int  # istemci çıktısı için hedef boyut
