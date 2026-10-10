"""Narenciye için tarımsal hava kuralları (saf fonksiyonlar, Türkçe açıklamalı).

Eşikler bilinçli olarak burada sabit tutulur; ileride kullanıcı ayarına açılabilir.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import Literal

from bahcelab_backend.domain.weather.provider import DailyPoint, HourlyPoint

SprayStatus = Literal["uygun", "sinirda", "uygun_degil"]
_RANK = {"uygun": 0, "sinirda": 1, "uygun_degil": 2}

# --- İlaçlama penceresi
WIND_OK, GUST_OK = 15.0, 25.0  # km/s (altı uygun)
WIND_EDGE, GUST_EDGE = 20.0, 32.0  # km/s (altı sınırda)
PROB_OK, PROB_EDGE = 30.0, 50.0  # % (sonraki 6 saatte en yüksek yağış olasılığı)
TEMP_OK = (10.0, 28.0)
TEMP_EDGE = (8.0, 30.0)
LOOKAHEAD_HOURS = 6
# «En iyi aralık» yalnızca gündüz saatlerinden seçilir (gece uygun saat olsa da önerilmez)
DAY_START_HOUR, DAY_END_HOUR = 5, 21

# --- Don ve sıcak
FROST_YELLOW, FROST_RED = 2.0, 0.0
HEAT_YELLOW, HEAT_RED = 38.0, 42.0

SEASON_START_MONTH = 10  # yağış sezonu = su yılı: 1 Ekim'de başlar (DSİ/MGM ile uyumlu)


def _fmt(value: float, digits: int = 0) -> str:
    return f"{value:.{digits}f}".replace(".", ",")


# ---------------------------------------------------------------- ilaçlama penceresi
@dataclass
class SprayHour:
    durum: SprayStatus
    nedenler: list[str] = field(default_factory=list)


def classify_spray_hours(hourly: list[HourlyPoint]) -> list[SprayHour]:
    """Her saat için uygun / sınırda / uygun değil ve nedenleri."""
    result: list[SprayHour] = []
    for i, hour in enumerate(hourly):
        ahead = hourly[i : i + LOOKAHEAD_HOURS + 1]
        probability = max((h.yagis_olasiligi or 0.0) for h in ahead)
        reasons: list[str] = []
        status: SprayStatus = "uygun"

        def worsen(level: SprayStatus, reason: str) -> None:
            nonlocal status
            reasons.append(reason)
            if _RANK[level] > _RANK[status]:
                status = level

        # Yağış varsa her zaman uygun değil
        if hour.yagis > 0:
            worsen("uygun_degil", f"Bu saatte yağış var ({_fmt(hour.yagis, 1)} mm).")

        if hour.ruzgar >= WIND_EDGE:
            worsen("uygun_degil", f"Rüzgâr çok kuvvetli ({_fmt(hour.ruzgar)} km/s); ilaç sürüklenir.")
        elif hour.ruzgar >= WIND_OK:
            worsen("sinirda", f"Rüzgâr {_fmt(hour.ruzgar)} km/s; 15 km/s altı önerilir.")

        if hour.hamle >= GUST_EDGE:
            worsen("uygun_degil", f"Rüzgâr hamlesi çok yüksek ({_fmt(hour.hamle)} km/s).")
        elif hour.hamle >= GUST_OK:
            worsen("sinirda", f"Rüzgâr hamlesi {_fmt(hour.hamle)} km/s; 25 km/s altı önerilir.")

        if probability >= PROB_EDGE:
            worsen(
                "uygun_degil",
                f"Sonraki 6 saatte yağış olasılığı %{_fmt(probability)}; ilaç yıkanabilir.",
            )
        elif probability >= PROB_OK:
            worsen("sinirda", f"Sonraki 6 saatte yağış olasılığı %{_fmt(probability)}.")

        low, high = TEMP_OK
        edge_low, edge_high = TEMP_EDGE
        if hour.sicaklik < edge_low or hour.sicaklik > edge_high:
            worsen(
                "uygun_degil",
                f"Sıcaklık {_fmt(hour.sicaklik, 1)} °C; {_fmt(low)}–{_fmt(high)} °C aralığının dışında.",
            )
        elif hour.sicaklik < low or hour.sicaklik > high:
            worsen(
                "sinirda",
                f"Sıcaklık {_fmt(hour.sicaklik, 1)} °C; {_fmt(low)}–{_fmt(high)} °C ideal aralığın dışında.",
            )

        if not reasons:
            reasons.append("Rüzgâr, yağış ve sıcaklık koşulları uygun.")
        result.append(SprayHour(durum=status, nedenler=reasons))
    return result


def is_daytime(moment: str) -> bool:
    return DAY_START_HOUR <= int(moment[11:13]) < DAY_END_HOUR


@dataclass
class SpraySummary:
    uygun_saat: int
    sinirda_saat: int
    uygun_degil_saat: int
    en_iyi_aralik: tuple[str, str] | None  # en uzun kesintisiz uygun aralık (başlangıç, bitiş saati)


def summarize_spray_day(hours: list[tuple[str, SprayHour]]) -> SpraySummary:
    """Bir günün saatleri (zaman, durum) için sayılar ve en uzun uygun aralık."""
    counts = {"uygun": 0, "sinirda": 0, "uygun_degil": 0}
    best: tuple[int, int] | None = None
    start: int | None = None
    for i, (moment, hour) in enumerate(hours):
        counts[hour.durum] += 1
        if hour.durum == "uygun" and is_daytime(moment):
            start = i if start is None else start
            if best is None or (i - start) > (best[1] - best[0]):
                best = (start, i)
        else:
            start = None
    window = None
    if best is not None:
        first, last = best
        window = (hours[first][0][11:16], f"{int(hours[last][0][11:13]) + 1:02d}:00")
    return SpraySummary(counts["uygun"], counts["sinirda"], counts["uygun_degil"], window)


# ---------------------------------------------------------------- don ve sıcak
@dataclass
class WeatherAlert:
    tur: Literal["don", "sicak"]
    seviye: Literal["sari", "kirmizi"]
    baslik: str
    mesaj: str
    baslangic: str  # yerel ISO saat
    bitis: str
    sure_saat: int
    deger: float  # en düşük (don) veya en yüksek (sıcak) sıcaklık


def _parse_hour(moment: str) -> tuple[date, int]:
    return date.fromisoformat(moment[:10]), int(moment[11:13])


def frost_alerts(hourly: list[HourlyPoint], now: str) -> list[WeatherAlert]:
    """Tahminde ≤ 2 °C: sarı «don riski»; ≤ 0 °C: kırmızı «don tehlikesi». Kaç saat sürdüğü de verilir."""
    upcoming = [h for h in hourly if h.zaman[:13] >= now[:13]]
    runs: list[list[HourlyPoint]] = []
    current: list[HourlyPoint] = []
    last_cold: datetime | None = None
    for hour in upcoming:
        if hour.sicaklik > FROST_YELLOW:
            continue
        moment = datetime.fromisoformat(hour.zaman)
        # 3 saatten uzun ara = yeni gece
        if current and last_cold is not None and moment - last_cold > timedelta(hours=3):
            runs.append(current)
            current = []
        current.append(hour)
        last_cold = moment
    if current:
        runs.append(current)

    alerts: list[WeatherAlert] = []
    for run in runs[:3]:
        lowest = min(h.sicaklik for h in run)
        red = lowest <= FROST_RED
        below_zero = sum(1 for h in run if h.sicaklik <= FROST_RED)
        below_two = len(run)
        day, hour_start = _parse_hour(run[0].zaman)
        when = f"{day.day:02d}.{day.month:02d} {hour_start:02d}:00"
        if red:
            title = "Don tehlikesi"
            message = (
                f"{when} civarında sıcaklık {_fmt(lowest, 1)} °C'ye düşecek; yaklaşık {below_zero} saat 0 °C ve altında, "
                f"toplam {below_two} saat 2 °C ve altında kalması bekleniyor. Limon don hassasiyeti yüksek bir türdür: "
                "genç sürgün, çiçek ve meyveler zarar görebilir. Don koruma önlemlerini gözden geçirin."
            )
        else:
            title = "Don riski"
            message = (
                f"{when} civarında sıcaklık {_fmt(lowest, 1)} °C'ye inecek; yaklaşık {below_two} saat 2 °C ve altında "
                "kalması bekleniyor. Don tehlikesi eşiğine (0 °C) inmiyor ancak hassas dokular için dikkatli olun."
            )
        alerts.append(
            WeatherAlert(
                tur="don",
                seviye="kirmizi" if red else "sari",
                baslik=title,
                mesaj=message,
                baslangic=run[0].zaman,
                bitis=run[-1].zaman,
                sure_saat=below_two,
                deger=lowest,
            )
        )
    return alerts


def heat_alerts(daily: list[DailyPoint], today: date) -> list[WeatherAlert]:
    """Günlük en yüksek sıcaklık ≥ 38 °C: sıcak stresi uyarısı (≥ 42 °C kırmızı)."""
    hot = [d for d in daily if d.tarih >= today and d.max is not None and d.max >= HEAT_YELLOW]
    if not hot:
        return []
    peak = max(hot, key=lambda d: d.max or 0.0)
    highest = peak.max or 0.0
    red = highest >= HEAT_RED
    first, last = hot[0].tarih, hot[-1].tarih
    span = (
        f"{first.day:02d}.{first.month:02d}"
        if first == last
        else f"{first.day:02d}.{first.month:02d}–{last.day:02d}.{last.month:02d}"
    )
    message = (
        f"{span} tarihlerinde en yüksek sıcaklık {_fmt(highest, 1)} °C'ye çıkacak ({len(hot)} gün 38 °C ve üzeri). "
        "Yüksek sıcaklık yaprakta stomaları kapatır, meyve dökümüne ve güneş yanığına yol açabilir. "
        "Sulamayı ve gölgelemeyi gözden geçirin; ilaçlamayı serin saatlere alın."
    )
    return [
        WeatherAlert(
            tur="sicak",
            seviye="kirmizi" if red else "sari",
            baslik="Aşırı sıcak" if red else "Sıcak stresi",
            mesaj=message,
            baslangic=f"{first.isoformat()}T00:00",
            bitis=f"{last.isoformat()}T23:00",
            sure_saat=len(hot) * 24,
            deger=highest,
        )
    ]


def sort_alerts(alerts: list[WeatherAlert]) -> list[WeatherAlert]:
    """Öncelik: kırmızı önce, sonra en yakın başlangıç."""
    return sorted(alerts, key=lambda a: (0 if a.seviye == "kirmizi" else 1, a.baslangic))


# ---------------------------------------------------------------- su dengesi ve yağış toplamları
@dataclass
class WaterBalance:
    gun: int
    yagis_mm: float
    et0_mm: float
    denge_mm: float
    eksik_gun: int  # veri olmayan gün sayısı


def _window(rows: dict[date, DailyPoint], start: date, end: date) -> list[DailyPoint]:
    return [rows[d] for d in _days(start, end) if d in rows]


def _days(start: date, end: date) -> list[date]:
    return [start + timedelta(days=i) for i in range((end - start).days + 1)]


def water_balance(rows: dict[date, DailyPoint], today: date, days: int) -> WaterBalance | None:
    """Bugünden önceki `days` günde yağış − ET₀. Hiç veri yoksa None."""
    start, end = today - timedelta(days=days), today - timedelta(days=1)
    window = [d for d in _window(rows, start, end) if d.yagis is not None and d.et0 is not None]
    if not window:
        return None
    rain = sum(d.yagis or 0.0 for d in window)
    et0 = sum(d.et0 or 0.0 for d in window)
    return WaterBalance(
        gun=days,
        yagis_mm=round(rain, 1),
        et0_mm=round(et0, 1),
        denge_mm=round(rain - et0, 1),
        eksik_gun=days - len(window),
    )


def water_balance_note(balance: WaterBalance) -> str:
    if balance.denge_mm < 0:
        text = (
            f"Son {balance.gun} günde su açığı {_fmt(abs(balance.denge_mm), 0)} mm "
            f"(yağış {_fmt(balance.yagis_mm)} mm, ET₀ {_fmt(balance.et0_mm)} mm)."
        )
    else:
        text = (
            f"Son {balance.gun} günde yağış ET₀'yı {_fmt(balance.denge_mm, 0)} mm aştı "
            f"(yağış {_fmt(balance.yagis_mm)} mm, ET₀ {_fmt(balance.et0_mm)} mm)."
        )
    return text


def season_start(today: date) -> date:
    year = today.year if today.month >= SEASON_START_MONTH else today.year - 1
    return date(year, SEASON_START_MONTH, 1)


def _one_year_back(day: date) -> date:
    try:
        return day.replace(year=day.year - 1)
    except ValueError:  # 29 Şubat
        return day.replace(year=day.year - 1, day=28)


@dataclass
class RainTotal:
    mm: float | None
    gecen_yil_mm: float | None
    gun: int


def rain_total(rows: dict[date, DailyPoint], start: date, end: date) -> RainTotal:
    """[start, end] yağış toplamı ve geçen yılın aynı dönemi. Veri %90'dan eksikse ilgili değer None olur."""
    days = (end - start).days + 1
    if days <= 0:
        return RainTotal(None, None, 0)

    def total(first: date, last: date) -> float | None:
        window = [d for d in _window(rows, first, last) if d.yagis is not None]
        if len(window) < 0.9 * ((last - first).days + 1):
            return None
        return round(sum(d.yagis or 0.0 for d in window), 1)

    return RainTotal(
        total(start, end),
        total(_one_year_back(start), _one_year_back(end)),
        days,
    )
