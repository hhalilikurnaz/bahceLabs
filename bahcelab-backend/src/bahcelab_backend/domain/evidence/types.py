"""Bağımsız dış kanıt türleri (SAF). Olay motorunun girdisinden (ERA5, S2, HLS, radar) AYRI kaynaklardan gelen kanıtı tanımlar."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Literal

#: Kanıt kaynakları: yalnız bunlar. Olay motorunun kendi girdisi (ERA5, Sentinel-2, HLS, Sentinel-1, Open-Meteo) burada YOKTUR ve kanıt sayılmaz.
KANIT_KAYNAKLARI = ("istasyon", "dis_kayit")

OnYargiSonucu = Literal["destekleniyor", "celisiyor", "belirsiz", "kanit_yok"]  # belirsiz = veri var ama eşikler arasında · kanıt yok = pencerede hiç bağımsız veri yok
KanitYonu = Literal["destek", "celisme", "sinirda"]


@dataclass(frozen=True)
class Station:
    id: str
    ad: str
    lat: float
    lng: float
    yukseklik: float | None
    gozlem_baslangic: date | None  # gerçek gözlem aralığı (dışı model/dolgu: kanıt değil)
    gozlem_bitis: date | None
    mesafe_km: float = 0.0
    saglayici: str = "meteostat"

    @property
    def baglanti(self) -> str | None:
        """Kaynak sayfası: yalnız Meteostat istasyonlarının herkese açık sayfası vardır; elle temin edilen (MGM vb.) gözlemde bağlantı yoktur (metin sağlayıcıyı söyler)."""
        return f"https://meteostat.net/en/station/{self.id}" if self.saglayici == "meteostat" else None


@dataclass(frozen=True)
class StationDay:
    istasyon_id: str
    tarih: date
    tmin: float | None
    prcp: float | None
    kaynak: Literal["gozlem", "model"]  # «model»: dolgu/model satırı — kanıt SAYILMAZ (kuralda dışlanır, veritabanına yazılmaz)


@dataclass(frozen=True)
class PublicRecord:
    tarih: date
    olay_turu: str  # don | yagis | ruzgar | dolu | hasar …
    yer: str
    kaynak: str  # yayıncı (İl Tarım Müdürlüğü, TARSİM, haber sitesi)
    url: str
    not_: str = ""
    tarih_bitis: date | None = None  # kayıt bir gün aralığı ise (ör. «Şubat 2025»); yoksa tek gün
    yer_duzeyi: Literal["il", "ilce"] = "ilce"  # «il»: kayıt yalnız il adı veriyor (bahçenin ilçesi yazılı değil)


@dataclass(frozen=True)
class Kanit:
    kaynak: Literal["istasyon", "dis_kayit"]
    yon: KanitYonu
    metin: str
    baglanti: str | None
    il_duzeyi: bool = False  # kamu kaydı yalnız il düzeyinde (ilçe belirtilmemiş)


@dataclass
class OnYargi:
    sonuc: OnYargiSonucu
    kanitlar: list[Kanit] = field(default_factory=list)
    neden: str = ""  # «kanıt yok» ise neden (istasyon yok / gözlem yok / kayıt yok / sınırda)
