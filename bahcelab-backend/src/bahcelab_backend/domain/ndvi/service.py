import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Any, Literal, cast

import numpy as np

from bahcelab_backend.config import get_settings
from bahcelab_backend.domain.agro.catalog import load_catalog
from bahcelab_backend.domain.gardens.repository import GardenRepository, GardenRow
from bahcelab_backend.domain.ndvi.archive import build_archive
from bahcelab_backend.domain.ndvi.indices import INDEX_IDS, INDICES, TRUE_COLOR
from bahcelab_backend.domain.ndvi.models import NdviJobModel
from bahcelab_backend.domain.ndvi.persist import missing_outputs, storage_prefix, thumb_key
from bahcelab_backend.domain.ndvi.repository import NdviRepository, SceneWithIndices
from bahcelab_backend.domain.ndvi.rules import build_alerts
from bahcelab_backend.domain.ndvi.runner import start_job
from bahcelab_backend.domain.ndvi.schemas import (
    ArsivYanit,
    IndeksOzeti,
    IndeksYanit,
    NdviIs,
    SahneGozlemi,
    TipikBantBilgi,
    VerimlilikYanit,
)
from bahcelab_backend.domain.ndvi.thumbnail import make_thumbnail
from bahcelab_backend.domain.ndvi.zones import (
    MIN_OBSERVATIONS,
    GridObservation,
    compute_yield_zones,
)
from bahcelab_backend.shared.errors import AppError, AppErrorCode
from bahcelab_backend.shared.storage import StorageBackend

VALID_OUTPUTS = (*INDEX_IDS, TRUE_COLOR)


def to_gozlem(item: SceneWithIndices) -> SahneGozlemi:
    scene = item.scene
    summaries: dict[str, IndeksOzeti] = {}
    for indeks in INDEX_IDS:
        row = item.indices.get(indeks)
        if row is None:
            continue
        zones = (row.sorunlu_bolge_geojson or {}).get("features", [])
        summaries[indeks] = IndeksOzeti(
            ortalama=row.ortalama,
            medyan=row.medyan,
            p10=row.p10,
            p90=row.p90,
            min=row.minimum,
            max=row.maksimum,
            png_var=bool(row.png_yolu),
            veri_var=bool(row.veri_yolu),
            sorunlu_bolge_sayisi=len(zones),
        )
    return SahneGozlemi(
        tarih=scene.tarih,
        durum=cast(Literal["tamam", "bulutlu"], scene.durum),
        scene_id=scene.scene_id,
        bulut_orani=scene.bulut_orani,
        gecerli_piksel_orani=scene.gecerli_piksel_orani,
        satir=scene.satir,
        sutun=scene.sutun,
        koordinatlar=scene.goruntu_koordinatlari,
        gercek_renk_var=bool(scene.gercek_renk_png_yolu),
        indeksler=summaries,
        kaynak=scene.kaynak,
        surum=int(scene.created_at.timestamp()) if scene.created_at else 0,
    )


def to_is(job: NdviJobModel) -> NdviIs:
    return NdviIs(
        id=job.id,
        tur=cast(Literal["ilk", "guncelleme", "yeniden"], job.tur),
        durum=cast(Literal["bekliyor", "isleniyor", "tamam", "hata"], job.durum),
        toplam=job.toplam,
        islenen=job.islenen,
        hata_mesaji=job.hata_mesaji,
        baslangic=job.baslangic,
        bitis=job.bitis,
    )


