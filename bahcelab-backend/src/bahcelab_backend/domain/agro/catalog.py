"""Ürün/çeşit kataloğu yükleyici: `rules/katalog.yaml` (sürümlü) → doğrulanmış modeller.

Tarımsal hiçbir sabit kodda yoktur. Her blok (fenoloji, Kc, GDD) kendi `durum` ve `kaynak` alanını taşır;
`dogrulanmadi` değerler arayüzde "ön değer – ziraat mühendisi onayı bekleniyor" rozetiyle gösterilir.
"""

from __future__ import annotations

import re
import unicodedata
from datetime import date
from functools import lru_cache
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, Field, model_validator

RULES_DIR = Path(__file__).parent / "rules"
CATALOG_FILE = RULES_DIR / "katalog.yaml"

KuralDurumu = Literal["dogrulanmadi", "muhendis_onayli"]
_MMDD = re.compile(r"^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$")


class KuralBlok(BaseModel):
    """Her kuralın ortak alanları: doğrulama durumu ve kaynak notu."""

    durum: KuralDurumu
    kaynak: str = Field(min_length=1)
    onaylayan: str | None = None
    onay_tarihi: date | None = None

    @model_validator(mode="after")
    def _approved_needs_owner(self) -> KuralBlok:
        if self.durum == "muhendis_onayli" and not (self.onaylayan and self.onay_tarihi):
            raise ValueError("Mühendis onaylı kuralda 'onaylayan' ve 'onay_tarihi' zorunludur.")
        return self


class EvreTanimi(BaseModel):
    kod: str
    ad: str
    baslangic: str  # AA-GG
    bitis: str

    @model_validator(mode="after")
    def _dates(self) -> EvreTanimi:
        for value in (self.baslangic, self.bitis):
            if not _MMDD.match(value):
                raise ValueError(f"Evre tarihi 'AA-GG' biçiminde olmalı: {value}")
        return self


class FenolojiKurali(KuralBlok):
    evreler: list[EvreTanimi]


class KcKurali(KuralBlok):
    degerler: dict[str, float]


class GddKurali(KuralBlok):
    taban_c: float


class AnalizPenceresi(KuralBlok):
    """Yıllık kompozit penceresi: bu aylardaki net sahnelerin piksel medyanı alınır."""

    ay_baslangic: int = Field(ge=1, le=12)
    ay_bitis: int = Field(ge=1, le=12)
    indeks: str = "ndvi"
    # Yıl veri yeterliliği (ön değer): eşik altındaki yıl «yetersiz veri» olur; kompozitte görünür ama analize girmez
    en_az_net_sahne: int = Field(default=3, ge=1)
    en_az_ay_kapsami: float = Field(default=0.75, ge=0, le=1)  # penceredeki ayların en az bu payında net sahne olmalı

    @model_validator(mode="after")
    def _ordered(self) -> AnalizPenceresi:
        if self.ay_baslangic > self.ay_bitis:
            raise ValueError("Analiz penceresi yıl sonunu aşamaz (başlangıç ayı ≤ bitiş ayı).")
        return self


class TipikBant(KuralBlok):
    """Bir indeksin bu ürün için tipik aralığı (ön değer): histogram lejantında bağlam olarak gösterilir; karar kuralı değildir."""

    alt: float
    ust: float

    @model_validator(mode="after")
    def _ordered(self) -> TipikBant:
        if self.alt >= self.ust:
            raise ValueError("Tipik bantta alt değer üst değerden küçük olmalı.")
        return self


class Cesit(BaseModel):
    kod: str
    ad: str
    aliaslar: list[str] = []
    # Çeşit düzeyinde ayrı değer girilirse ürün değerlerinin yerine geçer
    fenoloji: FenolojiKurali | None = None
    kc: KcKurali | None = None
    gdd: GddKurali | None = None
    not_: str | None = Field(default=None, alias="not")


class Urun(BaseModel):
    ad: str
    fenoloji: FenolojiKurali | None = None
    kc: KcKurali | None = None
    gdd: GddKurali | None = None
    analiz_penceresi: AnalizPenceresi | None = None
    tipik_bantlar: dict[str, TipikBant] = {}
    cesitler: list[Cesit]


class NormalBant(KuralBlok):
    """Normal bant (gösterge × ay) asgari yıl şartları (ön değer): altında «yetersiz geçmiş»; yüzdelikler gösterilmez."""

    asgari_yil_ceyrek: int = Field(ge=2)  # p25–p75 (ve ortanca)
    asgari_yil_onluk: int = Field(ge=2)  # p10–p90
    ilk_yil: int = 2015

    @model_validator(mode="after")
    def _ordered(self) -> NormalBant:
        if self.asgari_yil_onluk < self.asgari_yil_ceyrek:
            raise ValueError("p10–p90 için gereken yıl, p25–p75 için gerekenden az olamaz.")
        return self


