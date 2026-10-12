"""«Bugün» listesi (SAF): en fazla N madde, öncelik sırası yapılandırmada. Her madde: başlık, tek cümle, ilgili sekme."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Literal

Sekme = Literal["durum", "analiz", "hava", "gunluk", "rapor"]
Oncelik = Literal["kritik", "uyari", "bilgi"]

# Öncelik anahtarlarının anlamı (sıra: config.today_priority)
KINDS = ("hava_uyarisi", "zararli_riski", "ilaclama", "indeks_dususu", "sulama")


@dataclass(frozen=True)
class BugunMaddesi:
    tur: str
    oncelik: Oncelik
    baslik: str
    metin: str
    sekme: Sekme
    ayrinti: str | None = None  # teknik ayrıntı (GDD, eşikler): arayüzde «Ayrıntı» açılırında


@dataclass(frozen=True)
class Girdi:
    """Bugün listesinin girdileri; hesaplayan servis doldurur, olmayanlar boş kalır."""

    hava_uyarilari: list[tuple[Literal["sari", "kirmizi"], str, str]]  # (seviye, başlık, mesaj)
    zararli_riskleri: list[tuple[str, str, str, str]]  # (seviye düşük/orta/yüksek, ad, sade cümle, teknik gerekçe)
    ilaclama: list[tuple[date, str, str]]  # (gün, başlangıç, bitiş) bugün/yarın en iyi aralıklar (gündüz)
    uydu_uyarilari: list[tuple[Literal["sari", "kirmizi"], str, str, str | None]]  # (seviye, başlık, kısa mesaj, açılır ayrıntı)
    sulama: tuple[float, str] | None  # (önümüzdeki 7 gün ihtiyaç mm, tek cümle) — yalnızca öneri anlamlıysa


def build_today(data: Girdi, today: date, priority: tuple[str, ...], limit: int) -> list[BugunMaddesi]:
    candidates: dict[str, list[BugunMaddesi]] = {kind: [] for kind in KINDS}

    for level, title, message in sorted(data.hava_uyarilari, key=lambda a: 0 if a[0] == "kirmizi" else 1):
        candidates["hava_uyarisi"].append(
            BugunMaddesi("hava_uyarisi", "kritik" if level == "kirmizi" else "uyari", title, message, "hava")
        )
    for risk_level, name, plain, reason in data.zararli_riskleri:
        if risk_level in ("orta", "yuksek"):
            candidates["zararli_riski"].append(
                BugunMaddesi("zararli_riski", "uyari" if risk_level == "yuksek" else "bilgi", name, plain, "hava", f"{reason} (Risk tahminidir, teşhis değildir.)")
            )
    if data.ilaclama:  # tek madde: «İlaçlama: bugün 07:30–10:00, yarın 07:15–09:00»
        parts = [f"{'bugün' if day == today else 'yarın'} {start}–{end}" for day, start, end in data.ilaclama]
        candidates["ilaclama"].append(
            BugunMaddesi("ilaclama", "bilgi", "İlaçlama: " + ", ".join(parts), "Rüzgâr, yağış ve sıcaklığa göre en uygun gündüz saatleri; ürün etiketindeki koşullar esastır.", "hava")
        )
    for level, title, message, detail in data.uydu_uyarilari:
        candidates["indeks_dususu"].append(
            BugunMaddesi("indeks_dususu", "kritik" if level == "kirmizi" else "uyari", title, message, "durum", detail)
        )
    if data.sulama is not None:
        need, sentence = data.sulama
        if need > 0:
            candidates["sulama"].append(BugunMaddesi("sulama", "bilgi", "Sulama ihtiyacı görünüyor", sentence, "hava"))

    items: list[BugunMaddesi] = []
    for kind in priority:
        items.extend(candidates.get(kind, []))
    items = items[:limit]
    if not items:
        items = [BugunMaddesi("her_sey_yolunda", "bilgi", "Her şey yolunda", "Bugün için dikkat gerektiren bir durum görünmüyor.", "durum")]
    return items
