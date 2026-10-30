from __future__ import annotations

from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

Sistem = Literal["damla", "mini_yagmurlama", "salma"]
Enerji = Literal["sebeke", "gunes", "dizel"]


class ProfilGiris(BaseModel):
    sistem: Sistem
    damlatici_sayisi: int | None = Field(default=None, ge=1, le=64)
    damlatici_debi_lh: float | None = Field(default=None, gt=0, le=200)
    sira_aralik_m: float | None = Field(default=None, gt=0, le=50)
    agac_aralik_m: float | None = Field(default=None, gt=0, le=50)
    pompa_kw: float | None = Field(default=None, gt=0, le=2000)
    pompa_debi_m3h: float | None = Field(default=None, gt=0, le=5000)
    enerji: Enerji = "sebeke"
    kwh_fiyat_tl: float | None = Field(default=None, ge=0, le=1000)
    enerji_m3_maliyet_tl: float | None = Field(default=None, ge=0, le=10000)
    su_ucreti_m3_tl: float | None = Field(default=None, ge=0, le=10000)


class TarifeBilgisi(BaseModel):
    ad: str
    kaynak_url: str
    gecerlilik_baslangic: date | None
    gecerlilik_bitis: date | None
    birim_fiyat_tl_kwh: float | None
    guncel: bool
    mesaj: str | None  # güncel değilse: «tarife güncel değil, faturanızdaki birim fiyatı girin»


class AgacKontrol(BaseModel):
    beyan: int | None
    beklenen: int | None
    tutarli: bool | None
    mesaj: str | None


class ProfilYaniti(BaseModel):
    profil: ProfilGiris | None
    alan_m2: float
    agac_sayisi: int | None
    agac_kontrol: AgacKontrol
    tarife: TarifeBilgisi
    fiyat_kaynagi: Literal["kullanici", "katalog", "yok"]
    on_deger: bool = True


class Uyari(BaseModel):
    kod: str
    mesaj: str


class MaliyetYaniti(BaseModel):
    m3: float
    pompa_saat: float | None
    kwh: float | None
    enerji_tl: float | None
    su_ucreti_tl: float | None
    toplam_tl: float | None
    fiyat_kaynagi: Literal["kullanici", "katalog", "yok"]
    eksik: str | None


class PlanGunu(BaseModel):
    tarih: date
    yagis_mm: float | None
    etkili_yagis_mm: float | None
    etc_mm: float | None
    uygulanan_net_mm: float
    planli_net_mm: float
    planli_brut_mm: float
    tukenme_mm: float
    tahmin: bool
    veri_eksik: bool


class Sulama(BaseModel):
    tarih: date
    net_mm: float
    brut_mm: float
    m3_bahce: float
    m3_dekar: float
    litre_agac: float | None  # «beyan edilen ağaç sayısına göre»
    emitor_dakika: int | None


class Aralik(BaseModel):
    alt: float
    orta: float
    ust: float


class SezonProjeksiyon(BaseModel):
    yil_sayisi: int
    ilk_yil: int
    son_yil: int
    m3: Aralik | None
    tl: Aralik | None
    alt_yuzde: float
    ust_yuzde: float


class AyCubugu(BaseModel):
    ay: int
    plan_m3: float
    uygulanan_m3: float | None
    gecen_yil_plan_m3: float | None
    tahmin: bool  # ay, tahmin ufkunun ötesini içeriyorsa tamamlanmamış


class Kaynak(BaseModel):
    ad: str
    not_: str | None = Field(default=None, serialization_alias="not")


class PlanYaniti(BaseModel):
    durum: Literal["hazir", "profil_yok", "veri_yok"]
    neden: str | None
    bugun: date
    on_deger: bool = True
    taw_mm: float | None = None
    raw_mm: float | None = None
    orten_yuzde: float | None = None
    kc_bugun: float | None = None
    sistem_verimi: float | None = None
    gunler: list[PlanGunu] = []
    sulamalar: list[Sulama] = []
    sonraki: Sulama | None = None
    uyarilar: list[Uyari] = []
    hafta_maliyet: MaliyetYaniti | None = None
    planlanan_bugune_kadar_m3: float | None = None  # bu yılın planı (sezon başından bugüne), gerçek havayla
    uygulanan_sezon_m3: float | None = None
    uygulanan_kayit_sayisi: int = 0
    sapma_mm: float | None = None  # son 14 gün: uygulanan net − planlanan net
    sapma_ciddi: bool = False
    projeksiyon: SezonProjeksiyon | None = None
    aylik: list[AyCubugu] = []
    kaynaklar: list[Kaynak] = []
    katalog_surum: int = 0