class RadarKurali(KuralBlok):
    """Sentinel-1 radar (ADR 0016): maske, kumlanma filtresi ve değişim eşikleri (hepsi ön değer; mühendis onayı bekler)."""

    golge_vh_alt_db: float = -30.0  # VH bunun altındaysa gölge/geçersiz sayılır (RTC'de gölge-üst üste binme bandı yok: vekil)
    ust_uste_vv_ust_db: float = 5.0  # VV bunun üstündeyse üst üste binme/doygunluk sayılır
    lee_pencere: int = Field(default=5, ge=3)
    lee_bakis: float = Field(default=4.4, gt=0)  # eşdeğer bakış sayısı (STAC: sar:looks_equivalent_number)
    azami_maske_orani: float = Field(default=0.30, ge=0, le=1)  # bahçenin bundan fazlası maskeliyse sahne değişim hesabına girmez
    anlamli_degisim_db: float = Field(default=2.0, gt=0)  # |Δ| eşiği
    anlamli_alan_orani: float = Field(default=0.25, ge=0, le=1)  # alanın en az bu payı eşiği aşmalı
    anlamli_alan_min_da: float = Field(default=2.0, gt=0)  # …ya da eşiği aşan alan en az bu kadar dönüm (büyük bahçede pay yerine mutlak alan)
    alan_birlesim: Literal["veya", "ve"] = "ve"  # pay ile mutlak alan: «veya» = biri yeterli, «ve» = ikisi birden
    alan_kurali: Literal["pay", "bitisik"] = "bitisik"  # pay: toplam alan; bitisik: en büyük bağlı bileşen ≥ min(pay × bahçe, bitisik_alan_min_da)
    bitisik_alan_min_da: float = Field(default=5.0, gt=0)
    yagis_penceresi_saat: int = Field(default=48, ge=1)  # önceki bu kadar saatte yağış → «ıslaklık olabilir»
    yagis_esigi_mm: float = Field(default=1.0, ge=0)
    ani_baseline_sahne: int = Field(default=3, ge=2)  # ani değişim: son sahne, aynı yörüngedeki bu kadar önceki sahnenin ortancasıyla karşılaştırılır
    delta_yumusatma: int = Field(default=3, ge=1)  # piksel farkı bu boyutlu pencerede ortalanır (kumlanma gürültüsü); 1 = kapalı
    art_arda_sahne: int = Field(default=2, ge=2)  # tek sahnelik sıçrama gürültüdür; bu kadar ardışık sahnede aynı yönde sürerse olay adayı


class SuKurali(KuralBlok):
    """Su ve sıcaklık dilimi (ADR 0017): hepsi ön değer · mühendis onayı bekliyor. Toprak eşikleri ERA5 mutlak nemine UYGULANMAZ."""

    # Kc: NDVI'dan doğrusal ilişki (narenciye, örtü yoğunluğu arttıkça Kc artar)
    kc_ndvi_alt: float = 0.30
    kc_ndvi_ust: float = 0.80
    kc_alt: float = 0.45
    kc_ust: float = 0.75
    kok_derinligi_cm: float = Field(default=80.0, gt=0)  # etkin kök bölgesi (kullanılabilir su kovası)
    tukenme_orani: float = Field(default=0.5, gt=0, lt=1)  # RAW/TAW: bitki stresi başlamadan tüketilebilen pay (narenciye ≈ 0,5)
    gecmis_gun: int = Field(default=30, ge=7)
    tahmin_gun: int = Field(default=7, ge=1)
    # Normale göre doluluk: her katman için ERA5-Land'in AYNI DÖNEMİ (±klima_pencere_gün, 2015–2025); p_alt = 0, p_ust = 100
    klima_pencere_gun: int = Field(default=15, ge=1, le=60)
    klima_p_alt: float = 2.0
    klima_p_ust: float = 98.0
    normal_aralik_alt: float = 10.0  # «dönem normal aralığı»
    normal_aralik_ust: float = 90.0
    klima_ilk_yil: int = 2015
    klima_son_yil: int = 2025
    kok_katman_agirliklari: tuple[float, float, float, float] = (15.0, 35.0, 50.0, 0.0)  # kök DAĞILIMI (kalınlık değil): 0–7, 7–28, 28–100, 100–255 cm; ön değer · mühendis onayı bekliyor
    doluluk_nemli_min: float = Field(default=60.0, ge=0, le=100)  # «normale göre doluluk» ≥ bu: nemli
    doluluk_kuru_max: float = Field(default=35.0, ge=0, le=100)  # ≤ bu: kuru
    kucuk_yagis_esigi_mm: float = Field(default=2.0, ge=0)  # günlük yağış bunun altındaysa su dengesinde sayılmaz (etkili yağış)
    # Yüzey–hava sıcaklık farkı (Landsat geçişi ≈ 11:00 yerel): bahçenin AYNI AY Landsat geçmişine göre p25–p75 bandı; sabit eşik yok
    sicaklik_normal_alt: float = 25.0
    sicaklik_normal_ust: float = 75.0
    sicaklik_belirgin_alt: float = 10.0  # p10 altı / p90 üstü: «belirgin» (her bileşende aynı etiket kuralı)
    sicaklik_belirgin_ust: float = 90.0
    sicaklik_min_sahne: int = Field(default=8, ge=3)  # aynı ayda bundan az geçmiş sahne varsa «yetersiz geçmiş»
    karisik_piksel_c: float = 1.5  # |bahçe − tampon| bunu aşarsa «karışık piksel»
    landsat_gecis_saati: int = 11  # yerel saat; hava sıcaklığı bu saatin ERA5 değeri


