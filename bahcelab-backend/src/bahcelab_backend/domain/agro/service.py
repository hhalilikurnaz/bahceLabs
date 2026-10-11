"""Agro servisi: katalog, fenoloji (bahçe düzeltmeleriyle), sezon serileri, durum skoru ve «Bugün» listesi."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from bahcelab_backend.config import get_settings
from bahcelab_backend.domain.agro import catalog as cat
from bahcelab_backend.domain.agro.repository import AgroRepository
from bahcelab_backend.domain.agro.schemas import (
    BilesenYanit,
    BugunMaddesiYanit,
    BugunYanit,
    DurumYanit,
    EvreYanit,
    FenolojiDuzeltme,
    FenolojiYanit,
    GuvenYanit,
    KatalogCesit,
    KatalogUrun,
    KatalogYanit,
    KuralMeta,
    SeriGunu,
    SerilerYanit,
    SeriOzeti,
)
from bahcelab_backend.domain.agro.score import SceneValue, ScoreConfig, Seviye, Skor, assess
from bahcelab_backend.domain.agro.series import DayWeather, build_season, coverage, one_year_earlier
from bahcelab_backend.domain.agro.today import Girdi, build_today
from bahcelab_backend.domain.gardens.models import GardenModel
from bahcelab_backend.domain.gardens.repository import GardenRepository
from bahcelab_backend.domain.ndvi.indices import INDICES
from bahcelab_backend.domain.ndvi.repository import NdviRepository, SceneWithIndices
from bahcelab_backend.domain.ndvi.rules import build_alerts
from bahcelab_backend.domain.weather.provider import TIMEZONE
from bahcelab_backend.domain.weather.schemas import HavaYanit
from bahcelab_backend.domain.weather.service import WeatherService
from bahcelab_backend.shared.errors import AppError, AppErrorCode

LABELS = {"iyi": "İyi", "izle": "İzle", "dikkat": "Dikkat", "veri_yok": "Veri yok"}


def _meta(block: cat.KuralBlok | None) -> KuralMeta | None:
    if block is None:
        return None
    return KuralMeta(durum=block.durum, kaynak=block.kaynak, onaylayan=block.onaylayan, onay_tarihi=block.onay_tarihi)


def scene_values(scenes: list[SceneWithIndices]) -> list[SceneValue]:
    """Bulutsuz sahnelerin parametre ortalamaları (skorun girdisi)."""
    return [
        SceneValue(item.scene.tarih, {name: row.ortalama for name, row in item.indices.items()})
        for item in scenes
        if item.scene.durum == "tamam" and item.indices
    ]


def satellite_severities(scenes: list[SceneWithIndices]) -> tuple[list[Seviye], list[tuple[Seviye, str, str]]]:
    alerts = build_alerts(scenes)
    levels: list[tuple[Seviye, str, str]] = [
        ("kirmizi" if a.oncelik == "yuksek" else "sari", a.baslik, a.mesaj) for a in alerts
    ]
    return [lvl for lvl, _, _ in levels], levels


def score_spans() -> dict[str, float]:
    return {name: INDICES[name].max - INDICES[name].min for name in ("ndvi", "ndmi")}


def to_status_response(result: Skor, today: date) -> DurumYanit:
    return DurumYanit(
        durum=result.durum,
        etiket=LABELS[result.durum],
        skor=result.skor,
        ozet=result.ozet,
        veri_yeterli=result.veri_yeterli,
        veri_yetersiz_nedeni=result.veri_yetersiz_nedeni,
        bilesenler=[BilesenYanit(**b.__dict__) for b in result.bilesenler],
        guven=GuvenYanit(**result.guven.__dict__),
        hesaplama_tarihi=today,
    )


class AgroService:
    def __init__(
        self,
        gardens: GardenRepository,
        ndvi: NdviRepository,
        weather: WeatherService,
        repo: AgroRepository,
    ) -> None:
        self.gardens = gardens
        self.ndvi = ndvi
        self.weather = weather
        self.repo = repo
        self.settings = get_settings()
        self.catalog = cat.load_catalog()

    def _today(self) -> date:
        return datetime.now(ZoneInfo(TIMEZONE)).date()

    async def _garden(self, garden_id: uuid.UUID) -> GardenModel:
        row = await self.gardens.get(garden_id)
        if row is None:
            raise AppError(404, AppErrorCode.NOT_FOUND, "Bahçe bulunamadı.")
        return row.garden

    # ------------------------------------------------------------------ katalog
    def catalog_response(self) -> KatalogYanit:
        products = []
        for code, product in self.catalog.urunler.items():
            products.append(
                KatalogUrun(
                    kod=code,
                    ad=product.ad,
                    cesitler=[KatalogCesit(kod=c.kod, ad=c.ad, not_=c.not_) for c in product.cesitler],
                    fenoloji=_meta(product.fenoloji),
                    kc=_meta(product.kc),
                    gdd=_meta(product.gdd),
                    gdd_taban_c=product.gdd.taban_c if product.gdd else None,
                )
            )
        return KatalogYanit(surum=self.catalog.surum, urunler=products)

    # ------------------------------------------------------------------ fenoloji
    def _season_year(self, requested: int | None, today: date) -> int:
        current = cat.season_start_year(today, self.catalog.sezon_baslangici)
        year = requested if requested is not None else current
        if year > current:
            raise AppError(422, AppErrorCode.VALIDATION_ERROR, "Henüz başlamamış bir sezon istenemez.")
        if year < current - 5:
            raise AppError(422, AppErrorCode.VALIDATION_ERROR, "En fazla 5 sezon öncesi istenebilir.")
        return year

    async def phenology(self, garden_id: uuid.UUID, season: int | None) -> FenolojiYanit:
        garden = await self._garden(garden_id)
        year = self._season_year(season, self._today())
        rules = cat.effective_rules(self.catalog, garden.urun, garden.cesit_kodu)
        if rules.fenoloji is None:
            return FenolojiYanit(sezon=year, urun=garden.urun, cesit_kodu=garden.cesit_kodu, kural=None, kc_kural=None, kural_yok=True, evreler=[])
        overrides = await self.repo.overrides(garden_id)
        kc = rules.kc.degerler if rules.kc else {}
        stages: list[EvreYanit] = []
        for season_year in (year - 1, year, year + 1):
            for stage in rules.fenoloji.evreler:
                special = overrides.get(stage.kod)
                start_m, end_m = (special.baslangic, special.bitis) if special else (stage.baslangic, stage.bitis)
                start, end = cat.stage_window(start_m, end_m, season_year, self.catalog.sezon_baslangici)
                stages.append(
                    EvreYanit(
                        kod=stage.kod, ad=stage.ad, baslangic=start, bitis=end, baslangic_aagg=start_m, bitis_aagg=end_m,
                        ozel=special is not None, kc=kc.get(stage.kod), sezon=season_year,
                    )
                )
        return FenolojiYanit(
            sezon=year, urun=garden.urun, cesit_kodu=garden.cesit_kodu, kural=_meta(rules.fenoloji),
            kc_kural=_meta(rules.kc), kural_yok=False, evreler=stages,
        )

    async def set_phenology_override(self, garden_id: uuid.UUID, stage: str, body: FenolojiDuzeltme) -> FenolojiYanit:
        garden = await self._garden(garden_id)
        rules = cat.effective_rules(self.catalog, garden.urun, garden.cesit_kodu)
        if rules.fenoloji is None or stage not in {e.kod for e in rules.fenoloji.evreler}:
            raise AppError(404, AppErrorCode.NOT_FOUND, "Bu ürün için böyle bir fenoloji evresi yok.")
        await self.repo.set_override(garden_id, stage, body.baslangic, body.bitis)
        return await self.phenology(garden_id, None)

    async def reset_phenology_override(self, garden_id: uuid.UUID, stage: str) -> FenolojiYanit:
        await self._garden(garden_id)
        await self.repo.delete_override(garden_id, stage)
        return await self.phenology(garden_id, None)

    # ------------------------------------------------------------------ seriler
    async def series(self, garden_id: uuid.UUID, season: int | None) -> SerilerYanit:
        garden = await self._garden(garden_id)
        today = self._today()
        year = self._season_year(season, today)
        start = date(year, 10, 1)
        season_end = date(year + 1, 9, 30)
        end = min(season_end, today - timedelta(days=1))
        rules = cat.effective_rules(self.catalog, garden.urun, garden.cesit_kodu)
        base_c = rules.gdd.taban_c if rules.gdd else None
        notes: list[str] = []
        if base_c is None:
            notes.append("Bu ürün için GDD tabanı tanımlı değil; etkili sıcaklık toplamı hesaplanamadı.")

        empty = SerilerYanit(
            sezon=year, sezon_baslangici=start, sezon_bitisi=season_end, gdd_taban_c=base_c, gdd_kural=_meta(rules.gdd),
            gunler=[], ozet=SeriOzeti(son_gun=None, yagis_birikimli_mm=None, onceki_ayni_gun_yagis_mm=None, gdd_birikimli=None, onceki_ayni_gun_gdd=None),
            eksik_gun=0, onceki_sezon_var=False, notlar=[*notes, "Sezon yeni başladı; henüz günlük veri yok."],
        )
        if end < start:
            return empty

        limit = self.settings.weather_history_days
        prev_start = date(year - 1, 10, 1)
        prev_end = one_year_earlier(end)
        fetch_start = prev_start if (end - prev_start).days <= limit else start
        history = await self.weather.history(garden_id, fetch_start, end)
        rows = {g.tarih: DayWeather(g.tarih, g.min, g.max, g.yagis_mm) for g in history.gunler}

        current = build_season(rows, start, end, base_c)
        has_prev = fetch_start == prev_start and coverage(rows, prev_start, prev_end) >= self.settings.agro_prev_season_min_coverage
        previous = build_season(rows, prev_start, prev_end, base_c) if has_prev else []
        if not has_prev:
            notes.append("Geçen sezonun hava verisi eksik olduğundan karşılaştırma gösterilmiyor.")

        missing = sum(1 for d in current if d.yagis_mm is None)
        days = []
        for i, day in enumerate(current):
            prev = previous[i] if i < len(previous) else None
            days.append(
                SeriGunu(
                    tarih=day.tarih, tmin=day.tmin, tmax=day.tmax, yagis_mm=day.yagis_mm,
                    yagis_birikimli_mm=day.yagis_birikimli_mm,
                    onceki_yagis_birikimli_mm=prev.yagis_birikimli_mm if prev else None,
                    gdd=day.gdd, gdd_birikimli=day.gdd_birikimli,
                    onceki_gdd_birikimli=prev.gdd_birikimli if prev else None,
                )
            )
        last = days[-1]
        summary = SeriOzeti(
            son_gun=last.tarih, yagis_birikimli_mm=last.yagis_birikimli_mm,
            onceki_ayni_gun_yagis_mm=last.onceki_yagis_birikimli_mm, gdd_birikimli=last.gdd_birikimli,
            onceki_ayni_gun_gdd=last.onceki_gdd_birikimli,
        )
        return SerilerYanit(
            sezon=year, sezon_baslangici=start, sezon_bitisi=season_end, gdd_taban_c=base_c, gdd_kural=_meta(rules.gdd),
            gunler=days, ozet=summary, eksik_gun=missing, onceki_sezon_var=has_prev, notlar=notes,
        )

    # ------------------------------------------------------------------ skor
    async def _weather_or_none(self, garden_id: uuid.UUID) -> HavaYanit | None:
        try:
            return await self.weather.get(garden_id)
        except AppError:
            return None

    async def assess(self, garden_id: uuid.UUID) -> tuple[Skor, list[SceneWithIndices], HavaYanit | None]:
        await self._garden(garden_id)
        scenes = await self.ndvi.list_scenes(garden_id)
        weather = await self._weather_or_none(garden_id)
        sat_levels, _ = satellite_severities(scenes)
        weather_levels: list[Seviye] | None = [a.seviye for a in weather.uyarilar] if weather else None
        result = assess(
            scene_values(scenes), spans=score_spans(), sat_severities=sat_levels,
            weather_severities=weather_levels, today=self._today(), cfg=ScoreConfig.from_settings(self.settings),
        )
        return result, scenes, weather

    async def status(self, garden_id: uuid.UUID) -> DurumYanit:
        result, _, _ = await self.assess(garden_id)
        return to_status_response(result, self._today())

    # ------------------------------------------------------------------ bugün
    async def today(self, garden_id: uuid.UUID) -> BugunYanit:
        _, scenes, weather = await self.assess(garden_id)
        today = self._today()
        _, sat = satellite_severities(scenes)
        spray = []
        if weather:
            for day in weather.gunler[:2]:
                if day.ilaclama.en_iyi_aralik:
                    spray.append((day.tarih, *day.ilaclama.en_iyi_aralik))
        data = Girdi(
            hava_uyarilari=[(a.seviye, a.baslik, a.mesaj) for a in (weather.uyarilar if weather else [])],
            zararli_riskleri=[],  # 8B: risk motoru bağlanınca dolar
            ilaclama=spray,
            uydu_uyarilari=sat,
            sulama=None,  # 8B: sulama önerisi bağlanınca dolar
        )
        items = build_today(data, today, self.settings.today_priority, self.settings.today_max_items)
        return BugunYanit(tarih=today, maddeler=[BugunMaddesiYanit(**i.__dict__) for i in items])
