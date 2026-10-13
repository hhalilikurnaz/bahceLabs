"""Bildirim karar katmanı (SAF, ADR 0018): önem → teslim zamanı, sessiz saatler, günlük özet ve tekrar önleme.

· kritik (don, şiddetli olay, yüksek risk) ANINDA ve sessiz saatlerde de gider.
· önemli (kademe düşüşü, orta risk, olay) ve bilgi günlük TEK özette gider (varsayılan 07:00, yerel); özet sessiz saatte üretilmez.
· Aynı olay/risk için tekrar yoktur (dedupe anahtarı) — veritabanı kısıtı bunu zaten garanti eder; burada anahtar kuralları tanımlıdır.
Saatler `bildirim` kataloğundan gelir (ön değer).
"""

from __future__ import annotations

from datetime import date
from typing import Literal

from bahcelab_backend.domain.agro.catalog import BildirimKurali

Teslim = Literal["hemen", "ozet"]


def in_quiet_hours(hour: int, rule: BildirimKurali) -> bool:
    """Sessiz saat aralığı gece yarısını aşabilir (22 → 07): [başlangıç, bitiş)."""
    start, end = rule.sessiz_baslangic, rule.sessiz_bitis
    return start <= hour or hour < end if start > end else start <= hour < end


def delivery(onem: str, rule: BildirimKurali) -> Teslim:  # noqa: ARG001 - kural ileride önem başına zamanlama için tutulur
    """Kritik anında; diğerleri özete. (Sessiz saat yalnız kritik OLMAYAN gönderimi etkiler; onlar zaten özette bekler.)"""
    return "hemen" if onem == "kritik" else "ozet"


def digest_due(local_hour: int, local_date: date, last_digest_date: date | None, rule: BildirimKurali) -> bool:
    """Özet vakti: ayarlı saat geldi, sessiz saatte değiliz ve bugün özet üretilmedi. Geç kalan iş (ör. 09:00'da) özeti yine bugün üretir."""
    return local_hour >= rule.ozet_saat and not in_quiet_hours(local_hour, rule) and last_digest_date != local_date


def is_fresh_event(end: date, today: date, rule: BildirimKurali) -> bool:
    """Bildirim yalnız taze olaylar içindir: bitişi `taze_olay_gun`'den eski olay bildirilmez; tahmin (gelecek) olaylar taze sayılır."""
    return (today - end).days <= rule.taze_olay_gun


def event_dedupe_key(garden_id: object, anahtar: str) -> str:
    return f"olay:{garden_id}:{anahtar}"


def tier_dedupe_key(garden_id: object, old: str, new: str, day: date) -> str:
    return f"kademe:{garden_id}:{old}>{new}:{day.isoformat()}"


TIER_ORDER = {"iyi": 0, "izle": 1, "dikkat": 2, "sorun": 3}


def tier_dropped(old: str | None, new: str) -> bool:
    """Kademe KÖTÜLEŞTİ mi? (İyi → İzle → Dikkat → Sorun); «veri yok» kademe düşüşü değildir."""
    return old in TIER_ORDER and new in TIER_ORDER and TIER_ORDER[new] > TIER_ORDER[old]