class TarifeKurali(BaseModel):
    """EPDK tarımsal sulama tarifesi girdisi. `birim_fiyat_tl_kwh` None ise tarife DOĞRULANMAMIŞTIR: arayüz sayı uydurmaz, kullanıcıdan fatura fiyatını ister."""

    ad: str
    kaynak_url: str
    gecerlilik_baslangic: date | None = None
    gecerlilik_bitis: date | None = None
    birim_fiyat_tl_kwh: float | None = Field(default=None, ge=0)


class KisitliSulamaDonemi(BaseModel):
    kod: str
    ad: str
    baslangic: str  # "AA-GG"
    bitis: str
    durum: Literal["onayli", "kilitli"]  # onayli: kısıntı önerilebilir; kilitli: «bu dönemde önerilmez»
    oran: float | None = Field(default=None, gt=0, le=1)  # onayli dönemde uygulanacak su payı (tam plana göre)
    verim_riski: Literal["dusuk", "orta", "yuksek"]


class SistemProgrami(BaseModel):
    """Sulama sistemi başına program: sık-az (damla) ile seyrek-çok (salma) farkı. Tetik = oran × RAW; tek seferde en çok `azami_net_mm`, en az `en_az_net_mm` (net)."""

    tetik_orani: float = Field(gt=0, le=1)
    azami_net_mm: float = Field(gt=0)
    en_az_net_mm: float = Field(gt=0)


