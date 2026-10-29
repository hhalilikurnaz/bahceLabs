"""Fotoğraf EXIF'inden kayıt ÖNERİSİ (SAF): çekim tarihi ve konumu silinmeden önce okunur; kullanıcı onaylamadan hiçbir şey doldurulmaz.

Saklanan dosyada EXIF yine atılır (`FieldbookService._reencode`); burada okunan değerler yalnızca önerinin kaynağıdır ve dosyayla birlikte saklanmaz.
"""

from __future__ import annotations

import io
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

from PIL import Image, UnidentifiedImageError

EXIF_IFD, GPS_IFD = 0x8769, 0x8825
DATE_ORIGINAL, DATE_DIGITIZED, DATE_BASE = 36867, 36868, 306
MIN_DATE = date(2000, 1, 1)


@dataclass(frozen=True)
class ExifOneri:
    tarih: date | None
    lng: float | None
    lat: float | None


def _dms(values: Any, ref: Any) -> float | None:
    """(derece, dakika, saniye) → ondalık derece; güney/batı negatif. Geçersizse None."""
    try:
        d, m, s = (float(v) for v in values)
        out = d + m / 60.0 + s / 3600.0
    except (TypeError, ValueError, ZeroDivisionError):
        return None
    return -out if str(ref).upper() in ("S", "W") else out


def _parse_date(raw: Any, today: date) -> date | None:
    if not isinstance(raw, str) or len(raw) < 10:
        return None
    try:
        day = datetime.strptime(raw[:10], "%Y:%m:%d").date()
    except ValueError:
        return None
    return day if MIN_DATE <= day <= today else None  # gelecek ve anlamsız tarih önerilmez


def read_exif(data: bytes, today: date) -> ExifOneri:
    """Görüntü baytlarından en iyi tarih ve konum. Okunamıyorsa ya da EXIF yoksa boş öneri (hata fırlatmaz: dosya doğrulaması ayrı yapılır)."""
    try:
        with Image.open(io.BytesIO(data)) as image:
            exif = image.getexif()
            sub = exif.get_ifd(EXIF_IFD)
            gps = exif.get_ifd(GPS_IFD)
            raw_date = sub.get(DATE_ORIGINAL) or sub.get(DATE_DIGITIZED) or exif.get(DATE_BASE)
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError):
        return ExifOneri(None, None, None)
    lat = _dms(gps.get(2), gps.get(1)) if gps.get(1) and gps.get(2) else None
    lng = _dms(gps.get(4), gps.get(3)) if gps.get(3) and gps.get(4) else None
    if lat is None or lng is None or not (-90 <= lat <= 90 and -180 <= lng <= 180) or (lat == 0 and lng == 0):
        lat = lng = None
    return ExifOneri(_parse_date(raw_date, today), lng, lat)
