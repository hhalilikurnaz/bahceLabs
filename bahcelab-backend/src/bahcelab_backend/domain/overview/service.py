"""Bahçe listesi özeti: bahçe + son görüntü + sparkline + uyarılar + bugünkü hava (önbellekten).

Sorgu sayısı bahçe sayısından bağımsızdır (N+1 yok): bahçeler, sahneler/indeksler (3), merkez noktalar, hava hücreleri.
Ağa çıkılmaz; hava verisi yalnızca önbellekten okunur.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from bahcelab_backend.config import get_settings
from bahcelab_backend.domain.agro.score import ScoreConfig, assess
from bahcelab_backend.domain.agro.service import satellite_severities, scene_values, score_spans
from bahcelab_backend.domain.gardens.repository import GardenRepository, GardenRow
from bahcelab_backend.domain.ndvi.persist import thumbnail_url_path
from bahcelab_backend.domain.ndvi.repository import NdviRepository, SceneWithIndices
from bahcelab_backend.domain.ndvi.rules import build_alerts, index_series
from bahcelab_backend.domain.overview.schemas import (
    BahceOzeti,
    BahceOzetiYanit,
    HavaOzeti,
    SeriNoktasi,
    SonGoruntu,
    Toplamlar,
    UyariOzeti,
)
from bahcelab_backend.domain.overview.status import Seviye
from bahcelab_backend.domain.weather.models import WeatherCellModel
from bahcelab_backend.domain.weather.provider import TIMEZONE, Forecast
from bahcelab_backend.domain.weather.repository import WeatherRepository
from bahcelab_backend.domain.weather.service import current_summary, snap, weather_alerts
from bahcelab_backend.shared.errors import AppError, AppErrorCode

VALID_INDICES = ("ndvi", "msavi", "ndre", "ndmi", "cigreen")


class GardenOverviewService:
    def __init__(self, gardens: GardenRepository, ndvi: NdviRepository, weather: WeatherRepository) -> None:
        self.gardens = gardens
        self.ndvi = ndvi
        self.weather = weather
        self.settings = get_settings()
        self.score_cfg = ScoreConfig.from_settings(self.settings)

    async def overview(self, indeks: str = "ndvi") -> BahceOzetiYanit:
        if indeks not in VALID_INDICES:
            raise AppError(422, AppErrorCode.VALIDATION_ERROR, "Bilinmeyen parametre.")
        rows = await self.gardens.list_gardens()
        ids = [row.garden.id for row in rows]
        scenes = await self.ndvi.list_scenes_bulk(ids)
        weather_by_garden = await self._cached_weather(ids)

        now_utc = datetime.now(UTC)
        local = now_utc.astimezone(ZoneInfo(TIMEZONE))
        items = [
            self._garden_item(row, scenes[row.garden.id], indeks, weather_by_garden.get(row.garden.id), now_utc, local)
            for row in rows
        ]
        totals = Toplamlar(
            bahce_sayisi=len(items),
            toplam_dekar=round(sum(item.dekar for item in items), 3),
            dikkat_sayisi=sum(1 for item in items if item.durum == "dikkat"),
            izle_sayisi=sum(1 for item in items if item.durum == "izle"),
        )
        return BahceOzetiYanit(toplamlar=totals, bahceler=items)

    async def _cached_weather(self, ids: list[uuid.UUID]) -> dict[uuid.UUID, tuple[Forecast, datetime]]:
        points = await self.weather.garden_points()
        step = self.settings.weather_cell_degrees
        keys = {(snap(float(p["enlem"]), step), snap(float(p["boylam"]), step)) for p in points}
        cells = await self.weather.cached_cells(keys)
        result: dict[uuid.UUID, tuple[Forecast, datetime]] = {}
        for point in points:
            cell: WeatherCellModel | None = cells.get(
                (snap(float(point["enlem"]), step), snap(float(point["boylam"]), step))
            )
            if cell is not None and cell.tahmin is not None and cell.tahmin_zamani is not None:
                result[point["id"]] = (Forecast.model_validate(cell.tahmin), cell.tahmin_zamani)
        return result

    def _garden_item(
        self,
        row: GardenRow,
        scenes: list[SceneWithIndices],
        indeks: str,
        weather: tuple[Forecast, datetime] | None,
        now_utc: datetime,
        local: datetime,
    ) -> BahceOzeti:
        garden = row.garden
        series = index_series(scenes, indeks)
        since = now_utc.date() - timedelta(days=self.settings.overview_sparkline_days)
        trend = [SeriNoktasi(tarih=d, deger=round(v, 4)) for d, v in series if d >= since]

        latest = next(
            (
                item
                for item in reversed(scenes)
                if item.scene.durum == "tamam" and indeks in item.indices and item.indices[indeks].png_yolu
            ),
            None,
        )
        last_image = (
            SonGoruntu(tarih=latest.scene.tarih, kucuk_resim_url=thumbnail_url_path(garden.id, indeks, latest.scene.tarih))
            if latest
            else None
        )

        alerts: list[UyariOzeti] = []
        for satellite in build_alerts(scenes):
            level: Seviye = "kirmizi" if satellite.oncelik == "yuksek" else "sari"
            alerts.append(UyariOzeti(kaynak="uydu", tur=satellite.tur, seviye=level, baslik=satellite.baslik))

        weather_summary: HavaOzeti | None = None
        if weather is not None:
            forecast, fetched_at = weather
            current = current_summary(forecast)
            weather_summary = HavaOzeti(
                sicaklik=current.sicaklik,
                kod=current.kod,
                aciklama=current.aciklama,
                ikon=current.ikon,
                guncelleme=fetched_at,
                bayat=now_utc - fetched_at > timedelta(hours=self.settings.overview_weather_max_age_hours),
            )
            for item in weather_alerts(forecast, local.date(), local.strftime("%Y-%m-%dT%H:%M")):
                alerts.append(UyariOzeti(kaynak="hava", tur=item.tur, seviye=item.seviye, baslik=item.baslik))

        alerts.sort(key=lambda a: 0 if a.seviye == "kirmizi" else 1)
        sat_levels, _ = satellite_severities(scenes)
        weather_levels: list[Seviye] | None = None
        if weather is not None:
            weather_levels = [a.seviye for a in weather_alerts(weather[0], local.date(), local.strftime("%Y-%m-%dT%H:%M"))]
        result = assess(
            scene_values(scenes), spans=score_spans(), sat_severities=sat_levels,
            weather_severities=weather_levels, today=local.date(), cfg=self.score_cfg,
        )
        status = result.durum if last_image is not None or result.durum == "dikkat" else "veri_yok"
        return BahceOzeti(
            id=garden.id,
            ad=garden.ad,
            urun=garden.urun,
            cesit=garden.cesit,
            dekar=float(garden.alan_dekar),
            il=garden.il,
            ilce=garden.ilce,
            durum=status,
            skor=result.skor,
            durum_nedeni=alerts[0].baslik if alerts else None,
            indeks=indeks,
            son_goruntu=last_image,
            seri=trend,
            uyarilar=alerts,
            hava=weather_summary,
        )