class SulamaPlaniKurali(KuralBlok):
    """Sulama planı (ADR 0023): FAO-56 günlük su dengesi katsayıları. Hepsi ön değer · mühendis onayı bekliyor."""

    # FAO-56 Tablo 12, narenciye, yer örtüsüz: taç örtüsü sınıfı (%) → Kc [ini, mid, end]
    kc_orten_siniflari: list[float] = [20.0, 50.0, 70.0]
    kc_tablo: dict[str, tuple[float, float, float]] = {"20": (0.50, 0.45, 0.55), "50": (0.65, 0.60, 0.65), "70": (0.70, 0.65, 0.70)}
    # ay (1–12) → [ini, mid, end] ağırlığı; aylık Kc = Σ ağırlık × Kc[evre]
    kc_ay_agirliklari: list[tuple[float, float, float]] = [
        (1, 0, 0), (1, 0, 0), (0.83, 0.17, 0), (0.5, 0.5, 0), (0.17, 0.83, 0), (0, 1, 0),
        (0, 1, 0), (0, 1, 0), (0, 1, 0), (0, 0.5, 0.5), (0, 0, 1), (0, 0, 1),
    ]
    # taç örtüsü (fCOVER) NDVI'dan: fc = ((NDVI − alt)/(üst − alt))^üs · 100 (Carlson & Ripley), sınırlar kırpılır
    orten_ndvi_alt: float = 0.30
    orten_ndvi_ust: float = 0.85
    orten_ndvi_us: float = 1.0
    tukenme_orani_p: float = Field(default=0.5, gt=0, lt=1)
    kok_derinligi_cm: float = Field(default=80.0, gt=0)
    etkili_yagis_yontemi: Literal["esik"] = "esik"  # günlük eşik + oran; başka yöntem eklenirse katalog sürümü artar
    etkili_yagis_esik_mm: float = Field(default=2.0, ge=0)  # günlük bunun altı sayılmaz
    etkili_yagis_oran: float = Field(default=0.8, gt=0, le=1)  # üstü bu oranda kök bölgesine girer (yüzey akışı/derine sızma payı)
    # sistem verimi (net/brüt)
    sistem_verimi: dict[str, float] = {"damla": 0.90, "mini_yagmurlama": 0.80, "salma": 0.55}
    ilk_nem_sapma_uyari_mm: float = Field(default=15.0, gt=0)  # uydu/ERA5 nemi ile kova arasındaki fark bunu aşarsa uyarı
    agac_sayisi_tolerans: float = Field(default=0.15, gt=0, lt=1)  # beyan ile alan/aralık beklentisi arası göreli fark
    sistem_programi: dict[str, SistemProgrami]
    # Toprak suyu durum bantları (kullanılabilir su % = (TAW − Dr) / TAW): stres < alt · yakın alt–yakın_ust · yeterli yakın_ust–yeterli_ust · dolu ≥ yeterli_ust
    durum_stres_alt: float = 50.0
    durum_yakin_ust: float = 70.0
    durum_yeterli_ust: float = 97.0
    ihtiyac_yesil_min: float = 95.0  # ΣETa/ΣETc (son 7 gün) ≥ yeşil; ≥ sarı sarı; altı kırmızı
    ihtiyac_sari_min: float = 85.0
    yagis_vurgu_mm: float = 12.0  # su dengesi grafiğinde bu yağış üstü ok ile işaretlenir
    vardiya_baslangic: str = "05:00"  # çizelge başlangıcı (profilde değiştirilebilir)
    aliskanlik_min_kayit: int = Field(default=4, ge=2)  # «Alışkanlığım» için Saha Defteri'nde en az bu kadar sulama kaydı
    # Güven etiketi: 5 koşuldan kaçı sağlanıyor → düşük / orta / yüksek (kural ADR 0024)
    guven_ndvi_taze_gun: int = Field(default=14, ge=1)
    guven_hava_taze_gun: int = Field(default=3, ge=0)
    guven_orta_min: int = Field(default=3, ge=1)
    guven_yuksek_min: int = Field(default=5, ge=1)
    tetik_alt_siniri: float = Field(default=0.8, gt=0, le=1)  # kova RAW'a bu orandan önce sulama ÖNERİLMEZ (sık-az damla dahil)
    planlama_gun: int = Field(default=10, ge=7, le=14)
    sapma_bildirim_mm: float = Field(default=20.0, gt=0)  # uygulanan − planlanan (son 14 gün) bunu aşarsa «plandan ciddi sapma»
    yaklasma_gun: int = Field(default=1, ge=0, le=3)  # «sulama günü yaklaştı» kaç gün önce
    sezon_baslangic: str = "04-01"
    sezon_bitis: str = "10-31"
    projeksiyon_alt: float = 10.0
    projeksiyon_ust: float = 90.0
    gecmis_ilk_yil: int = 2015
    gecmis_son_yil: int = 2025
    kisitli_donemler: list[KisitliSulamaDonemi] = []
    tarife: TarifeKurali

    @model_validator(mode="after")
    def _tablo(self) -> SulamaPlaniKurali:
        if set(self.kc_tablo) != {str(int(c)) for c in self.kc_orten_siniflari}:
            raise ValueError("Kc tablosu taç örtüsü sınıflarıyla aynı olmalı.")
        for ad, prog in self.sistem_programi.items():
            if prog.tetik_orani < self.tetik_alt_siniri:
                raise ValueError(f"{ad}: tetik oranı {prog.tetik_orani}, alt sınır {self.tetik_alt_siniri}'in altında (kova RAW'a yaklaşmadan sulama önerilmez).")
        if set(self.sistem_programi) != set(self.sistem_verimi):
            raise ValueError("Sistem programı ve sistem verimi aynı sistemleri içermeli.")
        if len(self.kc_ay_agirliklari) != 12 or any(abs(sum(w) - 1) > 1e-6 for w in self.kc_ay_agirliklari):
            raise ValueError("Kc ay ağırlıkları 12 ay ve her ay toplamı 1 olmalı.")
        return self


