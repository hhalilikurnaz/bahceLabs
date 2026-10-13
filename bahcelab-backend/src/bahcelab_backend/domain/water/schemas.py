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
    normal_alt: float  # bu hücrenin p10'u
    normal_ust: float  # p90
    doluluk: float | None  # «normale göre doluluk» % (p2=0, p98=100)


class NemProfili(BaseModel):
    bugun_tarihi: date | None
    otuz_gun_once_tarihi: date | None
    katmanlar: list[ProfilNoktasi]
    kok_bolgesi_doluluk: float | None  # %
    kok_bolgesi_sinif: Literal["nemli", "orta", "kuru", "bilinmiyor"]
    gecis_gunu: date | None  # ERA5-Land → model geçişinin ilk model günü (yoksa None)
    model_ofset: dict[str, float] | None  # katman başına uygulanan model–ERA5-Land farkı


class DengeGunu(BaseModel):
    tarih: date
    yagis_mm: float | None
    etc_mm: float | None
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


class SicaklikNoktasi(BaseModel):
    tarih: date
    yuzey_bahce_c: float
    yuzey_tampon_c: float | None
    hava_c: float | None
    fark_c: float | None
    stres: bool | None
    karisik_piksel: bool | None
    bahce_tampon_fark_c: float | None


class YuzeyHava(BaseModel):
    noktalar: list[SicaklikNoktasi]
    stres_esigi_c: float
    karisik_piksel_esigi_c: float


class ToprakOzeti(BaseModel):
    kum_yuzde: float | None
    kil_yuzde: float | None
    silt_yuzde: float | None
    organik_karbon_g_kg: float | None
    tarla_kapasitesi: float | None
    solma_noktasi: float | None
    kaynak: str | None


class SuYaniti(BaseModel):
    karar: str
    on_deger: bool  # katalogda «ön değer · mühendis onayı bekliyor»
    profil: NemProfili
    denge: SuDengesi
    sicaklik: YuzeyHava
    toprak: ToprakOzeti
    kaynaklar: dict[str, KaynakCipi]  # profil | denge | sicaklik
    dogrulama: list[str]  # «Nasıl hesaplandı?» kaynak listesi: doğrulama kaynakları (arayüzde gösterilmez)
