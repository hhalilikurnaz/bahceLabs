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
