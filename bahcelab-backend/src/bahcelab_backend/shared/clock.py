"""Uygulama saati — «bugün» TEK yerden: `bugun(bahce)` = bahçenin yerel takvim günü (sistem saatine/UTC'ye bağlı değil).

Bahçenin saat dilimi `gardens.zaman_dilimi` alanındadır (varsayılan Europe/Istanbul). Alan, bahçe eklenirken/sınırı değişirken koordinattan türetilir:
Türkiye sınır kutusu içi → Europe/Istanbul; dışı → boylamdan sabit dilim (Etc/GMT∓n; yaz saati uygulaması yok, yaklaşık). Bahçesiz (genel/sistem) işler varsayılanı kullanır.
Alan/servis kodunda `date.today()` ve `datetime.now(UTC).date()` YASAK (tests/test_tarih_yasagi.py); gün gerekiyorsa buradan alınır."""

from datetime import UTC, date, datetime
from typing import Any
from zoneinfo import ZoneInfo

VARSAYILAN = "Europe/Istanbul"
TIMEZONE = ZoneInfo(VARSAYILAN)  # eski içe aktarmalar için (genel/sistem işleri)

_TR_LAT = (35.5, 42.5)
_TR_LNG = (25.5, 45.0)


def zaman_dilimi_adi(lat: float, lng: float) -> str:
    if _TR_LAT[0] <= lat <= _TR_LAT[1] and _TR_LNG[0] <= lng <= _TR_LNG[1]:
        return VARSAYILAN
    saat = max(-12, min(14, round(lng / 15)))
    return "Etc/GMT" if saat == 0 else f"Etc/GMT{'-' if saat > 0 else '+'}{abs(saat)}"  # POSIX ters işaret: UTC+3 = Etc/GMT-3


def _noktalar(koord: Any) -> list[tuple[float, float]]:
    if isinstance(koord, (list, tuple)) and len(koord) >= 2 and all(isinstance(x, (int, float)) for x in koord[:2]):
        return [(float(koord[0]), float(koord[1]))]
    return [p for alt in koord for p in _noktalar(alt)] if isinstance(koord, (list, tuple)) else []


def geojson_zaman_dilimi(geojson: dict[str, Any]) -> str:
    """Çokgen köşelerinin ortalamasından (yaklaşık merkez) saat dilimi."""
    pts = _noktalar(geojson.get("coordinates", []))
    if not pts:
        return VARSAYILAN
    return zaman_dilimi_adi(sum(p[1] for p in pts) / len(pts), sum(p[0] for p in pts) / len(pts))


def _tz_adi(bahce: Any) -> str:
    if isinstance(bahce, str):
        return bahce
    b = getattr(bahce, "garden", bahce)  # GardenRow → GardenModel
    return getattr(b, "zaman_dilimi", None) or VARSAYILAN


def bugun(bahce: Any = None, *, simdi: datetime | None = None) -> date:
    """Bahçenin yerel takvim günü. `bahce`: GardenModel/GardenRow/saat dilimi adı; None → varsayılan (Europe/Istanbul)."""
    return (simdi or datetime.now(UTC)).astimezone(ZoneInfo(_tz_adi(bahce))).date()


def today_istanbul() -> date:  # geriye dönük ad: genel/sistem işleri
    return bugun()


async def bahce_bugunu(session: Any, garden_id: Any) -> date:
    """Kimliği bilinen bahçenin yerel günü (saat dilimi alanını okur; bahçe yoksa varsayılan)."""
    from sqlalchemy import text

    ad = (await session.execute(text("SELECT zaman_dilimi FROM gardens WHERE id = :g"), {"g": garden_id})).scalar()
    return bugun(ad)
