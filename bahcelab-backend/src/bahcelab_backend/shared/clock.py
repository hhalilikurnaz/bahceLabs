"""Uygulama saati: «bugün» her zaman Europe/Istanbul takvim günüdür (sistem yerel saatine ya da UTC'ye bağlı değil)."""

from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo

TIMEZONE = ZoneInfo("Europe/Istanbul")


def today_istanbul() -> date:
    return datetime.now(UTC).astimezone(TIMEZONE).date()
