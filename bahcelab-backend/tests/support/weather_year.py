"""TEST DESTEĞİ: `tests/fixtures/weather_2025_mersin.json` (Open-Meteo arşivinden alınmış gerçek 2025 günlük verisi) → GunVerisi listesi."""

import json
from datetime import date
from pathlib import Path

from bahcelab_backend.domain.agro.risks import GunVerisi

FIXTURE = Path(__file__).resolve().parent.parent / "fixtures" / "weather_2025_mersin.json"


def load_year() -> list[GunVerisi]:
    raw = json.loads(FIXTURE.read_text(encoding="utf-8"))["daily"]
    return [
        GunVerisi(date.fromisoformat(t), tmin, tmax, rain, wind, hum)
        for t, tmin, tmax, rain, wind, hum in zip(
            raw["time"], raw["temperature_2m_min"], raw["temperature_2m_max"], raw["precipitation_sum"],
            raw["wind_speed_10m_max"], raw["relative_humidity_2m_mean"], strict=True,
        )
    ]