class DurumV2Kurali(KuralBlok):
    """Durum v2 (ADR 0018): bileşen ağırlıkları, bahçenin KENDİ dönem normuna göre ceza eşikleri ve kademe sınırları. Hepsi «ön değer · v2»."""

    w_agac_gucu: float = 0.35
    w_su: float = 0.25
    w_beslenme: float = 0.20
    w_ani_degisim: float = 0.10
    w_isi: float = 0.10
    z_tolerans: float = Field(default=1.0, gt=0)  # ortanca/MAD sapması bu değere kadar ceza yok (yalnız aşağı yön)
    z_sifir: float = Field(default=3.0, gt=0)  # bu sapmada bileşen puanı 0
    sigma_taban_ndvi: float = 0.03  # MAD'den türeyen ölçek (1,4826·MAD) bunun altına inmez: dar geçmişte küçük oynama büyük ceza olmasın
    sigma_taban_ndmi: float = 0.03
    sigma_taban_ndre: float = 0.02
    asgari_ornek: int = Field(default=12, ge=4)  # aynı takvim ayında en az bu kadar geçmiş sahne; yoksa bileşen «yetersiz geçmiş»
    doluluk_normal_min: float = 40.0  # dönem normaline göre kök bölgesi doluluğu ≥ bu: ceza yok
    doluluk_sifir: float = 10.0  # ≤ bu: puan 0
    isi_sifir_c: float = 3.0  # aynı ay bandının üstünde bu kadar °C sapmada ısı puanı 0
    bant_belirgin_alt: float = 10.0  # ETİKET kuralı (tüm bileşenler): p25–p75 normal · p10–p25 / p75–p90 normalin altı/üstü · <p10 / >p90 belirgin
    bant_normal_alt: float = 25.0
    bant_normal_ust: float = 75.0
    bant_belirgin_ust: float = 90.0
    ani_pencere_gun: int = 30  # ani değişim bileşeni son bu kadar günün olaylarına bakar
    ani_s2_puan: int = 40
    ani_radar_puan: int = 60
    ani_ikisi_puan: int = 30
    bayat_s2_gun: int = 15
    bayat_landsat_gun: int = 30
    min_toplam_agirlik: float = 0.40  # kullanılabilir ağırlık bunun altındaysa kademe «veri yok» (yalnız risk/uyarı)
    iyi_min: int = 85
    izle_min: int = 70
    dikkat_min: int = 50
    bilesen_normal_min: int = 90
    bilesen_belirgin_dusuk_max: int = 49

    @model_validator(mode="after")
    def _weights(self) -> DurumV2Kurali:
        if abs(self.w_agac_gucu + self.w_su + self.w_beslenme + self.w_ani_degisim + self.w_isi - 1.0) > 1e-6:
            raise ValueError("Durum v2 ağırlıkları toplamı 1 olmalı.")
        if not (self.iyi_min > self.izle_min > self.dikkat_min):
            raise ValueError("Durum v2 kademe sınırları azalan sırada olmalı.")
        return self


class OlayKurali(KuralBlok):
    """Olay motoru (ADR 0018): kaynak eşikleri, birleştirme ve güven kuralı. Hepsi ön değer · mühendis onayı bekliyor."""

    s2_ndvi_dusus: float = Field(default=0.08, gt=0)  # NDVI'da son net görüntüye göre düşüş (piksel)
    s2_alan_orani: float = Field(default=0.25, ge=0, le=1)  # en büyük bitişik yama ≥ min(pay × bahçe, s2_alan_min_da)
    s2_alan_min_da: float = Field(default=5.0, gt=0)
    s2_yumusatma: int = Field(default=3, ge=1)
    s2_azami_aralik_gun: int = Field(default=30, ge=1)  # iki net görüntü arası bundan uzunsa mevsimsel değişim olay sayılmaz
    s2_pencere_gun: int = Field(default=15, ge=1)  # mevsimden arındırma: piksel, DİĞER yılların aynı ±gün penceresindeki kendi dağılımıyla kıyaslanır
    s2_normal_alt_yuzde: float = Field(default=10.0, gt=0, lt=50)  # düşüş, pikselin dönem p10'unun ALTINA inmeli (Δ tek başına yetmez)
    s2_min_ornek: int = Field(default=8, ge=3)  # pikselin dönem dağılımı için en az örnek; yoksa piksel değerlendirilmez
    s2_kalicilik_orani: float = Field(default=0.5, ge=0, le=1)  # sonraki net görüntüde yama piksellerinin en az bu payı hâlâ p10 altında olmalı
    s2_tum_bahce_orani: float = Field(default=0.90, ge=0, le=1)  # bahçenin bundan fazlası düşüyorsa hava/radar desteği şart
    s2_destek_gun: int = Field(default=5, ge=0)  # destek sinyali ±bu kadar gün içinde olmalı
    don_hasar_gun: int = Field(default=21, ge=0)  # ASİMETRİK pencere: don olayından sonra 0..+bu kadar gün içinde başlayabilen S2 düşüşü aynı olaya bağlanır («don + optik hasar izi»)
    anomali_min_ornek: int = Field(default=5, ge=3)  # DONA BAĞLI değişim anomalisi: diğer yıllarda aynı pencerede en az bu kadar ardışık görüntü çifti Δ'sı
    anomali_kalicilik_orani: float = Field(default=0.5, ge=0, le=1)  # bir sonraki net görüntüde bahçe ortancası düşüşün en az bu payı kadar düşük kalmalı
    don_c: float = 0.0
    don_siddetli_c: float = -2.0
    yagis_24s_mm: float = 50.0
    hamle_kmh: float = 60.0
    birlestirme_gun: int = Field(default=5, ge=0)  # ardışık sinyaller arası en çok bu kadar gün → tek olay
    birlestirme_azami_sure_gun: int = Field(default=10, ge=1)  # bir olay en çok bu kadar gün yayılır (zincirleme birleşmeyi sınırlar)
    guven_orta_puan: int = 2  # sinyal güveni «orta» = 2, «düşük» = 1; kaynak ailesi başına en iyi sinyal toplanır
    guven_yuksek_min: int = 4
    guven_orta_min: int = 2


