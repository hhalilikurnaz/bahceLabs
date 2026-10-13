"""TEST ARACI (ürün kodu değil): ağsız ERA5 istemcisi — `seed_water` ile AYNI deterministik mevsimsel seriyi üretir.

Ürün koduna yalnız `ERA5_CLIENT=tests.support.fake_era5:FakeEra5Client` (ve API_DEBUG=true) ile bağlanır; e2e ve entegrasyon testlerinde
bahçe eklenince besleme işinin gerçek hattan (idempotent upsert, hücre paylaşımı) geçmesi için kullanılır.
"""

from datetime import UTC, date, datetime, timedelta

from .seed_water import _day_row

ERA5_LAG_DAYS = 5


def _hourly(row: dict, keys: tuple[str, ...]) -> dict[str, list[float | None]]:
    out: dict[str, list[float | None]] = {}
    for key in keys:
        if key.startswith("sm"):
            out[key] = [row[key]] * 24
        elif key == "t2m":
            out[key] = list(row["saatlik"]["t2m"])
        else:  # günlük toplam → saatlik eşit pay
            out[key] = [round(row["yagis_mm" if key == "yagis" else "et0_mm"] / 24, 6)] * 24
    return out


def _span(start: date, end: date) -> list[date]:
    return [start + timedelta(days=i) for i in range((end - start).days + 1)]


class FakeEra5Client:
    calls: list[str] = []

    def __init__(self) -> None:
        self.today = datetime.now(UTC).date()

    def _rows(self, start: date, end: date) -> dict[date, dict]:
        return {d: _day_row(d, self.today) for d in _span(start, end)}

    async def land(self, lat: float, lng: float, start: date, end: date):  # noqa: ANN201, ARG002
        FakeEra5Client.calls.append("land")
        end = min(end, self.today - timedelta(days=ERA5_LAG_DAYS))
        return {d: _hourly(r, ("sm0", "sm1", "sm2", "sm3", "t2m")) for d, r in self._rows(start, end).items()}

    async def reanalysis(self, lat: float, lng: float, start: date, end: date):  # noqa: ANN201, ARG002
        FakeEra5Client.calls.append("era5")
        end = min(end, self.today - timedelta(days=ERA5_LAG_DAYS))
        return {d: _hourly(r, ("yagis", "et0")) for d, r in self._rows(start, end).items()}

    async def model(self, lat: float, lng: float, past_days: int = 10, forecast_days: int = 8):  # noqa: ANN201, ARG002
        FakeEra5Client.calls.append("model")
        rows = self._rows(self.today - timedelta(days=past_days), self.today + timedelta(days=forecast_days - 1))
        return {d: _hourly(r, ("sm0", "sm1", "sm2", "yagis", "et0", "t2m")) for d, r in rows.items()}
