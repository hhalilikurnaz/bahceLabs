"""Besleme işi durum kuralları (SAF): kesilme ve yeniden deneme kararı."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Literal

Karar = Literal["devam", "bekle", "vazgec", "yok"]


def is_stale(heartbeat: datetime, now: datetime, minutes: int) -> bool:
    """Çalışıyor görünen işin kalp atışı `minutes` dakikadır yoksa süreç düşmüştür."""
    return now - heartbeat > timedelta(minutes=minutes)


def next_action(durum: str, attempts: int, finished: datetime | None, now: datetime, *, retry_max: int, backoff_minutes: int) -> Karar:
    """Bitmiş bir işin sıradaki adımı.

    · kesildi → hemen devam (süreç düştü, iş suçsuz).
    · hata → `retry_max` denemeye kadar, her biri `backoff_minutes` sonra; sonra «vazgeç» (kendiliğinden denemez, bildirim görünür kalır).
    · tamam / atlandi / calisiyor → yok (atlandı = belirteç yok gibi bilinçli durum; kendiliğinden düzelmez).
    """
    if durum == "kesildi":
        return "devam"
    if durum != "hata":
        return "yok"
    if attempts >= retry_max:
        return "vazgec"
    if finished is not None and now - finished < timedelta(minutes=backoff_minutes):
        return "bekle"
    return "devam"
