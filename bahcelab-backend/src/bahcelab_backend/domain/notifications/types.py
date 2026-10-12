"""Bildirim türleri (tercihler bu anahtarlarla tutulur) ve aday bildirim yapısı."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

Oncelik = Literal["kritik", "uyari", "bilgi"]

TYPES: dict[str, dict[str, str]] = {
    "hava_don": {"ad": "Don uyarısı", "aciklama": "Önümüzdeki günlerde don bekleniyorsa."},
    "hava_sicak": {"ad": "Aşırı sıcak uyarısı", "aciklama": "Aşırı sıcak bekleniyorsa."},
    "zararli_riski": {"ad": "Zararlı / hastalık riski", "aciklama": "Meyve sineği, kırmızı örümcek veya kuruma hastalığı riski yüksekse (tahmin)."},
    "indeks_dususu": {"ad": "Uydu uyarısı", "aciklama": "Bahçenin kendi normunun belirgin altına düşüş."},
    "cok_yillik": {"ad": "Çok yıllık analiz", "aciklama": "Çok yıllık ağaç gücü bölgeleri hazır olduğunda."},
    "sulama": {"ad": "Sulama", "aciklama": "Önümüzdeki günlerde belirgin su ihtiyacı görünüyorsa."},
}


@dataclass(frozen=True)
class Candidate:
    """Henüz kaydedilmemiş bildirim; `dedupe_key` aynı olay için tek bildirimi garanti eder."""

    garden_id: object  # uuid.UUID
    tur: str
    oncelik: Oncelik
    baslik: str
    metin: str
    sekme: str
    dedupe_key: str

    def link(self) -> str:
        """Uygulama rotası (9B): Durum bahçenin kök adresidir; eski `/bahcem/...` kayıtları ön yüzde yönlenir."""
        base = f"/bahceler/{self.garden_id}"
        return base if self.sekme == "durum" else f"{base}/{self.sekme}"