class NdviCoordinator:
    """İşleri oluşturur ve arka plana verir; bahçe yaşam döngüsü olayları buradan geçer."""

    def __init__(self, repo: NdviRepository, storage: StorageBackend) -> None:
        self.repo = repo
        self.storage = storage

    async def enqueue(self, garden_id: uuid.UUID, tur: str) -> NdviJobModel | None:
        """Aktif iş yoksa yeni iş açar ve arka plana verir. İşleme kapalıysa None."""
        if not get_settings().ndvi_enabled:
            return None
        job = await self.repo.create_job(garden_id, tur)
        if job is not None:
            # İşleyici iş satırını (ve bahçeyi) kendi bağlantısından okur: önce commit, sonra başlat
            await self.repo.session.commit()
            start_job(job.id)
        return job

    async def start_initial(self, garden_id: uuid.UUID) -> None:
        await self.enqueue(garden_id, "ilk")
        await self._start_backfill(garden_id)
        await self._start_water_feed(garden_id)

    async def _start_water_feed(self, garden_id: uuid.UUID) -> None:
        """ERA5 geçmişi + toprak + doğrulama beslemesi (ADR 0018); uydu işlemesi kapalı olsa da çalışır (hava verisidir)."""
        from bahcelab_backend.jobs.feed import start_garden_feed

        await self.repo.session.commit()  # bahçe satırı görünür olsun
        start_garden_feed(garden_id)

    async def _start_backfill(self, garden_id: uuid.UUID) -> None:
        """Geçmiş doldurma (ADR 0015): bahçe eklenince / sınırı değişince 2015'ten bugüne; işleme kapalıysa çalışmaz."""
        if not get_settings().ndvi_enabled or not get_settings().acq_auto_backfill:
            return
        from bahcelab_backend.database import async_session_factory
        from bahcelab_backend.domain.acquisitions.backfill import (
            BackfillRunner,
            BackfillService,
            month_queue_for,
        )
        from bahcelab_backend.domain.acquisitions.landsat_processor import LANDSAT_SOURCE
        from bahcelab_backend.domain.acquisitions.radar_processor import RADAR_SOURCE
        from bahcelab_backend.domain.imagery.registry import (
            get_imagery_provider,
            get_landsat_provider,
            get_radar_provider,
        )

        await self.repo.session.commit()  # bahçe satırı görünür olsun (görevler kendi bağlantısından okur)
        runner = BackfillRunner(async_session_factory, get_imagery_provider(), self.storage, radar_provider=get_radar_provider(), landsat_provider=get_landsat_provider())
        async with async_session_factory() as session:
            service = BackfillService(session, runner.provider, self.storage, month_queue_for(runner), radar_provider=runner.radar_provider, landsat_provider=runner.landsat_provider)
            await service.start(garden_id)
            await service.start(garden_id, source=RADAR_SOURCE)  # radar: Sentinel-1 RTC, aynı bahçe için ayrı ay görevleri
            await service.start(garden_id, source=LANDSAT_SOURCE)  # Landsat yüzey sıcaklığı (ADR 0017)

    async def restart_after_boundary_change(self, garden_id: uuid.UUID) -> None:
        """Sınır değişti: eski kayıtlar ve dosyalar silinir, devam eden iş iptal edilir, baştan işlenir."""
        active = await self.repo.active_job(garden_id)
        if active is not None:
            active.durum = "hata"
            active.hata_mesaji = "Bahçe sınırı değiştiği için iptal edildi."
            active.bitis = datetime.now(UTC)
            await self.repo.session.flush()
        await self.repo.delete_observations(garden_id)
        self.purge_files(garden_id)
        await self.enqueue(garden_id, "yeniden")
        await self._start_backfill(garden_id)
        await self._start_water_feed(garden_id)  # sınır değişince hücre değişmiş olabilir

    def purge_files(self, garden_id: uuid.UUID) -> None:
        self.storage.delete_prefix(storage_prefix(garden_id))
        self.storage.delete_prefix(f"ndvi/{garden_id}")  # eski (NDVI-only) düzen

    async def refresh(self, garden_id: uuid.UUID) -> NdviJobModel:
        """«Şimdi güncelle»: yeni ve eksik sahneleri işler."""
        active = await self.repo.active_job(garden_id)
        if active is not None:
            return active
        if not get_settings().ndvi_enabled:
            raise AppError(503, AppErrorCode.INTERNAL_ERROR, "Uydu görüntüsü işleme şu an kapalı.")

        tur = "guncelleme" if await self.repo.scene_map(garden_id) else "ilk"

        job = await self.enqueue(garden_id, tur)
        if job is None:  # yarışta başka istek iş açtı
            job = await self.repo.active_job(garden_id)
        if job is None:
            raise AppError(409, AppErrorCode.CONFLICT, "İşlem başlatılamadı, tekrar deneyin.")
        return job


