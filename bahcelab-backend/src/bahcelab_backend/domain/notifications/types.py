"""Bildirim türleri (tercihler bu anahtarlarla tutulur) ve aday bildirim yapısı."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

SISTEM_TURU = "besleme"  # veri akışı (sistem) bildirimi: ürün (bahçe) uyarılarından AYRI gösterilir ve rozete/toast'a girmez

Oncelik = Literal["kritik", "onemli", "bilgi"]  # önem: kritik anında; önemli ve bilgi günlük özette (ADR 0018)

TYPES: dict[str, dict[str, str]] = {
    "hava_don": {"ad": "Don uyarısı", "aciklama": "Önümüzdeki günlerde don bekleniyorsa."},
    "hava_sicak": {"ad": "Aşırı sıcak uyarısı", "aciklama": "Aşırı sıcak bekleniyorsa."},
    "zararli_riski": {"ad": "Zararlı / hastalık riski", "aciklama": "Meyve sineği, kırmızı örümcek veya kuruma hastalığı riski yüksekse (tahmin)."},
    "indeks_dususu": {"ad": "Uydu uyarısı", "aciklama": "Bahçenin kendi normunun belirgin altına düşüş."},
    "cok_yillik": {"ad": "Çok yıllık analiz", "aciklama": "Çok yıllık ağaç gücü bölgeleri hazır olduğunda."},
    "sulama": {"ad": "Sulama", "aciklama": "Önümüzdeki günlerde belirgin su ihtiyacı görünüyorsa."},
    "sulama_plani": {"ad": "Sulama günü yaklaştı", "aciklama": "Sulama planındaki bir sulama günü yaklaştığında."},
    "sulama_sapma": {"ad": "Plandan ciddi sapma", "aciklama": "Uyguladığınız sulama plandan belirgin farklıysa."},
    "olay": {"ad": "Olay", "aciklama": "Don, aşırı yağış, kuvvetli rüzgâr ya da uydu ile doğrulanan ani değişim olayı."},
    "kademe_dususu": {"ad": "Durum kademesi düşüşü", "aciklama": "Bahçe durumu kademesi (İyi · İzle · Dikkat · Sorun) kötüleşirse."},
    "besleme": {"ad": "Veri akışı", "aciklama": "Arka plandaki veri çekimi (hava, yağış, toprak nemi, uydu) kesilir ya da tekrar tekrar başarısız olursa."},
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
    harita: str | None = None  # bağlantıya eklenen sorgu: çalışma alanı haritasını ilgili olaya/katmana/tarihe açar (örn. «olay=<kimlik>», «katman=canlilik&tarih=2026-10-09»)

    def link(self) -> str:
        """Uygulama rotası (9B): Durum bahçenin kök adresidir; eski `/bahcem/...` kayıtları ön yüzde yönlenir."""
        base = f"/bahceler/{self.garden_id}"
        path = base if self.sekme == "durum" else f"{base}/{self.sekme}"
        return f"{path}?{self.harita}" if self.harita else path
