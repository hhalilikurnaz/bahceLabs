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


class DurumKademesi(KuralBlok):
    """Durum kademesi eşikleri (v1, ön değer): iç skor (0–100) → İyi · İzle · Dikkat · Sorun. Skor arayüze çıkmaz.
    Bileşen çipleri: puan ≥ `bilesen_normal_min` normal; ≤ `bilesen_belirgin_dusuk_max` belirgin düşük; arası normalin altı."""

    iyi_min: int = Field(ge=1, le=100)
    izle_min: int = Field(ge=1, le=100)
    dikkat_min: int = Field(ge=1, le=100)
    bilesen_normal_min: int = Field(ge=1, le=100)
    bilesen_belirgin_dusuk_max: int = Field(ge=0, le=99)

    @model_validator(mode="after")
    def _ordered(self) -> DurumKademesi:
        if not (self.iyi_min > self.izle_min > self.dikkat_min):
            raise ValueError("Kademe eşikleri iyi_min > izle_min > dikkat_min olmalı.")
        if self.bilesen_belirgin_dusuk_max >= self.bilesen_normal_min:
            raise ValueError("Bileşen eşikleri: belirgin_dusuk_max < normal_min olmalı.")
        return self


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
    sicaklik_min_sahne: int = Field(default=8, ge=3)  # aynı ayda bundan az geçmiş sahne varsa «yetersiz geçmiş»
    karisik_piksel_c: float = 1.5  # |bahçe − tampon| bunu aşarsa «karışık piksel»
    landsat_gecis_saati: int = 11  # yerel saat; hava sıcaklığı bu saatin ERA5 değeri


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
    don_c: float = 0.0
    don_siddetli_c: float = -2.0
    yagis_24s_mm: float = 50.0
    hamle_kmh: float = 60.0
    birlestirme_gun: int = Field(default=5, ge=0)  # ardışık sinyaller arası en çok bu kadar gün → tek olay
    birlestirme_azami_sure_gun: int = Field(default=10, ge=1)  # bir olay en çok bu kadar gün yayılır (zincirleme birleşmeyi sınırlar)
    guven_orta_puan: int = 2  # sinyal güveni «orta» = 2, «düşük» = 1; kaynak ailesi başına en iyi sinyal toplanır
    guven_yuksek_min: int = 4
    guven_orta_min: int = 2


class Katalog(BaseModel):
    surum: int
    sezon_baslangici: str
    durum_kademesi: DurumKademesi
    normal_bant: NormalBant
    radar: RadarKurali
    su: SuKurali
    durum_v2: DurumV2Kurali
    olay: OlayKurali
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
