"""Durum kademesi ortak tipleri ve sözcükleri (Durum v2, ADR 0018). İç puan yoktur; kademe `status_v2.evaluate` ile hesaplanır."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Literal

from bahcelab_backend.domain.agro.risks import RiskSonucu

Durum = Literal["iyi", "izle", "dikkat", "sorun", "veri_yok"]
Seviye = Literal["sari", "kirmizi"]
GuvenSeviyesi = Literal["yuksek", "orta", "dusuk"]
KADEME_ADLARI: dict[str, str] = {
    "iyi": "İyi",
    "izle": "İzle",
    "dikkat": "Dikkat",
    "sorun": "Sorun",
    "veri_yok": "Veri yok",
}
AY_ADLARI: dict[int, str] = {
    1: "Ocak",
    2: "Şubat",
    3: "Mart",
    4: "Nisan",
    5: "Mayıs",
    6: "Haziran",
    7: "Temmuz",
    8: "Ağustos",
    9: "Eylül",
    10: "Ekim",
    11: "Kasım",
    12: "Aralık",
}


@dataclass(frozen=True)
class AktifRisk:
    """Zararlı/hastalık risk motorunun orta ya da yüksek çıkardığı risk (düşük riskler aktif sayılmaz)."""

    ad: str
    seviye: Literal["orta", "yuksek"]

    @property
    def metin(self) -> str:
        return f"{self.ad} · {'yüksek' if self.seviye == 'yuksek' else 'orta'}"


def active_risks_of(risks: Sequence[tuple[RiskSonucu, object, object]]) -> list[AktifRisk]:
    """Risk motoru çıktısından orta ve yüksek (veri yeterli) riskleri alır."""
    return [
        AktifRisk(r.ad, r.seviye)
        for r, _, _ in risks
        if r.veri_yeterli and r.seviye in ("orta", "yuksek")
    ]


def summary_sentence(durum: Durum) -> str:
    return {
        "iyi": "Bahçeniz bu dönemin kendi normuna göre iyi durumda.",
        "izle": "Bahçenizde takip edilmesi gereken bir değişim var.",
        "dikkat": "Bahçeniz bu dönemin kendi normunun belirgin altında ya da öncelikli bir uyarı var.",
        "sorun": "Bahçenizde ciddi bir sorun görünüyor; sahada kontrol edin.",
        "veri_yok": "Durum için yeterli veri yok.",
    }[durum]
