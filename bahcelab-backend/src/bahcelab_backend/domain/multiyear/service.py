"""Çok yıllık bölgeler servisi: işi başlatma, ilerleme, sonuç (sürümlü), yıl dahil/hariç ve yıl görselleri."""

from __future__ import annotations

import asyncio
import math
import uuid
from datetime import UTC, date, datetime
from typing import Any, Literal, Protocol

import numpy as np
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.config import Settings, get_settings
from bahcelab_backend.domain.agro import catalog as cat
from bahcelab_backend.domain.gardens.models import GardenModel
from bahcelab_backend.domain.gardens.repository import GardenRepository
from bahcelab_backend.domain.imagery.provider import ImageryError, ImageryProvider
from bahcelab_backend.domain.multiyear.composite import window_dates
from bahcelab_backend.domain.multiyear.grid import canonical_grid, garden_mask
from bahcelab_backend.domain.multiyear.models import (
    MultiyearResultModel,
    MultiyearRunModel,
    MultiyearYearModel,
)
from bahcelab_backend.domain.multiyear.processor import composite_key, decode_array
from bahcelab_backend.domain.multiyear.repository import MultiyearRepository
from bahcelab_backend.domain.multiyear.schemas import (
    BolgeOzeti,
    CokYillikDurum,
    CokYillikSonuc,
    YilBilgisi,
    YilDurumu,
    YillarGuncelle,
)
from bahcelab_backend.domain.multiyear.vector import class_polygons
from bahcelab_backend.domain.multiyear.zoning import (
    YearMap,
    ZoningConfig,
    ZoningResult,
    compute_zones,
)
from bahcelab_backend.domain.ndvi.indices import INDICES
from bahcelab_backend.domain.ndvi.processing import colorize, render_clipped_png
from bahcelab_backend.shared.errors import AppError, AppErrorCode
from bahcelab_backend.shared.storage import StorageBackend

NOTE = "Bölgeler ağaç gücünü gösterir; hasat kayıtlarıyla (Adım 11) verim potansiyeli olarak doğrulanacak."
ZONE_NAMES = {3: ["Zayıf", "Orta", "Güçlü"], 5: ["En zayıf", "Zayıf", "Orta", "Güçlü", "En güçlü"]}
STABILITY_NAMES = {1: "dusuk", 2: "orta", 3: "yuksek"}
DIRECTIONS = ["kuzey", "kuzeydoğu", "doğu", "güneydoğu", "güney", "güneybatı", "batı", "kuzeybatı"]


class YearQueue(Protocol):
    async def enqueue_year(self, garden_id: uuid.UUID, year: int) -> None: ...


def zoning_config(settings: Settings) -> ZoningConfig:
    return ZoningConfig(
        min_years=settings.multiyear_min_years,
        year_min_correlation=settings.multiyear_year_min_correlation,
        min_year_coverage=settings.multiyear_min_year_coverage,
        min_pixel_year_share=settings.multiyear_min_pixel_year_share,
        smoothing_sigma_px=settings.multiyear_smoothing_sigma_px,
        min_zone_area_m2=settings.multiyear_min_zone_area_m2,
        homogeneous_diff_percent=settings.multiyear_homogeneous_diff_percent,
        stability_high=settings.multiyear_stability_high,
        stability_mid=settings.multiyear_stability_mid,
        weak_zone_diff_percent=settings.multiyear_weak_zone_diff_percent,
    )


def window_tag(index_id: str, month_start: int, month_end: int) -> str:
    return f"{index_id}:{month_start:02d}-{month_end:02d}"


def parse_window(tag: str) -> tuple[int, int, str]:
    index_id, months = tag.split(":")
    start, end = months.split("-")
    return int(start), int(end), index_id


def last_complete_year(today: date, month_end: int) -> int:
    """Analiz penceresi tamamlanmış son yıl (içinde bulunulan yılın penceresi bitmediyse önceki yıl)."""
    _, end = window_dates(today.year, 1, month_end)
    return today.year if today > end else today.year - 1


