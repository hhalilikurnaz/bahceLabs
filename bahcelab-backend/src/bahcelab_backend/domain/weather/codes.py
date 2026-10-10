"""WMO hava kodları → Türkçe açıklama ve ikon anahtarı (arayüz ikona çevirir)."""

_DAY = {
    0: ("Açık", "gunes"),
    1: ("Çoğunlukla açık", "gunes-bulut"),
    2: ("Parçalı bulutlu", "gunes-bulut"),
    3: ("Kapalı", "bulutlu"),
    45: ("Sisli", "sis"),
    48: ("Kırağılı sis", "sis"),
    51: ("Hafif çise", "cise"),
    53: ("Çise", "cise"),
    55: ("Yoğun çise", "cise"),
    56: ("Dondurucu çise", "cise"),
    57: ("Yoğun dondurucu çise", "cise"),
    61: ("Hafif yağmur", "yagmur"),
    63: ("Yağmurlu", "yagmur"),
    65: ("Kuvvetli yağmur", "siddetli-yagmur"),
    66: ("Dondurucu yağmur", "yagmur"),
    67: ("Kuvvetli dondurucu yağmur", "siddetli-yagmur"),
    71: ("Hafif kar", "kar"),
    73: ("Karlı", "kar"),
    75: ("Yoğun kar", "kar"),
    77: ("Kar taneleri", "kar"),
    80: ("Hafif sağanak", "yagmur"),
    81: ("Sağanak", "siddetli-yagmur"),
    82: ("Şiddetli sağanak", "siddetli-yagmur"),
    85: ("Kar sağanağı", "kar"),
    86: ("Yoğun kar sağanağı", "kar"),
    95: ("Gök gürültülü fırtına", "firtina"),
    96: ("Dolu ile fırtına", "firtina"),
    99: ("Şiddetli dolu ile fırtına", "firtina"),
}


def describe(code: int | None, day: bool = True) -> tuple[str, str]:
    """(açıklama, ikon). Gece için açık/az bulutlu ikonları ay olur."""
    label, icon = _DAY.get(code if code is not None else 3, ("Bulutlu", "bulutlu"))
    if not day:
        icon = {"gunes": "ay", "gunes-bulut": "ay-bulut"}.get(icon, icon)
    return label, icon