class SezonGunu(BaseModel):
    tarih: date
    tukenme_mm: float
    yagis_mm: float
    brut_mm: float
    kumulatif_m3: float
    kumulatif_tl: float | None
    stres: bool


class SezonYaniti(BaseModel):
    yil: int
    taw_mm: float
    raw_mm: float
    gunler: list[SezonGunu]
    toplam_m3: float
    toplam_tl: float | None
    sulama_sayisi: int
    yagis_mm: float
    stres_gun: int
    tahmin_dahil: bool  # içinde bulunulan yıl: ufuktan sonrası yok


class SenaryoToplam(BaseModel):
    m3: float
    kwh: float | None
    tl: float | None
    sulama_sayisi: int
    stres_gun: int


class AliskanlikSonuc(BaseModel):
    yil: int
    plan: SenaryoToplam
    aliskanlik: SenaryoToplam
    fark_m3: float
    fark_tl: float | None
    ozet: str


class YilSonucu(BaseModel):
    yil: int
    m3: float
    tl: float | None
    yagis_mm: float
    et0_mm: float


class KuruIslakSonuc(BaseModel):
    secili: YilSonucu
    ortanca: YilSonucu | None
    yillar: list[YilSonucu]
    fark_m3: float | None
    fark_tl: float | None


class KilitliDonem(BaseModel):
    kod: str
    ad: str
    baslangic: str
    bitis: str
    mesaj: str


class KisintiSonuc(BaseModel):
    yil: int
    uygulanabilir: bool
    varsayilan_plan: Literal[False] = False
    tam: SenaryoToplam
    kisintili: SenaryoToplam | None
    tasarruf_m3: float | None
    tasarruf_tl: float | None
    verim_riski: Literal["dusuk", "orta", "yuksek"] | None
    kilitli_donemler: list[KilitliDonem]
    onayli_donemler: list[str]
    mesaj: str


class SistemSonuc(BaseModel):
    yil: int
    mevcut: Sistem
    hedef: Sistem
    mevcut_toplam: SenaryoToplam
    hedef_toplam: SenaryoToplam
    fark_m3: float
    fark_kwh: float | None
    fark_tl: float | None
    yatirim_tl: float | None
    geri_odeme_sezon: float | None
    not_: str = Field(serialization_alias="not")


class SenaryoYaniti(BaseModel):
    durum: Literal["hazir", "profil_yok", "veri_yok"]
    neden: str | None
    on_deger: bool = True
    aliskanlik: AliskanlikSonuc | None = None
    kuru_islak: KuruIslakSonuc | None = None
    kisinti: KisintiSonuc | None = None
    sistem: SistemSonuc | None = None
    kaynaklar: list[Kaynak] = []


# ----------------------------------------------------------------------------- sektörler (vana) · 9H-S4
class SektorGirdisi(BaseModel):
    ad: str = Field(min_length=1, max_length=24)
    geometry: dict[str, object]  # GeoJSON Polygon (EPSG:4326)
    agac_sayisi: int | None = Field(default=None, ge=1, le=1_000_000)
    sira_aralik_m: float | None = Field(default=None, gt=0, le=50)
    agac_aralik_m: float | None = Field(default=None, gt=0, le=50)
    vana_debi_m3h: float | None = Field(default=None, gt=0, le=5000)


class SektorlerGirdisi(BaseModel):
    sektorler: list[SektorGirdisi] = Field(max_length=40)


class SektorKaydi(BaseModel):
    id: UUID | None  # None: bahçe tek sektör (çizim yok)
    ad: str
    geometry: dict[str, object] | None
    alan_m2: float
    alan_dekar: float
    agac_sayisi: int | None
    agac_kaynak: Literal["sektor", "orantili", "beyan", "yok"]
    sira_aralik_m: float | None
    agac_aralik_m: float | None
    vana_debi_m3h: float | None


class SektorlerYaniti(BaseModel):
    tanimli: bool
    sektorler: list[SektorKaydi]
    not_: str | None = Field(default=None, serialization_alias="not")


DurumEtiketi = Literal["stres", "yakin", "yeterli", "dolu"]


class SektorGunu(BaseModel):
    tarih: date
    doluluk_pct: float | None  # kullanılabilir su %, (TAW − Dr) / TAW
    etc_mm: float | None
    eta_mm: float | None
    net_mm: float  # uygulanan + planlanan net sulama
    brut_mm: float
    yagis_mm: float | None
    etkili_yagis_mm: float | None
    bosa_mm: float  # derin sızıntı + sistem kaybı
    ks: float | None
    planli: bool
    uygulandi: bool
    tahmin: bool
    veri_eksik: bool