def describe_zones(zones: list[dict[str, Any]], centroids: dict[int, tuple[float, float]], garden_centroid: tuple[float, float], homogeneous: bool, mid: float) -> list[str]:
    """Kısa çiftçi yorumları: en güçlü/zayıf kesim ve istikrarı. Homojen bahçede bölge yorumu yapılmaz."""
    if homogeneous or len(zones) < 2:
        return ["Bahçe büyük ölçüde homojen: kesimler arasında ağaç gücü farkı küçük."]
    out: list[str] = []
    best, worst = zones[-1], zones[0]

    def direction(cls: int) -> str:
        cx, cy = centroids.get(cls, garden_centroid)
        angle = (math.degrees(math.atan2(cx - garden_centroid[0], cy - garden_centroid[1])) + 360.0) % 360.0
        return DIRECTIONS[int((angle + 22.5) // 45) % 8]

    stable_best = (best["istikrar"] or 0.0) >= mid
    out.append(
        f"{direction(best['sinif']).capitalize()} kesim yıllardır bahçenin en güçlü kısmı."
        if stable_best
        else f"{direction(best['sinif']).capitalize()} kesim en güçlü görünüyor; ancak yıllar arasında değişiyor."
    )
    if worst["kontrol_onerisi"]:
        out.append(f"{direction(worst['sinif']).capitalize()} kesim yıllardır zayıf kalıyor; yerinde kontrol edin.")
    return out


class MultiyearService:
    def __init__(
        self,
        session: AsyncSession,
        workspace_id: uuid.UUID,
        provider: ImageryProvider,
        storage: StorageBackend,
        queue: YearQueue,
        settings: Settings | None = None,
    ) -> None:
        self.session = session
        self.gardens = GardenRepository(session, workspace_id)
        self.repo = MultiyearRepository(session)
        self.provider, self.storage, self.queue = provider, storage, queue
        self.settings = settings or get_settings()
        self.workspace_id = workspace_id

    async def _garden(self, garden_id: uuid.UUID) -> tuple[GardenModel, dict[str, Any]]:
        row = await self.gardens.get(garden_id)
        if row is None:
            raise AppError(404, AppErrorCode.NOT_FOUND, "Bahçe bulunamadı.")
        return row.garden, row.geojson

    # ------------------------------------------------------------------ başlat
    async def start(self, garden_id: uuid.UUID) -> CokYillikDurum:
        garden, geometry = await self._garden(garden_id)
        window = cat.load_catalog().urun(garden.urun)
        rule = window.analiz_penceresi if window else None
        if rule is None:
            raise AppError(422, AppErrorCode.VALIDATION_ERROR, "Bu ürün için çok yıllık analiz penceresi tanımlı değil.")
        if INDICES.get(rule.indeks) is None or rule.indeks not in self.provider.capabilities.desteklenen_indeksler:
            raise AppError(422, AppErrorCode.VALIDATION_ERROR, "Seçili uydu kaynağı bu analiz için gereken bantları sağlamıyor.")
        try:
            first = await asyncio.to_thread(self.provider.first_scene_date, geometry)
        except ImageryError as exc:
            raise AppError(502, AppErrorCode.INTERNAL_ERROR, str(exc)) from exc
        today = datetime.now(UTC).date()
        if first is None:
            raise AppError(422, AppErrorCode.VALIDATION_ERROR, "Bu konum için uydu arşivinde görüntü bulunamadı.")
        first_year, last_year = first.year, last_complete_year(today, rule.ay_bitis)
        if first_year > last_year:
            raise AppError(422, AppErrorCode.VALIDATION_ERROR, "Henüz tamamlanmış bir analiz yılı yok.")

        tag = window_tag(rule.indeks, rule.ay_baslangic, rule.ay_bitis)
        ghash = await self.repo.geometry_hash(garden_id) or ""
        run = await self.repo.get_run(garden_id)
        changed = run is None or run.provider != self.provider.capabilities.ad or run.pencere != tag or run.geometry_hash != ghash
        await self.repo.save_run(
            MultiyearRunModel(
                garden_id=garden_id, provider=self.provider.capabilities.ad, arsiv_baslangic=first, baslangic_yili=first_year,
                bitis_yili=last_year, pencere=tag, geometry_hash=ghash,
            )
        )
        window_start, _ = window_dates(first_year, rule.ay_baslangic, rule.ay_bitis)
        to_run: list[int] = []
        for year in range(first_year, last_year + 1):
            partial = year == first_year and first > window_start
            row = await self.repo.ensure_year(garden_id, year, partial)
            if changed and row.durum != "bekliyor":
                self.storage.delete(composite_key(garden_id, year))
                await self.repo.reset_year(row, partial)
            if row.durum in ("bekliyor", "hata"):
                to_run.append(year)
        await self.session.commit()
        for year in to_run:  # kaldığı yerden devam: yalnızca tamamlanmamış yıllar kuyruğa girer
            await self.queue.enqueue_year(garden_id, year)
        self.session.expire_all()  # kuyruk (ayrı oturumlarda) durumu değiştirmiş olabilir: bayat nesneler okunmasın
        return await self.status(garden_id)

    # ------------------------------------------------------------------ ilerleme
    async def status(self, garden_id: uuid.UUID) -> CokYillikDurum:
        await self._garden(garden_id)
        run = await self.repo.get_run(garden_id)
        years = await self.repo.list_years(garden_id)
        if run is None or not years:
            return CokYillikDurum(durum="yok", yillar=[], tamamlanan=0, toplam=0, arsiv_baslangic=None, baslangic_yili=None, bitis_yili=None, saglayici=None)
        done = sum(1 for y in years if y.durum == "tamam")
        failed = [y for y in years if y.durum == "hata"]
        active = next((y.yil for y in years if y.durum == "isleniyor"), None)
        busy = any(y.durum in ("bekliyor", "isleniyor") for y in years)
        overall: Literal["isleniyor", "tamam", "hata"] = "isleniyor" if busy else ("hata" if failed and not done else "tamam")
        message = None
        if not busy and failed:
            message = f"{len(failed)} yıl işlenemedi; «Yeniden dene» ile devam edebilirsiniz."
        return CokYillikDurum(
            durum=overall,
            yillar=[
                YilDurumu(
                    yil=y.yil, durum=y.durum, sahne_sayisi=y.sahne_sayisi, aday_sayisi=y.aday_sayisi,  # type: ignore[arg-type]
                    kismi=y.kismi, hata_mesaji=y.hata_mesaji, sure_saniye=y.sure_saniye,
                )
                for y in years
            ],
            tamamlanan=done, toplam=len(years), arsiv_baslangic=run.arsiv_baslangic, baslangic_yili=run.baslangic_yili,
            bitis_yili=run.bitis_yili, saglayici=run.provider, aktif_yil=active, mesaj=message,
        )

    # ------------------------------------------------------------------ hesaplama
    async def _load_year_maps(self, garden_id: uuid.UUID, years: list[MultiyearYearModel]) -> list[YearMap]:
        maps: list[YearMap] = []
        for y in years:
            if y.durum == "tamam" and y.kompozit_yolu and y.sahne_sayisi >= self.settings.multiyear_min_net_scenes and self.storage.exists(y.kompozit_yolu):
                maps.append(YearMap(y.yil, decode_array(self.storage.read(y.kompozit_yolu))))
        return maps

    async def compute(self, garden_id: uuid.UUID, k: int) -> MultiyearResultModel:
        """Kompozitlerden bölgeleri hesaplar, yıl işaretlerini günceller ve YENİ sürüm olarak PostGIS'e yazar."""
        _, geometry = await self._garden(garden_id)
        years = await self.repo.list_years(garden_id)
        grid = canonical_grid(geometry)
        mask = garden_mask(grid, geometry)
        maps = await self._load_year_maps(garden_id, years)
        manual = {y.yil: y.dahil_elle for y in years if y.dahil_elle is not None}
        cfg = zoning_config(self.settings)
        result = await asyncio.to_thread(compute_zones, maps, mask, k, cfg, manual)  # CPU ağırlıklı: olay döngüsünü tutmaz

        by_year = {a.year: a for a in result.assessments}
        for y in years:
            a = by_year.get(y.yil)
            if a is not None:
                y.uyumsuz, y.korelasyon, y.uyumsuz_nedeni, y.kapsam = a.incompatible, a.correlation, a.reason, a.coverage
            elif y.durum == "tamam":
                y.uyumsuz, y.korelasyon, y.kapsam = True, None, None
                y.uyumsuz_nedeni = f"Yeterli net görüntü yok ({y.sahne_sayisi} sahne)" if y.sahne_sayisi else "Bu yıl net görüntü yok"
        version = await self.repo.next_version(garden_id, k)
        model = MultiyearResultModel(
            garden_id=garden_id, bolge_sayisi=k, versiyon=version, durum="tamam" if result.status == "ok" else "yetersiz",
            mesaj=result.message, yillar=result.years_used, homojen=result.homogeneous, yayilim_yuzde=result.spread_percent,
            bahce_ortalamasi=result.garden_mean, parametreler={"min_yil": cfg.min_years, "yumusatma_px": cfg.smoothing_sigma_px, "en_kucuk_bolge_m2": cfg.min_zone_area_m2},
        )
        zones = self._zone_rows(result, grid, geometry) if result.status == "ok" else []
        await self.repo.add_result(model, zones)
        await self.session.commit()
        return model

    def _zone_rows(self, result: ZoningResult, grid: Any, geometry: dict[str, Any]) -> list[tuple[str, int, Any, dict[str, float | None]]]:
        assert result.labels is not None and result.stability_class is not None
        rows: list[tuple[str, int, Any, dict[str, float | None]]] = []
        polygons = class_polygons(result.labels, grid, geometry, simplify_m=self.settings.multiyear_simplify_m, smooth_m=self.settings.multiyear_smooth_m)
        stats = {z.cls: z for z in result.zones}
        for cls, geom in polygons.items():
            z = stats[cls]
            rows.append(("bolge", cls, geom, {"alan_m2": z.area_m2, "pay": z.share, "fark_yuzde": z.diff_percent, "istikrar": z.stability_mean, "ortalama": z.mean_raw}))
        total = int((result.labels > 0).sum()) or 1
        stab_polys = class_polygons(result.stability_class, grid, geometry, simplify_m=self.settings.multiyear_simplify_m, smooth_m=self.settings.multiyear_smooth_m)
        for cls, geom in stab_polys.items():
            n = int((result.stability_class == cls).sum())
            rows.append(("istikrar", cls, geom, {"alan_m2": n * 100.0, "pay": n / total, "fark_yuzde": None, "istikrar": None, "ortalama": None}))
        return rows

    # ------------------------------------------------------------------ sonuç
    async def result(self, garden_id: uuid.UUID, k: int) -> CokYillikSonuc:
        await self._garden(garden_id)
        if k not in self.settings.multiyear_zone_counts:
            raise AppError(422, AppErrorCode.VALIDATION_ERROR, f"Bölge sayısı {', '.join(str(c) for c in self.settings.multiyear_zone_counts)} olabilir.")
        st = await self.status(garden_id)
        if st.durum == "yok":
            return self._empty("yok", "Çok yıllık analiz henüz başlatılmadı.", k, [])
        if st.durum == "isleniyor":
            return self._empty("islem_suruyor", f"Analiz sürüyor ({st.tamamlanan}/{st.toplam} yıl).", k, await self._year_infos(garden_id, None))
        model = await self.repo.active_result(garden_id, k)
        if model is None:
            model = await self.compute(garden_id, k)
        return await self._build(garden_id, model)

    def _empty(self, status: Literal["yok", "islem_suruyor", "yetersiz"], message: str, k: int, years: list[YilBilgisi]) -> CokYillikSonuc:
        return CokYillikSonuc(
            durum=status, mesaj=message, bolge_sayisi=k, versiyon=None, hesaplama=None, yil_araligi=None, yillar=years, bolgeler=None,
            istikrar=None, ozet=[], homojen=False, yayilim_yuzde=None, yorumlar=[], not_=NOTE,
        )

    async def _year_infos(self, garden_id: uuid.UUID, used: list[int] | None) -> list[YilBilgisi]:
        years = await self.repo.list_years(garden_id)
        return [
            YilBilgisi(
                yil=y.yil, sahne_sayisi=y.sahne_sayisi, kismi=y.kismi, kapsam=y.kapsam, korelasyon=y.korelasyon, uyumsuz=y.uyumsuz,
                uyumsuz_nedeni=y.uyumsuz_nedeni, dahil=(y.yil in used) if used is not None else False, elle=y.dahil_elle,
            )
            for y in years
        ]

    async def _build(self, garden_id: uuid.UUID, model: MultiyearResultModel) -> CokYillikSonuc:
        years = await self._year_infos(garden_id, list(model.yillar))
        if model.durum != "tamam":
            return CokYillikSonuc(
                durum="yetersiz", mesaj=model.mesaj, bolge_sayisi=model.bolge_sayisi, versiyon=model.versiyon, hesaplama=model.created_at,
                yil_araligi=None, yillar=years, bolgeler=None, istikrar=None, ozet=[], homojen=False, yayilim_yuzde=None, yorumlar=[], not_=NOTE,
            )
        rows = await self.repo.zones(model.id)
        cfg = zoning_config(self.settings)
        names = ZONE_NAMES[model.bolge_sayisi]
        summary: list[BolgeOzeti] = []
        bolge_features: list[dict[str, Any]] = []
        stab_features: list[dict[str, Any]] = []
        centroids: dict[int, tuple[float, float]] = {}
        from shapely.geometry import shape  # gecikmeli: yalnızca yanıt kurarken

        garden_center = (0.0, 0.0)
        areas = 0.0
        for r in rows:
            z = r.zone
            if z.tur == "bolge":
                c = shape(r.geojson).centroid
                centroids[z.sinif] = (c.x, c.y)
                garden_center = (garden_center[0] + c.x * z.alan_m2, garden_center[1] + c.y * z.alan_m2)
                areas += z.alan_m2
        if areas:
            garden_center = (garden_center[0] / areas, garden_center[1] / areas)
        zone_dicts: list[dict[str, Any]] = []
        for r in rows:
            z = r.zone
            if z.tur == "bolge":
                stability_class = "yuksek" if (z.istikrar or 0) >= cfg.stability_high else "orta" if (z.istikrar or 0) >= cfg.stability_mid else "dusuk"
                weak = (z.sinif == 1 and not model.homojen and (z.fark_yuzde or 0.0) <= -cfg.weak_zone_diff_percent and (z.istikrar or 0.0) >= cfg.stability_mid)
                item = BolgeOzeti(
                    sinif=z.sinif, ad=names[z.sinif - 1] if z.sinif - 1 < len(names) else f"Bölge {z.sinif}", alan_m2=round(z.alan_m2, 1),
                    alan_dekar=round(z.alan_m2 / 1000.0, 2), pay=round(z.pay, 4), fark_yuzde=None if z.fark_yuzde is None else round(z.fark_yuzde, 1),
                    istikrar=None if z.istikrar is None else round(z.istikrar, 3), istikrar_sinifi=stability_class,  # type: ignore[arg-type]
                    kontrol_onerisi=weak,
                )
                summary.append(item)
                zone_dicts.append(item.model_dump())
                bolge_features.append({"type": "Feature", "geometry": r.geojson, "properties": item.model_dump()})
            else:
                stab_features.append(
                    {"type": "Feature", "geometry": r.geojson, "properties": {"sinif": STABILITY_NAMES[z.sinif], "alan_m2": round(z.alan_m2, 1), "pay": round(z.pay, 4)}}
                )
        used = sorted(model.yillar)
        return CokYillikSonuc(
            durum="hazir", mesaj=None, bolge_sayisi=model.bolge_sayisi, versiyon=model.versiyon, hesaplama=model.created_at,
            yil_araligi=f"{used[0]}–{used[-1]}" if used else None, yillar=years,
            bolgeler={"type": "FeatureCollection", "features": bolge_features}, istikrar={"type": "FeatureCollection", "features": stab_features},
            ozet=summary, homojen=model.homojen, yayilim_yuzde=model.yayilim_yuzde,
            yorumlar=describe_zones(zone_dicts, centroids, garden_center, model.homojen, cfg.stability_mid), not_=NOTE,
        )

    # ------------------------------------------------------------------ yıl dahil/hariç
    async def update_years(self, garden_id: uuid.UUID, body: YillarGuncelle) -> CokYillikSonuc:
        await self._garden(garden_id)
        years = {y.yil: y for y in await self.repo.list_years(garden_id)}
        unknown = [s.yil for s in body.yillar if s.yil not in years]
        if unknown:
            raise AppError(422, AppErrorCode.VALIDATION_ERROR, f"Bilinmeyen yıl: {unknown[0]}")
        for choice in body.yillar:
            years[choice.yil].dahil_elle = choice.dahil
        await self.session.commit()
        if (await self.status(garden_id)).durum == "isleniyor":
            return await self.result(garden_id, body.bolge_sayisi)
        ks = sorted(set(await self.repo.active_ks(garden_id)) | {body.bolge_sayisi})
        for k in ks:  # görünümler tutarlı kalsın: mevcut tüm bölge sayıları yeniden hesaplanır
            await self.compute(garden_id, k)
        return await self.result(garden_id, body.bolge_sayisi)

    # ------------------------------------------------------------------ yıl görseli
    async def year_png(self, garden_id: uuid.UUID, year: int) -> bytes:
        _, geometry = await self._garden(garden_id)
        row = await self.repo.get_year(garden_id, year)
        if row is None or row.durum != "tamam" or not row.kompozit_yolu or not self.storage.exists(row.kompozit_yolu):
            raise AppError(404, AppErrorCode.NOT_FOUND, "Bu yıl için görüntü yok.")
        values = decode_array(self.storage.read(row.kompozit_yolu))
        grid = canonical_grid(geometry)
        mask = garden_mask(grid, geometry)
        from bahcelab_backend.domain.multiyear.zoning import rank_normalize

        ranks = rank_normalize(values, mask)  # yıl içi bağıl güç (0–1): yıllar aynı palette karşılaştırılır
        rgba = colorize(np.where(mask, ranks, np.nan), mask & np.isfinite(ranks), 0.0, 1.0, "yesil")
        from rasterio.warp import transform_geom

        return render_clipped_png(rgba, transform_geom("EPSG:4326", f"EPSG:{grid.epsg}", geometry), grid.transform)
