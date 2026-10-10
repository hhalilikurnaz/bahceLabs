import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Any

from bahcelab_backend.config import get_settings
from bahcelab_backend.domain.gardens.repository import GardenRepository, GardenRow
from bahcelab_backend.domain.ndvi.models import NdviJobModel, NdviObservationModel
from bahcelab_backend.domain.ndvi.repository import NdviRepository
from bahcelab_backend.domain.ndvi.rules import drop_alert
from bahcelab_backend.domain.ndvi.runner import start_job
from bahcelab_backend.domain.ndvi.schemas import NdviGozlem, NdviIs, NdviYanit
from bahcelab_backend.shared.errors import AppError, AppErrorCode
from bahcelab_backend.shared.storage import StorageBackend


def to_gozlem(o: NdviObservationModel) -> NdviGozlem:
    zones = (o.sorunlu_bolge_geojson or {}).get("features", [])
    return NdviGozlem(
        tarih=o.tarih,
        durum=o.durum,
        scene_id=o.scene_id,
        bulut_orani=o.bulut_orani,
        gecerli_piksel_orani=o.gecerli_piksel_orani,
        ortalama=o.ortalama,
        medyan=o.medyan,
        p10=o.p10,
        p90=o.p90,
        min=o.minimum,
        max=o.maksimum,
        png_var=bool(o.png_yolu),
        koordinatlar=o.goruntu_koordinatlari,
        sorunlu_bolge_sayisi=len(zones),
        kaynak=o.kaynak,
        surum=int(o.created_at.timestamp()) if o.created_at else 0,
    )


def to_is(job: NdviJobModel) -> NdviIs:
    return NdviIs(
        id=job.id,
        tur=job.tur,
        durum=job.durum,
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
        """Aktif iş yoksa yeni iş açar ve arka plana verir. NDVI kapalıysa None."""
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

    async def restart_after_boundary_change(self, garden_id: uuid.UUID) -> None:
        """Sınır değişti: eski kayıtlar ve PNG'ler silinir, devam eden iş iptal edilir, baştan işlenir."""
        active = await self.repo.active_job(garden_id)
        if active is not None:
            active.durum = "hata"
            active.hata_mesaji = "Bahçe sınırı değiştiği için iptal edildi."
            active.bitis = datetime.now(UTC)
            await self.repo.session.flush()
        await self.repo.delete_observations(garden_id)
        self.storage.delete_prefix(f"ndvi/{garden_id}")
        await self.enqueue(garden_id, "yeniden")

    def purge_files(self, garden_id: uuid.UUID) -> None:
        self.storage.delete_prefix(f"ndvi/{garden_id}")

    async def refresh(self, garden_id: uuid.UUID) -> NdviJobModel:
        """«Şimdi güncelle»: örnek veri varsa gerçek veriyle değiştirir; yoksa yeni sahneleri ekler."""
        active = await self.repo.active_job(garden_id)
        if active is not None:
            return active
        if not get_settings().ndvi_enabled:
            raise AppError(503, AppErrorCode.INTERNAL_ERROR, "Uydu görüntüsü işleme şu an kapalı.")

        tur = "guncelleme"
        if await self.repo.has_sample_data(garden_id):
            for key in await self.repo.png_keys(garden_id, only_sample=True):
                self.storage.delete(key)
            await self.repo.delete_observations(garden_id, only_sample=True)
            tur = "ilk"
        elif not await self.repo.existing_dates(garden_id):
            tur = "ilk"

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

    async def overview(self, garden_id: uuid.UUID) -> NdviYanit:
        await self._garden(garden_id)
        observations = await self.repo.list_observations(garden_id)
        sample = any(o.kaynak == "ornek" for o in observations)

        job = await self.repo.active_job(garden_id)
        last_attempt = await self.repo.last_attempt_at(garden_id)
        settings = get_settings()
        stale = last_attempt is None or datetime.now(UTC) - last_attempt > timedelta(
            hours=settings.ndvi_refresh_hours
        )
        # Bahçe açıldığında son kontrolden 12 saat geçtiyse yeni sahne var mı diye bakılır.
        # Örnek veri bilerek gerçek veriyle karışmaz: yalnızca «Şimdi güncelle» ile değişir.
        if job is None and stale and not sample:
            job = await self.coordinator.enqueue(garden_id, "guncelleme" if observations else "ilk")

        latest = job or await self.repo.latest_job(garden_id)
        alert = drop_alert(observations)
        return NdviYanit(
            gozlemler=[to_gozlem(o) for o in observations],
            isleme=to_is(latest) if latest else None,
            son_kontrol=last_attempt,
            uyarilar=[alert] if alert else [],
            ornek_veri=sample,
        )

    async def refresh(self, garden_id: uuid.UUID) -> NdviIs:
        await self._garden(garden_id)
        return to_is(await self.coordinator.refresh(garden_id))

    async def _observation(self, garden_id: uuid.UUID, tarih: date) -> NdviObservationModel:
        await self._garden(garden_id)
        observation = await self.repo.get_observation(garden_id, tarih)
        if observation is None or observation.durum != "tamam":
            raise AppError(404, AppErrorCode.NOT_FOUND, "Bu tarih için NDVI görüntüsü yok.")
        return observation

    async def png(self, garden_id: uuid.UUID, tarih: date) -> bytes:
        observation = await self._observation(garden_id, tarih)
        if not observation.png_yolu or not self.storage.exists(observation.png_yolu):
            raise AppError(404, AppErrorCode.NOT_FOUND, "NDVI görüntüsü bulunamadı.")
        return self.storage.read(observation.png_yolu)

    async def zones(self, garden_id: uuid.UUID, tarih: date) -> dict[str, Any]:
        observation = await self._observation(garden_id, tarih)
        return observation.sorunlu_bolge_geojson or {"type": "FeatureCollection", "features": []}
