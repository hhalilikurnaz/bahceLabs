from datetime import date
from typing import Literal

from pydantic import BaseModel


class KaynakCipi(BaseModel):
    """Grafikteki kaynak çipi: kaynak · çözünürlük · tarih."""

    ad: str
    cozunurluk: str
    tarih: date | None
    not_: str | None = None  # ör. «geçiş günü», «model tahmini», «ön değer»


class ProfilNoktasi(BaseModel):
    derinlik: str  # «0–7 cm»
    bugun: float | None  # m³/m³ (ERA5-Land ya da model)
    bugun_kaynak: Literal["era5_land", "model", "yok"]
    otuz_gun_once: float | None
    normal_alt: float  # AYNI DÖNEMİN (±15 gün, 2015–2025) p10'u
    normal_ust: float  # p90
    doluluk: float | None  # «dönem normaline göre doluluk» % (dönem p2 = 0, p98 = 100)


class NemProfili(BaseModel):
    bugun_tarihi: date | None
    otuz_gun_once_tarihi: date | None
    katmanlar: list[ProfilNoktasi]
    kok_bolgesi_doluluk: float | None  # %
    kok_bolgesi_sinif: Literal["nemli", "orta", "kuru", "bilinmiyor"]
    gecis_gunu: date | None  # ERA5-Land → model geçişinin ilk model günü (yoksa None)
    model_ofset: dict[str, float] | None  # katman başına uygulanan model–ERA5-Land farkı
    donem: str | None = None  # «Ekim»: doluluk ve normal aralık bu ayın ±15 günüyle karşılaştırılır
    donem_pencere_gun: int = 15


class DengeGunu(BaseModel):
    tarih: date
    yagis_mm: float | None
    etc_mm: float | None
    etkili_yagis_mm: float | None  # dengede sayılan yağış (günlük eşiğin altı 0)
    tukenme_mm: float | None
    birikimli_mm: float | None
    tahmin: bool
    yagis_kaynagi: Literal["era5", "imerg", "model", "yok"]
    veri_eksik: bool


class SuDengesi(BaseModel):
    taw_mm: float | None  # kullanılabilir su kapasitesi (kök bölgesi)
    tukenme_esigi_mm: float | None  # RAW: stres eşiği
    gunler: list[DengeGunu]
    yagis_kaynagi: Literal["era5", "imerg"]
    yagis_karari: str  # ERA5/IMERG seçim gerekçesi
    kc_notu: str


class SicaklikNormali(BaseModel):
    alt_c: float  # bahçenin aynı ay geçmişinde yüzey − hava farkı p25
    ortanca_c: float
    ust_c: float  # p75
    sahne: int


class SicaklikNoktasi(BaseModel):
    tarih: date
    ay: str  # «Eylül»
    yuzey_bahce_c: float
    yuzey_tampon_c: float | None
    hava_c: float | None
    fark_c: float | None
    normal: SicaklikNormali | None
    sapma_c: float | None  # fark − aynı ay ortancası
    durum: Literal["ustunde", "icinde", "altinda", "yetersiz_gecmis", "bilinmiyor"]
    stres: bool | None  # yalnız bandın üstünde ve karışık piksel değilken
    karisik_piksel: bool | None
    bahce_tampon_fark_c: float | None


class YuzeyHava(BaseModel):
    noktalar: list[SicaklikNoktasi]
    karisik_piksel_esigi_c: float
    normal_alt_yuzde: float
    normal_ust_yuzde: float
    min_sahne: int


class ToprakOzeti(BaseModel):
    kum_yuzde: float | None
    kil_yuzde: float | None
    silt_yuzde: float | None
    organik_karbon_g_kg: float | None
    tarla_kapasitesi: float | None
    solma_noktasi: float | None
    kaynak: str | None


class SulamaKarari(BaseModel):
    """TEK sulama kararı: Su sekmesi ve Hava sekmesindeki sulama kartı bu nesneyi gösterir."""

    durum: Literal["sulama", "izle", "gerekmiyor", "veri_yok"]
    gerekli: bool
    cumle: str
    doluluk: float | None  # mevsim normaline göre kök bölgesi doluluğu %
    donem: str | None
    ihtiyac_mm: float | None


class SuYaniti(BaseModel):
    karar: str
    karar_detay: SulamaKarari
    on_deger: bool  # katalogda «ön değer · mühendis onayı bekliyor»
    profil: NemProfili
    denge: SuDengesi
    sicaklik: YuzeyHava
    toprak: ToprakOzeti
    kaynaklar: dict[str, KaynakCipi]  # profil | denge | sicaklik
    dogrulama: list[str]  # «Nasıl hesaplandı?» kaynak listesi: doğrulama kaynakları (arayüzde gösterilmez)