class BildirimKurali(KuralBlok):
    """Bildirim karar katmanı (ADR 0018): önem sınıfları, özet saati, sessiz saatler ve olay tazeliği. Hepsi ön değer · mühendis/kullanıcı onayı bekliyor."""

    ozet_saat: int = Field(default=7, ge=0, le=23)  # önemli ve bilgi bildirimleri günlük TEK özette bu saatte (yerel)
    sessiz_baslangic: int = Field(default=22, ge=0, le=23)  # sessiz saatler: kritik hariç hiçbir bildirim gönderilmez
    sessiz_bitis: int = Field(default=7, ge=0, le=23)
    taze_olay_gun: int = Field(default=3, ge=0)  # bitişi bundan eski olay bildirilmez (ilk çalıştırmada geçmiş birikimi bildirim yağdırmasın)
    kritik_olay_guven: str = "yuksek"  # bu güvendeki olay «şiddetli olay» sayılır → kritik (ayrıca don ve şiddetli don daima kritik)
    ozet_azami_madde: int = Field(default=8, ge=1)  # özet metni en çok bu kadar satır; fazlası «+N madde daha»


class EgriKurali(KuralBlok):
    """Kesintisiz canlılık eğrisi (ADR 0018): ağırlıklı Whittaker yumuşatma, gözlem ağırlıkları ve belirsizlik bandı. Ön değer; kademe eğriye değil gerçek gözleme dayanır."""

    lambda_: float = Field(default=300.0, gt=0, alias="lambda")  # Whittaker pürüzsüzlük (ikinci fark cezası); büyük = daha düz
    w_s2: float = Field(default=1.0, gt=0)  # Sentinel-2 gözlem ağırlığı (10 m, bahçe ortancası) × geçerli piksel oranı
    w_hls: float = Field(default=0.6, gt=0)  # HLS (30 m): bahçe küçükse birkaç piksel; daha düşük ağırlık
    hls_min_gecerli_oran: float = Field(default=0.5, ge=0, le=1)  # HLS sahnesi bunun altında geçerli piksel içeriyorsa gözlem sayılmaz
    sigma_taban: float = 0.02  # artık dağılımı bunun altına inmez
    belirsizlik_z: float = 1.645  # %90 yaklaşık bant (sezgisel, istatistiksel aralık değil)
    belirsizlik_tau_gun: float = Field(default=10.0, gt=0)  # bant genişliği en yakın gözleme uzaklık d için × sqrt(1 + (d/τ)²)
    gozlem_yakin_gun: int = Field(default=6, ge=0)  # en yakın gözlem bu kadar günden yakınsa nokta «gözlem destekli», değilse «tahmini»
    ekstrapolasyon_azami_gun: int = Field(default=30, ge=0)  # son gözlemden sonra en çok bu kadar gün tahmin çizilir
    radar_bosluk_gun: int = Field(default=12, ge=1)  # optik gözlem boşluğu bundan uzunsa radar «değişim var/yok» işareti çizilir


class GecmisKurali(KuralBlok):
    """Geçmiş sayfası (9G): yıl özeti ve yeşerme başlangıcı. Hepsi ön değer; yeşerme başlangıcı yalnız güvenilirse ve «ön değer» etiketiyle gösterilir."""

    yaz_ilk_ay: int = Field(default=6, ge=1, le=12)  # «yaz» = bu aydan ...
    yaz_son_ay: int = Field(default=9, ge=1, le=12)  # ... bu aya (dahil); yıl değeri = aylık temsilci değerlerin ortalaması
    yaz_asgari_ay: int = Field(default=3, ge=1, le=12)  # yılda bu kadar yaz ayı verisi yoksa yıl «yetersiz»
    asgari_diger_yil: int = Field(default=5, ge=3)  # bir yılı yargılamak için DİĞER yıllardan en az bu kadarı
    yesillenme_taban_son: str = "02-15"  # kış tabanı = Ocak başı ile bu tarih arası ortanca
    yesillenme_tepe_ilk: str = "03-01"  # ilkbahar tepesi aralığı
    yesillenme_tepe_son: str = "06-15"
    yesillenme_esik_orani: float = Field(default=0.25, gt=0, lt=1)  # başlangıç = eğri tabandan tepeye farkın bu oranını aştığı ilk gün
    yesillenme_asgari_genlik: float = Field(default=0.05, gt=0)  # tepe − taban bundan küçükse belirgin bir yeşerme yok: güvenilir sayılmaz
    yesillenme_asgari_gozlem: int = Field(default=8, ge=3)  # Şubat–Haziran aralığında en az bu kadar gerçek gözlem
    yesillenme_gozlem_orani: float = Field(default=0.6, gt=0, le=1)  # arama aralığındaki eğri noktalarının en az bu payı «gözlem destekli» (tahmini değil)
    yesillenme_kalicilik_gun: int = Field(default=14, ge=1)  # eşik aşımı bu kadar gün boyunca geri düşmemeli


