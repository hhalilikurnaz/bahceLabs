import asyncio
import logging
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from bahcelab_backend.config import get_settings
from bahcelab_backend.domain.weather import rules
from bahcelab_backend.domain.weather.codes import describe
from bahcelab_backend.domain.weather.provider import (
    TIMEZONE,
    DailyPoint,
    Forecast,
    WeatherProvider,
    WeatherSourceError,
)
from bahcelab_backend.domain.weather.repository import WeatherRepository
from bahcelab_backend.domain.weather.schemas import (
    GecmisGun,
    GecmisYanit,
    GunTahmini,
    HavaOzeti,
    HavaUyarisi,
    HavaYanit,
    IlaclamaAraligi,
    IlaclamaGunu,
    Konum,
    SaatTahmini,
    Simdi,
    SuDengesi,
    YagisToplami,
)
from bahcelab_backend.shared.errors import AppError, AppErrorCode

logger = logging.getLogger(__name__)

# Aynı hücre için eşzamanlı istekler tek sağlayıcı çağrısında birleşir
_locks: dict[tuple[float, float], asyncio.Lock] = {}


def snap(value: float, step: float) -> float:
    """Koordinatı ızgara hücresinin merkezine yuvarlar (0,05° → yaklaşık 5 km)."""
    return round(round(value / step) * step, 4)


@dataclass
class CellForecast:
    forecast: Forecast
    fetched_at: datetime
    sample: bool
    stale: bool  # sağlayıcıya ulaşılamadı, son önbellek gösteriliyor


def _simdi(forecast: Forecast) -> Simdi:
    c = forecast.current
    label, icon = describe(c.kod, c.gunduz)
    return Simdi(
        zaman=c.zaman,
        sicaklik=c.sicaklik,
        hissedilen=c.hissedilen,
        nem=c.nem,
        yagis=c.yagis,
        ruzgar=c.ruzgar,
        hamle=c.hamle,
        yon=c.yon,
        kod=c.kod,
        aciklama=label,
        ikon=icon,
    )


def _alert(a: rules.WeatherAlert) -> HavaUyarisi:
    return HavaUyarisi(**a.__dict__)


def _alerts(forecast: Forecast, today: date, now: str) -> list[HavaUyarisi]:
    found = [*rules.frost_alerts(forecast.hourly, now), *rules.heat_alerts(forecast.daily, today)]
    return [_alert(a) for a in rules.sort_alerts(found)]


