from datetime import date
from typing import Literal

from pydantic import BaseModel


class GecmisAy(BaseModel):
    ay: date
    durum: Literal["bekliyor", "isleniyor", "tamam", "hata"]
    net_sahne: int
    aday_sayisi: int
    hata_mesaji: str | None = None
    sure_saniye: float | None = None


class GecmisDoldurmaDurumu(BaseModel):
    """Geçmiş doldurma ilerlemesi («Geçmiş çekiliyor · %40»)."""

    durum: Literal["yok", "isleniyor", "tamam", "hata"]
    toplam_ay: int
    tamamlanan_ay: int
    hata_ay: int
    yuzde: int
    net_sahne: int
    depolanan_sahne: int
    depolama_bayt: int
    aylar: list[GecmisAy] | None = None


class IzgaraBilgisi(BaseModel):
    """Bahçenin kanonik 10 m ızgarası (tüm edinimler aynı ızgarada): satır/sütun ve köşeler [boylam, enlem] KB, KD, GD, GB."""

    satir: int
    sutun: int
    koordinatlar: list[list[float]]


class GostergeIstatistigi(BaseModel):
    ortalama: float
    medyan: float
    p10: float
    p25: float
    p75: float
    p90: float
    gecerli_piksel: int


class Edinim(BaseModel):
    tarih: date
    scene_id: str
    bulut_orani: float | None
    gecerli_oran: float | None
    isleme_surumu: str | None
    formul_surumu: str | None
    gostergeler: dict[str, GostergeIstatistigi]  # ndvi, ndmi, ndre, msavi, lai (varsa)


class Edinimler(BaseModel):
    izgara: IzgaraBilgisi | None
    net_sayisi: int
    bulutlu_sayisi: int
    bulutlu_tarihler: list[date] = []  # bulut yüzünden kullanılamayan optik geçişler («optik uydu göremedi»)
    edinimler: list[Edinim]


class NormalBantAy(BaseModel):
    ay: int
    yil_sayisi: int
    yillar: list[int]
    p10: float | None
    p25: float | None
    p50: float | None
    p75: float | None
    p90: float | None
    ceyrek_yeterli: bool
    onluk_yeterli: bool
    # banda yeterli geçmiş yoksa nedeni: «yetersiz geçmiş»
    durum: Literal["yeterli", "kismi", "yetersiz_gecmis"]


class TipikBantBilgisi(BaseModel):
    alt: float
    ust: float
    durum: Literal["dogrulanmadi", "muhendis_onayli"]


class NormalBantlar(BaseModel):
    tipik_bantlar: dict[str, TipikBantBilgisi] = {}  # ürünün gösterge başına tipik aralığı (katalogda ön değer)
    kaynak: str
    formul_surumu: str | None
    asgari_yil_ceyrek: int
    asgari_yil_onluk: int
    esik_durumu: Literal["dogrulanmadi", "muhendis_onayli"]  # «ön değer · mühendis onayı bekliyor»
    gostergeler: dict[str, list[NormalBantAy]]
    hazir: bool  # geçmiş doldurma bitti mi (bantlar kesinleşti)


class RadarDegisim(BaseModel):
    """Radar değişim kaydı: aday (olay motoru tüketir) ya da gürültü (tek sahnelik sıçrama)."""

    tarih: date
    scene_id: str
    yorunge: int
    gecis_yonu: str
    durum: Literal["aday", "gurultu"]
    isaret: Literal["azalis", "artis"]
    alan_orani: float
    alan_m2: float
    buyukluk_db: float
    bahce_delta_db: float | None
    kalici_sapma: Literal["alt", "ust", "bant_ici", "bant_yok"]
    art_arda: bool
    islaklik_olabilir: bool | None  # null: yağış verisi yok
    yagis_mm: float | None
    guven: Literal["orta", "dusuk"]  # dusuk: ıslaklık olabilir notlu aday (9F bildirime çevirmez)


class RadarEdinim(BaseModel):
    """Bir radar geçişi (kompakt): VH ve RVI bahçe ortalamaları, yörünge, maske payı."""

    tarih: date
    scene_id: str
    yorunge: int
    gecis_yonu: str
    birincil: bool
    maskeli_oran: float | None
    izgara: bool  # birincil yörüngede gösterge ızgarası saklı
    vh_db: float | None
    rvi: float | None


class RadarNoktaDegeri(BaseModel):
    tarih: date
    vh_db: float | None


class RadarNokta(BaseModel):
    """Seçili piksel için son radar sahnelerinin VH dB değerleri (Lee filtreli görüntü ızgarasından)."""

    seri: list[RadarNoktaDegeri]


class RadarYorunge(BaseModel):
    yorunge: int
    gecis_yonu: str
    sahne_sayisi: int
    birincil: bool


class RadarEdinimler(BaseModel):
    izgara: IzgaraBilgisi | None
    yorungeler: list[RadarYorunge]
    edinimler: list[RadarEdinim]


class RadarDegisimler(BaseModel):
    yorungeler: list[RadarYorunge]
    esikler: dict[str, float]  # anlamlı değişim dB, alan payı, en az alan (da), azami maske payı (katalog, ön değer)
    esik_durumu: Literal["dogrulanmadi", "muhendis_onayli"]
    degisimler: list[RadarDegisim]


class LandsatEdinim(BaseModel):
    """Landsat yüzey sıcaklığı sahnesi: bahçe ve 300 m tampon ortalamaları (°C)."""

    tarih: date
    scene_id: str
    platform: str | None
    bulut_orani: float | None
    gecerli_oran: float | None
    bahce_c: float
    tampon_c: float | None


class LandsatEdinimler(BaseModel):
    izgara: IzgaraBilgisi | None
    edinimler: list[LandsatEdinim]