class SahaKurali(KuralBlok):
    """Saha Defteri (9G-B): doğruluk özeti ve saha turu. Hepsi ön değer · mühendis onayı bekliyor."""

    dogruluk_asgari_n: int = Field(default=5, ge=1)  # bir türde bundan az doğrulama varsa «henüz yeterli doğrulama yok»; oran/sayı yorumlanmaz
    stres_yuzdelik: float = Field(default=10.0, gt=0, lt=50)  # stres yaması: son net görüntüde bahçenin KENDİ canlılık dağılımının bu yüzdeliğinin altı
    stres_min_da: float = Field(default=1.0, gt=0)  # en büyük bitişik yama en az bu kadar dekar olmalı (ve alt yüzdelikteki piksellerin çoğunu içermeli: küme, benek değil)
    stres_kume_orani: float = Field(default=0.5, gt=0, le=1)  # yama, alt yüzdeliktekilerin en az bu payını içermeli (dağınık benek yama sayılmaz)
    tur_hiz_m_dk: float = Field(default=55.0, gt=0)  # saha turu süre tahmini: yürüyüş hızı (bahçe içi, ağaç aralarında)
    tur_nokta_dk: float = Field(default=4.0, ge=0)  # nokta başına kontrol süresi
    tur_azami_nokta: int = Field(default=12, ge=1)  # tura en çok bu kadar nokta alınır (en önemlileri)


class DisKanitKurali(KuralBlok):
    """Olay doğrulamasında BAĞIMSIZ dış kanıt (9G-E): istasyon gözlemi (yalnız gerçek gözlem satırları) ve elle derlenmiş kamu kayıtları. Olay motorunun girdisi (ERA5, S2…) KANIT SAYILMAZ.
    Hepsi ön değer · mühendis onayı bekliyor. Sonuç yalnız «destekleniyor / çelişiyor / kanıt yok»; veri yoksa «kanıt yok»."""

    pencere_gun: int = Field(default=1, ge=0)  # olay tarih aralığı ± bu kadar gün içindeki gözlemler
    istasyon_azami_km: float = Field(default=80.0, gt=0)  # bahçeye en çok bu kadar uzaktaki istasyonlar
    istasyon_sayisi: int = Field(default=3, ge=1)
    don_destek_c: float = 0.0  # pencerede istasyon günlük min sıcaklığı ≤ bu değer → don destekleniyor
    don_celisme_c: float = 5.0  # pencerede TÜM gözlenen istasyon min değerleri ≥ bu değer → don ile çelişiyor (vadi/yamaç soğuk havası için geniş pay)
    yagis_destek_mm: float = 20.0  # pencerede istasyon günlük yağışı ≥ bu değer → aşırı yağış destekleniyor
    yagis_celisme_mm: float = 5.0  # pencerede TÜM gözlenen istasyon yağışları ≤ bu değer → çelişiyor (yağış mekânsal değişkendir: dar)
    katalog_pencere_gun: int = Field(default=2, ge=0)
    kiyi_rakim_azami_m: float = Field(default=50.0, ge=0)  # istasyon rakımı bunun altındaysa «kıyı», üstündeyse «iç kesim» denir (kıyı çizgisi verisi yok; rakıma dayalı yaklaşık etiket)  # kamu kaydı tarihi olay aralığının ± bu kadar günü içinde olmalı


class GorselKurali(KuralBlok):
    """Harita skalası (docs/design/gorsellestirme-ilkeleri.md, ilke 4): varsayılan skala mutlaktır; «bahçenin kendi farkları» gerilmesi
    bahçe içi aralık burada verilen fiziksel gürültü eşiğinin altındaysa KAPALIDIR (harita mutlak skalada kalır, «anlamlı fark yok» denir).
    Anahtar = göstergenin birimindeki en küçük anlamlı bahçe-içi aralık. Hepsi ön değer · mühendis onayı bekliyor."""

    gerilme_min_aralik: dict[str, float]

    @model_validator(mode="after")
    def _positive(self) -> GorselKurali:
        if any(v <= 0 for v in self.gerilme_min_aralik.values()):
            raise ValueError("Gerilme eşikleri pozitif olmalı.")
        return self


