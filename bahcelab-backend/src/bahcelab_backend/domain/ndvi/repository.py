import uuid
from datetime import UTC, date, datetime

from sqlalchemy import delete, func, select, text, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.domain.ndvi.models import JOB_ACTIVE, NdviJobModel, NdviObservationModel


class NdviRepository:
    """Yetki denetimi servis katmanında (bahçe kullanıcının workspace'inde mi) yapılır."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # --- gözlemler
    async def list_observations(self, garden_id: uuid.UUID) -> list[NdviObservationModel]:
        result = await self.session.execute(
            select(NdviObservationModel)
            .where(NdviObservationModel.garden_id == garden_id)
            .order_by(NdviObservationModel.tarih)
        )
        return list(result.scalars().all())

    async def get_observation(
        self, garden_id: uuid.UUID, tarih: date
    ) -> NdviObservationModel | None:
        result = await self.session.execute(
            select(NdviObservationModel).where(
                NdviObservationModel.garden_id == garden_id, NdviObservationModel.tarih == tarih
            )
        )
        return result.scalar_one_or_none()

    async def existing_dates(self, garden_id: uuid.UUID) -> set[date]:
        result = await self.session.execute(
            select(NdviObservationModel.tarih).where(NdviObservationModel.garden_id == garden_id)
        )
        return set(result.scalars().all())

    async def add_observation(self, observation: NdviObservationModel) -> bool:
        """(garden_id, tarih) zaten varsa eklemez; aynı tarih ikinci kez hesaplanmaz."""
        try:
            async with self.session.begin_nested():
                self.session.add(observation)
                await self.session.flush()
        except IntegrityError:
            return False
        return True

    async def png_keys(self, garden_id: uuid.UUID, *, only_sample: bool = False) -> list[str]:
        query = select(NdviObservationModel.png_yolu).where(
            NdviObservationModel.garden_id == garden_id, NdviObservationModel.png_yolu.is_not(None)
        )
        if only_sample:
            query = query.where(NdviObservationModel.kaynak == "ornek")
        return list((await self.session.execute(query)).scalars().all())

    async def delete_observations(self, garden_id: uuid.UUID, *, only_sample: bool = False) -> None:
        query = delete(NdviObservationModel).where(NdviObservationModel.garden_id == garden_id)
        if only_sample:
            query = query.where(NdviObservationModel.kaynak == "ornek")
        await self.session.execute(query)

    async def has_sample_data(self, garden_id: uuid.UUID) -> bool:
        result = await self.session.execute(
            select(func.count())
            .select_from(NdviObservationModel)
            .where(
                NdviObservationModel.garden_id == garden_id, NdviObservationModel.kaynak == "ornek"
            )
        )
        return result.scalar_one() > 0

    # --- işler
    async def active_job(self, garden_id: uuid.UUID) -> NdviJobModel | None:
        result = await self.session.execute(
            select(NdviJobModel).where(
                NdviJobModel.garden_id == garden_id, NdviJobModel.durum.in_(JOB_ACTIVE)
            )
        )
        return result.scalar_one_or_none()

    async def latest_job(self, garden_id: uuid.UUID) -> NdviJobModel | None:
        result = await self.session.execute(
            select(NdviJobModel)
            .where(NdviJobModel.garden_id == garden_id)
            .order_by(NdviJobModel.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def last_attempt_at(self, garden_id: uuid.UUID) -> datetime | None:
        """Son bitmiş işin (başarılı ya da hatalı) bitiş zamanı: otomatik yeniden denemeyi sınırlar."""
        result = await self.session.execute(
            select(func.max(NdviJobModel.bitis)).where(NdviJobModel.garden_id == garden_id)
        )
        return result.scalar_one_or_none()

    async def create_job(self, garden_id: uuid.UUID, tur: str) -> NdviJobModel | None:
        """Aktif iş varsa None (kısmi benzersiz indeks yarışlarda da korur)."""
        job = NdviJobModel(garden_id=garden_id, tur=tur, durum="bekliyor")
        try:
            async with self.session.begin_nested():
                self.session.add(job)
                await self.session.flush()
        except IntegrityError:
            return None
        return job

    async def get_job(self, job_id: uuid.UUID) -> NdviJobModel | None:
        result = await self.session.execute(select(NdviJobModel).where(NdviJobModel.id == job_id))
        return result.scalar_one_or_none()

    async def fail_stale_jobs(self, message: str) -> int:
        """Sunucu yeniden başlayınca yarıda kalan işleri hata olarak işaretler."""
        result = await self.session.execute(
            update(NdviJobModel)
            .where(NdviJobModel.durum.in_(JOB_ACTIVE))
            .values(durum="hata", hata_mesaji=message, bitis=datetime.now(UTC))
        )
        return result.rowcount or 0

    async def lock_geometry_hash(self, garden_id: uuid.UUID) -> str | None:
        """Bahçe satırını paylaşımlı kilitleyip sınırın özetini verir. Sınır güncellemesi (UPDATE) bu
        işlem bitene kadar bekler; böylece «kontrol et + yaz» arasında sınır değişemez."""
        result = await self.session.execute(
            text("SELECT md5(ST_AsText(geom)) FROM gardens WHERE id = :id FOR SHARE"),
            {"id": garden_id},
        )
        return result.scalar_one_or_none()

    async def geometry_hash(self, garden_id: uuid.UUID) -> str | None:
        """Sınır değişti mi anlamak için; None = bahçe silinmiş."""
        result = await self.session.execute(
            text("SELECT md5(ST_AsText(geom)) FROM gardens WHERE id = :id"), {"id": garden_id}
        )
        return result.scalar_one_or_none()