class WeatherService:
    def __init__(
        self,
        repo: WeatherRepository,
        provider: WeatherProvider,
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        self.repo = repo
        self.provider = provider
        self.settings = get_settings()
        self._clock = clock or (lambda: datetime.now(UTC))

    # ------------------------------------------------------------------ zaman
    def _now_utc(self) -> datetime:
        return self._clock().astimezone(UTC)

    def _local_now(self) -> datetime:
        return self._clock().astimezone(ZoneInfo(TIMEZONE))

    # ------------------------------------------------------------------ bahçe ve hücre
    async def _point(self, garden_id: uuid.UUID) -> dict[str, Any]:
        points = await self.repo.garden_points(garden_id)
        if not points:
            raise AppError(404, AppErrorCode.NOT_FOUND, "Bahçe bulunamadı.")
        return points[0]

    def _cell_key(self, point: dict[str, Any]) -> tuple[float, float]:
        step = self.settings.weather_cell_degrees
        return snap(float(point["enlem"]), step), snap(float(point["boylam"]), step)

    # ------------------------------------------------------------------ tahmin (1 saat önbellek)
    async def _forecast(self, cell) -> CellForecast:
        ttl = timedelta(minutes=self.settings.weather_cache_minutes)

        def cached(stale: bool) -> CellForecast | None:
            if not cell.tahmin or not cell.tahmin_zamani:
                return None
            return CellForecast(
                Forecast.model_validate(cell.tahmin),
                cell.tahmin_zamani,
                cell.tahmin_kaynak == "ornek",
                stale,
            )

        def fresh() -> CellForecast | None:
            if (
                cell.tahmin is not None
                and cell.tahmin_kaynak != "ornek"
                and cell.tahmin_zamani is not None
                and self._now_utc() - cell.tahmin_zamani < ttl
            ):
                return cached(False)
            return None

        if (hit := fresh()) is not None:
            return hit

        lock = _locks.setdefault((cell.enlem, cell.boylam), asyncio.Lock())
        async with lock:
            await self.repo.refresh_cell(cell)  # beklerken başka istek yenilemiş olabilir
            if (hit := fresh()) is not None:
                return hit
            try:
                forecast = await self.provider.forecast(cell.enlem, cell.boylam)
            except WeatherSourceError:
                fallback = cached(True)
                if fallback is None:
                    raise AppError(
                        503,
                        AppErrorCode.INTERNAL_ERROR,
                        "Hava durumu şu an alınamıyor. İnternet bağlantınızı kontrol edip tekrar deneyin.",
                    ) from None
                return fallback
            now = self._now_utc()
            await self.repo.save_forecast(cell, forecast.model_dump(mode="json"), now, "saglayici")
            today = self._local_now().date()
            await self.repo.upsert_daily(
                cell.id, [d for d in forecast.daily if d.tarih < today], "tahmin"
            )
            return CellForecast(forecast, now, False, False)

    # ------------------------------------------------------------------ geçmiş (günde bir tamamlanır)
    async def _sync_history(self, cell, today: date) -> None:
        if cell.gecmis_senkron == today:
            return
        days = self.settings.weather_history_days
        start, end = today - timedelta(days=days), today - timedelta(days=1)
        existing = await self.repo.daily(cell.id, start, end)
        wanted = (start + timedelta(days=i) for i in range(days))
        missing = [d for d in wanted if d not in existing or existing[d].kaynak != "arsiv"]
        # Son günler ERA5 tarafından düzeltilebilir: her zaman son 10 gün yeniden alınır
        first = min([*missing, today - timedelta(days=10)])
        try:
            points = await self.provider.history(cell.enlem, cell.boylam, first, end)
        except WeatherSourceError:
            logger.warning("Geçmiş hava verisi alınamadı (hücre %s, %s)", cell.enlem, cell.boylam)
            return
        await self.repo.upsert_daily(cell.id, points, "arsiv")
        cell.gecmis_senkron = today
        await self.repo.session.flush()

    async def _daily_rows(self, cell, start: date, end: date) -> dict[date, DailyPoint]:
        rows = await self.repo.daily(cell.id, start, end)
        return {
            d: DailyPoint(
                tarih=d, min=r.min_sicaklik, max=r.max_sicaklik, yagis=r.yagis_mm, et0=r.et0_mm
            )
            for d, r in rows.items()
        }

    # ------------------------------------------------------------------ yanıtlar
    async def get(self, garden_id: uuid.UUID) -> HavaYanit:
        point = await self._point(garden_id)
        lat, lng = self._cell_key(point)
        cell = await self.repo.cell(lat, lng)
        data = await self._forecast(cell)
        local = self._local_now()
        today = local.date()
        await self._sync_history(cell, today)
        history_days = self.settings.weather_history_days
        rows = await self._daily_rows(
            cell, today - timedelta(days=history_days), today - timedelta(days=1)
        )
        return self._compose(data, rows, lat, lng, today, local.strftime("%Y-%m-%dT%H:%M"))

    def _compose(
        self,
        data: CellForecast,
        rows: dict[date, DailyPoint],
        lat: float,
        lng: float,
        today: date,
        now: str,
    ) -> HavaYanit:
        forecast = data.forecast
        spray = rules.classify_spray_hours(forecast.hourly)
        paired = list(zip(forecast.hourly, spray, strict=True))
        hours = [
            SaatTahmini(
                zaman=h.zaman,
                sicaklik=h.sicaklik,
                nem=h.nem,
                yagis=h.yagis,
                yagis_olasiligi=h.yagis_olasiligi,
                ruzgar=h.ruzgar,
                hamle=h.hamle,
                et0=h.et0,
                kod=h.kod,
                ilaclama=s.durum,
                ilaclama_nedenleri=s.nedenler,
            )
            for h, s in paired
        ]

        days: list[GunTahmini] = []
        for d in forecast.daily:
            if d.tarih < today:
                continue
            key = d.tarih.isoformat()
            summary = rules.summarize_spray_day([(h.zaman, s) for h, s in paired if h.zaman[:10] == key])
            label, icon = describe(d.kod)
            days.append(
                GunTahmini(
                    tarih=d.tarih,
                    min=d.min,
                    max=d.max,
                    yagis_mm=d.yagis,
                    yagis_olasiligi=d.yagis_olasiligi,
                    ruzgar_max=d.ruzgar_max,
                    hamle_max=d.hamle_max,
                    et0_mm=d.et0,
                    kod=d.kod,
                    aciklama=label,
                    ikon=icon,
                    ilaclama=IlaclamaGunu(
                        uygun_saat=summary.uygun_saat,
                        sinirda_saat=summary.sinirda_saat,
                        uygun_degil_saat=summary.uygun_degil_saat,
                        en_iyi_aralik=summary.en_iyi_aralik,
                    ),
                )
            )

        balances = []
        for span in (7, 30):
            balance = rules.water_balance(rows, today, span)
            if balance is not None:
                balances.append(
                    SuDengesi(**balance.__dict__, aciklama=rules.water_balance_note(balance))
                )

        yesterday = today - timedelta(days=1)
        season = rules.season_start(today)
        totals = []
        for label, span, start in (
            ("Son 7 gün", 7, today - timedelta(days=7)),
            ("Son 30 gün", 30, today - timedelta(days=30)),
            ("Sezon başından beri", (yesterday - season).days + 1, season),
        ):
            total = rules.rain_total(rows, start, yesterday)
            totals.append(
                YagisToplami(etiket=label, gun=span, mm=total.mm, gecen_yil_mm=total.gecen_yil_mm)
            )

        return HavaYanit(
            konum=Konum(enlem=lat, boylam=lng),
            guncelleme=data.fetched_at,
            onbellekten=data.stale,
            ornek_veri=data.sample,
            kaynak=self.provider.name,
            atif=self.provider.attribution,
            simdi=_simdi(forecast),
            gunler=days,
            saatlik=hours,
            uyarilar=_alerts(forecast, today, now),
            su_dengesi=balances,
            yagis_toplamlari=totals,
            sezon_baslangici=season,
        )

    async def history(self, garden_id: uuid.UUID, start: date, end: date) -> GecmisYanit:
        if start > end:
            raise AppError(
                422, AppErrorCode.VALIDATION_ERROR, "Başlangıç tarihi bitişten sonra olamaz."
            )
        limit = self.settings.weather_history_days + 1
        if (end - start).days > limit:
            raise AppError(
                422, AppErrorCode.VALIDATION_ERROR, f"En fazla {limit} günlük aralık istenebilir."
            )
        point = await self._point(garden_id)
        lat, lng = self._cell_key(point)
        cell = await self.repo.cell(lat, lng)
        today = self._local_now().date()
        await self._sync_history(cell, today)
        rows = await self._daily_rows(cell, start, end)
        return GecmisYanit(
            baslangic=start,
            bitis=end,
            gunler=[
                GecmisGun(tarih=d, min=r.min, max=r.max, yagis_mm=r.yagis, et0_mm=r.et0)
                for d, r in sorted(rows.items())
            ],
            guncelleme=cell.tahmin_zamani,
            onbellekten=cell.gecmis_senkron != today,
            atif=self.provider.attribution,
        )

    async def overview(self) -> list[HavaOzeti]:
        """Tüm bahçelerin kısa özeti. Aynı hücredeki bahçeler tek tahmini paylaşır."""
        points = await self.repo.garden_points()
        keys = {self._cell_key(point) for point in points}

        results: dict[tuple[float, float], CellForecast | str] = {}
        for key in keys:
            cell = await self.repo.cell(*key)
            try:
                results[key] = await self._forecast(cell)
            except AppError as exc:
                results[key] = exc.detail["message"]

        local = self._local_now()
        today, now = local.date(), local.strftime("%Y-%m-%dT%H:%M")
        items: list[HavaOzeti] = []
        for point in points:
            outcome = results[self._cell_key(point)]
            garden_id, name = str(point["id"]), point["ad"]
            if isinstance(outcome, str):
                items.append(HavaOzeti(garden_id=garden_id, ad=name, hata=outcome))
                continue
            forecast = outcome.forecast
            row = next((d for d in forecast.daily if d.tarih == today), None)
            items.append(
                HavaOzeti(
                    garden_id=garden_id,
                    ad=name,
                    guncelleme=outcome.fetched_at,
                    onbellekten=outcome.stale,
                    ornek_veri=outcome.sample,
                    simdi=_simdi(forecast),
                    bugun_min=row.min if row else None,
                    bugun_max=row.max if row else None,
                    bugun_yagis_mm=row.yagis if row else None,
                    bugun_yagis_olasiligi=row.yagis_olasiligi if row else None,
                    uyarilar=_alerts(forecast, today, now),
                    sonraki_ilaclama=_next_spray(forecast, now),
                )
            )
        return items


def _next_spray(forecast: Forecast, now: str) -> IlaclamaAraligi | None:
    """Şimdiden sonraki ilk kesintisiz (en az 2 saat) gündüz ilaçlama aralığı."""
    spray = rules.classify_spray_hours(forecast.hourly)
    ok = [
        s.durum == "uygun" and h.zaman[:13] >= now[:13] and rules.is_daytime(h.zaman)
        for h, s in zip(forecast.hourly, spray, strict=True)
    ]
    i = 0
    while i < len(ok):
        if not ok[i]:
            i += 1
            continue
        j = i
        while j + 1 < len(ok) and ok[j + 1]:
            j += 1
        if j - i + 1 >= 2:
            end = (datetime.fromisoformat(forecast.hourly[j].zaman) + timedelta(hours=1)).isoformat(
                timespec="minutes"
            )
            return IlaclamaAraligi(baslangic=forecast.hourly[i].zaman, bitis=end)
        i = j + 1
    return None
