"""Bildirim türleri (tercihler bu anahtarlarla tutulur) ve aday bildirim yapısı."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

Oncelik = Literal["kritik", "onemli", "bilgi"]  # önem: kritik anında; önemli ve bilgi günlük özette (ADR 0018)

TYPES: dict[str, dict[str, str]] = {
    "hava_don": {"ad": "Don uyarısı", "aciklama": "Önümüzdeki günlerde don bekleniyorsa."},
    "hava_sicak": {"ad": "Aşırı sıcak uyarısı", "aciklama": "Aşırı sıcak bekleniyorsa."},
    "zararli_riski": {"ad": "Zararlı / hastalık riski", "aciklama": "Meyve sineği, kırmızı örümcek veya kuruma hastalığı riski yüksekse (tahmin)."},
    "indeks_dususu": {"ad": "Uydu uyarısı", "aciklama": "Bahçenin kendi normunun belirgin altına düşüş."},
    "cok_yillik": {"ad": "Çok yıllık analiz", "aciklama": "Çok yıllık ağaç gücü bölgeleri hazır olduğunda."},
    "sulama": {"ad": "Sulama", "aciklama": "Önümüzdeki günlerde belirgin su ihtiyacı görünüyorsa."},
    "olay": {"ad": "Olay", "aciklama": "Don, aşırı yağış, kuvvetli rüzgâr ya da uydu ile doğrulanan ani değişim olayı."},
    "kademe_dususu": {"ad": "Durum kademesi düşüşü", "aciklama": "Bahçe durumu kademesi (İyi · İzle · Dikkat · Sorun) kötüleşirse."},
    "ozet": {"ad": "Günlük özet", "aciklama": "Önemli ve bilgi bildirimlerinin sabah tek özeti."},
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
    ayrinti: dict[str, str] | None = None  # şablon verisi (özette madde olarak gösterilir)

    def link(self) -> str:
        """Uygulama rotası (9B): Durum bahçenin kök adresidir; eski `/bahcem/...` kayıtları ön yüzde yönlenir."""
        base = f"/bahceler/{self.garden_id}"
        return base if self.sekme == "durum" else f"{base}/{self.sekme}"