class SektorDurumu(BaseModel):
    id: UUID | None
    ad: str
    alan_dekar: float
    agac_sayisi: int | None
    agac_kaynak: Literal["sektor", "orantili", "beyan", "yok"]
    vana_debi_m3h: float | None
    doluluk_pct: float | None
    etiket: DurumEtiketi | None
    sonraki_sulama: date | None
    esik_alti_7gun: bool
    gunler: list[SektorGunu]


class VardiyaKalemi(BaseModel):
    sektor: str
    baslangic: str | None  # SS:DD
    bitis: str | None
    sure_dk: int | None
    m3: float
    brut_mm: float
    litre_agac: float | None
    emitor_dakika: int | None


class Vardiya(BaseModel):
    tarih: date
    baslangic: str
    kalemler: list[VardiyaKalemi]
    toplam_m3: float
    onayli: bool
    zaman_notu: str | None  # süre/saat neden yok


class Hafta7Gunu(BaseModel):
    tarih: date
    ort_doluluk_pct: float | None
    yagis_mm: float | None
    sulama: bool


class KpiSonraki(BaseModel):
    tarih: date
    gun_sonra: int
    vanalar: list[str]


class Guven(BaseModel):
    etiket: Literal["dusuk", "orta", "yuksek"]
    puan: int
    toplam: int
    kosullar: list[dict[str, object]]  # {ad, ok, not}


class PanelKpi(BaseModel):
    sonraki: KpiSonraki | None
    ihtiyac_karsilandi_pct: float | None  # son 7 gün ΣETa/ΣETc, vana ortalaması
    ihtiyac_renk: Literal["yesil", "sari", "kirmizi"] | None
    sezon_m3: float | None
    sezon_hedef_pct: float | None  # sezon tahmininin (ortanca) yüzdesi
    sezon_kaynak: Literal["uygulanan", "planlanan"] | None


class PanelYaniti(BaseModel):
    durum: Literal["hazir", "profil_yok", "veri_yok"]
    neden: str | None
    bugun: date
    on_deger: bool = True
    taw_mm: float | None = None
    raw_mm: float | None = None
    stres_pct: float = 50.0
    yakin_pct: float = 70.0
    yeterli_pct: float = 97.0
    tetik_pct: float | None = None  # sulama eşiği (kullanılabilir su %): sistem tetiğine denk gelen seviye
    sektorler: list[SektorDurumu] = []
    sektor_tanimli: bool = False
    kpi: PanelKpi | None = None
    hafta: list[Hafta7Gunu] = []
    vardiya: Vardiya | None = None
    en_dusuk: dict[str, object] | None = None  # {ad, pct}
    esik_alti_sektorler: list[str] = []
    uyarilar: list[Uyari] = []
    guven: Guven | None = None
    kaynaklar: list[Kaynak] = []
    yagis_vurgu_mm: float = 12.0
    katalog_surum: int = 0
    onayli_tarih: date | None = None


class SimGunu(BaseModel):
    tarih: date
    yagis_mm: float
    et0_mm: float
    sulama: bool


class SimSektor(BaseModel):
    ad: str
    doluluk_pct: list[float | None]  # gün sırasıyla
    brut_mm: list[float]
    stres: list[bool]


class SimSayac(BaseModel):
    m3: float
    kwh: float | None
    tl: float | None
    fiyat_kaynagi: Literal["kullanici", "katalog", "yok"]
    eksik: str | None
    stres_gun: int
    bosa_m3: float
    sulama_gunu: int


class SimYili(BaseModel):
    yil: int
    tip: Literal["kuru", "normal", "islak"] | None
    yagis_mm: float


class SimulasyonYaniti(BaseModel):
    durum: Literal["hazir", "profil_yok", "veri_yok"]
    neden: str | None
    yil: int | None = None
    mod: Literal["plan", "aliskanlik"] = "plan"
    sistem: Sistem | None = None
    yillar: list[SimYili] = []
    gunler: list[SimGunu] = []
    sektorler: list[SimSektor] = []
    vardiyalar: list[Vardiya] = []
    sayac: SimSayac | None = None
    karsilastirma: dict[str, SimSayac] | None = None  # {plan, aliskanlik}
    karsilastirma_cumle: str | None = None
    aliskanlik: dict[str, object] | None = None  # {kaynak: kayit|elle, gunler, brut_mm, kayit_sayisi}
    aliskanlik_neden: str | None = None
    kisinti_uygulandi: bool = False
    kilitli_donemler: list[KilitliDonem] = []
    kaynaklar: list[Kaynak] = []


class OnayGirdisi(BaseModel):
    tarih: date


class IsleGirdisi(BaseModel):
    tarih: date