class NdviService:
    def __init__(
        self,
        gardens: GardenRepository,
        repo: NdviRepository,
        coordinator: NdviCoordinator,
        storage: StorageBackend,
    ) -> None:
        self.gardens = gardens
        self.repo = repo
        self.coordinator = coordinator
        self.storage = storage

    async def _garden(self, garden_id: uuid.UUID) -> GardenRow:
        """Yetki: bahçe kullanıcının workspace'inde değilse 404."""
        row = await self.gardens.get(garden_id)
        if row is None:
            raise AppError(404, AppErrorCode.NOT_FOUND, "Bahçe bulunamadı.")
        return row

    async def overview(self, garden_id: uuid.UUID) -> IndeksYanit:
        garden_row = await self._garden(garden_id)
        scenes = await self.repo.list_scenes(garden_id)
        incomplete = any(missing_outputs(s) for s in scenes)

        job = await self.repo.active_job(garden_id)
        last_attempt = await self.repo.last_attempt_at(garden_id)
        latest_job = await self.repo.latest_job(garden_id)
        hours = get_settings().ndvi_refresh_hours
        now = datetime.now(UTC)
        stale = last_attempt is None or now - last_attempt > timedelta(hours=hours)
        # Eski (yalnızca NDVI) kayıtların eksik indeksleri: son deneme hata değilse ya da 1 saat geçtiyse tamamlanır
        retry_ok = (
            latest_job is None
            or latest_job.durum != "hata"
            or (last_attempt is not None and now - last_attempt > timedelta(hours=1))
        )
        # Bahçe açıldığında son kontrolden 12 saat geçtiyse yeni sahne var mı diye bakılır.
        if job is None and (stale or (incomplete and retry_ok)):
            job = await self.coordinator.enqueue(garden_id, "guncelleme" if scenes else "ilk")

        latest = job or latest_job
        product = load_catalog().urun(garden_row.garden.urun)
        bands = {k: TipikBantBilgi(alt=v.alt, ust=v.ust, durum=v.durum) for k, v in (product.tipik_bantlar if product else {}).items()}
        return IndeksYanit(
            gozlemler=[to_gozlem(s) for s in scenes],
            tipik_bantlar=bands,
            isleme=to_is(latest) if latest else None,
            son_kontrol=last_attempt,
            uyarilar=build_alerts(scenes),
            eksik_cikti=incomplete,
        )

    async def archive(
        self, garden_id: uuid.UUID, parametre: str, sezon: int | None, sayfa: int, boyut: int | None
    ) -> ArsivYanit:
        """Görüntü arşivi: seçili sezonun sahneleri (net / en net işaretli, sayfalı)."""
        await self._garden(garden_id)
        self._check_output(parametre)
        settings = get_settings()
        size = min(max(1, boyut or settings.archive_default_page_size), settings.archive_max_page_size)
        scenes = await self.repo.list_scenes(garden_id)
        return build_archive(
            garden_id,
            scenes,
            parametre=parametre,
            sezon=sezon,
            sayfa=sayfa,
            boyut=size,
            net_max=settings.archive_net_cloud_max_percent,
        )

    async def refresh(self, garden_id: uuid.UUID) -> NdviIs:
        await self._garden(garden_id)
        return to_is(await self.coordinator.refresh(garden_id))

    def _check_output(self, indeks: str) -> None:
        if indeks not in VALID_OUTPUTS:
            raise AppError(404, AppErrorCode.NOT_FOUND, "Bilinmeyen indeks.")

    async def _row(self, garden_id: uuid.UUID, indeks: str, tarih: date) -> SceneWithIndices:
        await self._garden(garden_id)
        self._check_output(indeks)
        item = await self.repo.get_scene(garden_id, tarih)
        if item is None or item.scene.durum != "tamam":
            raise AppError(404, AppErrorCode.NOT_FOUND, "Bu tarih için görüntü yok.")
        return item

    async def png(self, garden_id: uuid.UUID, indeks: str, tarih: date) -> bytes:
        item = await self._row(garden_id, indeks, tarih)
        key = (
            item.scene.gercek_renk_png_yolu
            if indeks == TRUE_COLOR
            else (item.indices[indeks].png_yolu if indeks in item.indices else None)
        )
        if not key or not self.storage.exists(key):
            raise AppError(404, AppErrorCode.NOT_FOUND, "Görüntü bulunamadı.")
        return self.storage.read(key)

    async def thumbnail(self, garden_id: uuid.UUID, indeks: str, tarih: date) -> bytes:
        """Küçük resim: ilk istekte tam görüntüden üretilip depolanır, sonra doğrudan okunur."""
        full = await self.png(garden_id, indeks, tarih)  # yetki + varlık denetimi
        key = thumb_key(garden_id, tarih, indeks)
        if self.storage.exists(key):
            return self.storage.read(key)
        data = make_thumbnail(full, get_settings().thumbnail_max_px)
        self.storage.save(key, data)
        return data

    async def grid(self, garden_id: uuid.UUID, indeks: str, tarih: date) -> bytes:
        """Ham indeks değerleri (float32 LE, satır sırası, geçersiz = NaN): kontrastlı mod, fark, karşılaştırma."""
        if indeks == TRUE_COLOR:
            raise AppError(404, AppErrorCode.NOT_FOUND, "Gerçek renk için ham veri yok.")
        item = await self._row(garden_id, indeks, tarih)
        row = item.indices.get(indeks)
        if row is None or not row.veri_yolu or not self.storage.exists(row.veri_yolu):
            raise AppError(404, AppErrorCode.NOT_FOUND, "Ham veri henüz hazır değil.")
        return self.storage.read(row.veri_yolu)

    async def zones(self, garden_id: uuid.UUID, indeks: str, tarih: date) -> dict[str, Any]:
        if indeks == TRUE_COLOR:
            raise AppError(404, AppErrorCode.NOT_FOUND, "Gerçek renk için sorunlu bölge yok.")
        item = await self._row(garden_id, indeks, tarih)
        row = item.indices.get(indeks)
        if row is None:
            raise AppError(404, AppErrorCode.NOT_FOUND, "Bu indeks için kayıt yok.")
        return row.sorunlu_bolge_geojson or {"type": "FeatureCollection", "features": []}

    async def yield_zones(self, garden_id: uuid.UUID, indeks: str) -> VerimlilikYanit:
        """Tüm geçerli geçmiş görüntülerin piksel ortalamasından 3 verimlilik bölgesi (düşük/orta/yüksek)."""
        garden = await self._garden(garden_id)
        if indeks not in ("ndvi", "msavi"):
            raise AppError(
                422,
                AppErrorCode.VALIDATION_ERROR,
                "Verimlilik bölgeleri NDVI veya MSAVI ile hesaplanır.",
            )

        observations: list[GridObservation] = []
        for item in await self.repo.list_scenes(garden_id):
            row = item.indices.get(indeks)
            scene = item.scene
            if scene.durum != "tamam" or row is None or not row.veri_yolu:
                continue
            if not (scene.satir and scene.sutun and scene.goruntu_koordinatlari):
                continue
            if not self.storage.exists(row.veri_yolu):
                continue
            values = np.frombuffer(self.storage.read(row.veri_yolu), dtype="<f4").reshape(
                scene.satir, scene.sutun
            )
            observations.append(
                GridObservation(
                    scene.tarih,
                    values,
                    cast(
                        tuple[tuple[float, float], ...],
                        tuple((float(c[0]), float(c[1])) for c in scene.goruntu_koordinatlari),
                    ),
                )
            )

        result = compute_yield_zones(observations, garden.geojson)
        if result is None:
            raise AppError(
                422,
                AppErrorCode.VALIDATION_ERROR,
                f"Verimlilik bölgeleri için en az {MIN_OBSERVATIONS} geçerli görüntü gerekir "
                f"(şu an {len(observations)}).",
            )
        meta = result.pop("_meta")
        return VerimlilikYanit(indeks=indeks, bolgeler=result, **meta)


__all__ = ["NdviCoordinator", "NdviService", "INDICES"]