class Katalog(BaseModel):
    surum: int
    sezon_baslangici: str
    normal_bant: NormalBant
    radar: RadarKurali
    gorsel: GorselKurali
    su: SuKurali
    sulama_plani: SulamaPlaniKurali
    durum_v2: DurumV2Kurali
    olay: OlayKurali
    bildirim: BildirimKurali
    egri: EgriKurali
    gecmis: GecmisKurali
    saha: SahaKurali
    dis_kanit: DisKanitKurali
    urunler: dict[str, Urun]

    @model_validator(mode="after")
    def _consistent(self) -> Katalog:
        for kod, urun in self.urunler.items():
            if urun.fenoloji and urun.kc:
                stages = {e.kod for e in urun.fenoloji.evreler}
                if stages != set(urun.kc.degerler):
                    raise ValueError(f"{kod}: Kc değerleri fenoloji evreleriyle aynı olmalı.")
            if not any(c.kod == "diger" for c in urun.cesitler):
                raise ValueError(f"{kod}: 'diger' çeşidi zorunludur.")
        return self

    def urun(self, kod: str) -> Urun | None:
        return self.urunler.get(kod)

    def cesit(self, urun: str, cesit: str) -> Cesit | None:
        u = self.urun(urun)
        return next((c for c in u.cesitler if c.kod == cesit), None) if u else None


@lru_cache
def load_catalog(path: Path = CATALOG_FILE) -> Katalog:
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    raw.pop("varsayilan_narenciye", None)  # yalnızca YAML çapa tanımı
    return Katalog.model_validate(raw)


# ----------------------------------------------------------------------------- yardımcılar
def fold(text: str) -> str:
    """Türkçe harfleri sadeleştirip küçültür: 'Kütdiken' → 'kutdiken'."""
    table = str.maketrans("ıİöÖüÜşŞçÇğĞ", "iioouussccgg")
    text = text.translate(table).lower()
    return "".join(c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c)).strip()


def match_variety(catalog: Katalog, urun: str, free_text: str | None) -> str | None:
    """Serbest metindeki çeşit adını katalog koduna eşler (göç için); bulunamazsa metin varsa 'diger', yoksa None."""
    if not free_text or not free_text.strip():
        return None
    needle = fold(free_text)
    u = catalog.urun(urun)
    for cesit in u.cesitler if u else []:
        if needle == cesit.kod or needle in {fold(a) for a in cesit.aliaslar} or needle == fold(cesit.ad):
            return cesit.kod
    return "diger"


class EtkinKurallar(BaseModel):
    """Bir ürün+çeşit için geçerli (çeşit değeri varsa onun, yoksa ürünün) kurallar."""

    fenoloji: FenolojiKurali | None
    kc: KcKurali | None
    gdd: GddKurali | None


def effective_rules(catalog: Katalog, urun: str, cesit: str | None) -> EtkinKurallar:
    u = catalog.urun(urun)
    if u is None:
        return EtkinKurallar(fenoloji=None, kc=None, gdd=None)
    c = catalog.cesit(urun, cesit) if cesit else None
    return EtkinKurallar(
        fenoloji=(c.fenoloji if c and c.fenoloji else u.fenoloji),
        kc=(c.kc if c and c.kc else u.kc),
        gdd=(c.gdd if c and c.gdd else u.gdd),
    )


# ----------------------------------------------------------------------------- sezon ve evre tarihleri
def season_start_year(today: date, season_start: str = "10-01") -> int:
    month, day = (int(p) for p in season_start.split("-"))
    return today.year if (today.month, today.day) >= (month, day) else today.year - 1


def _anchor(mmdd: str, season_year: int, season_start: str) -> date:
    sm, sd = (int(p) for p in season_start.split("-"))
    m, d = (int(p) for p in mmdd.split("-"))
    year = season_year if (m, d) >= (sm, sd) else season_year + 1
    return date(year, m, d)


def stage_window(baslangic: str, bitis: str, season_year: int, season_start: str = "10-01") -> tuple[date, date]:
    """AA-GG aralığını `season_year` sezonunun içindeki gerçek tarihlere çevirir (yıl sonunu aşan evreler dahil)."""
    start = _anchor(baslangic, season_year, season_start)
    end = _anchor(bitis, season_year, season_start)
    if end < start:
        end = date(end.year + 1, end.month, end.day)
    return start, end
