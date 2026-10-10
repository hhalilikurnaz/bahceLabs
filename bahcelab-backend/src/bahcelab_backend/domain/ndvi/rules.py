"""NDVI uyarı kuralları (saf fonksiyonlar)."""

from datetime import date, timedelta

from bahcelab_backend.domain.ndvi.models import NdviObservationModel
from bahcelab_backend.domain.ndvi.schemas import NdviUyari

DROP_THRESHOLD = 0.10  # %10
WINDOW_MIN_DAYS = 10
WINDOW_MAX_DAYS = 25


def _tr_pct(value: float) -> str:
    return f"%{abs(value):.1f}".replace(".", ",")


def _tr_num(value: float) -> str:
    return f"{value:.2f}".replace(".", ",")


def drop_alert(observations: list[NdviObservationModel]) -> NdviUyari | None:
    """Son geçerli görüntünün ortalaması, 10–25 gün önceki (en yakın) görüntüye göre %10'dan fazla düştüyse uyarı."""
    valid = [o for o in observations if o.durum == "tamam" and o.ortalama is not None]
    if len(valid) < 2:
        return None

    latest = max(valid, key=lambda o: o.tarih)
    low = latest.tarih - timedelta(days=WINDOW_MAX_DAYS)
    high = latest.tarih - timedelta(days=WINDOW_MIN_DAYS)
    candidates = [o for o in valid if low <= o.tarih <= high]
    if not candidates:
        return None

    previous = max(candidates, key=lambda o: o.tarih)  # aralıktaki en yeni
    if not previous.ortalama:
        return None

    change = round((latest.ortalama - previous.ortalama) / previous.ortalama * 100, 2)
    if change >= -DROP_THRESHOLD * 100:  # tam %10 düşüş eşik sayılmaz: "%10'dan fazla"
        return None

    days = (latest.tarih - previous.tarih).days
    return NdviUyari(
        tur="ndvi_dusus",
        mesaj=(
            f"Ortalama NDVI {_tr_num(previous.ortalama)} → {_tr_num(latest.ortalama)} "
            f"({_tr_pct(change)} azalma, {days} günde). Sulama, hastalık veya stres belirtilerini kontrol edin."
        ),
        onceki_tarih=previous.tarih,
        onceki_ortalama=round(previous.ortalama, 4),
        son_tarih=latest.tarih,
        son_ortalama=round(latest.ortalama, 4),
        degisim_yuzde=round(change, 2),
    )


def months_back(today: date, months: int) -> date:
    """`months` ay öncesinin aynı günü (ay sonu taşmasında ayın son günü)."""
    year = today.year - (months // 12)
    month = today.month - (months % 12)
    if month <= 0:
        month += 12
        year -= 1
    for day in (today.day, 30, 29, 28):
        try:
            return date(year, month, day)
        except ValueError:
            continue
    raise ValueError("geçersiz tarih")
