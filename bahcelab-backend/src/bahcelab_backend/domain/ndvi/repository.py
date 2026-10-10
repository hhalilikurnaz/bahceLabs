import uuid
from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import UTC, date, datetime

from sqlalchemy import delete, func, select, text, tuple_, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import defer, undefer

from bahcelab_backend.domain.ndvi.models import (
    JOB_ACTIVE,
    IndexObservationModel,
    NdviJobModel,
    SceneObservationModel,
)


@dataclass
class SceneWithIndices:
    scene: SceneObservationModel
    indices: dict[str, IndexObservationModel] = field(default_factory=dict)


class NdviRepository:
    """Yetki denetimi servis katmanında (bahçe kullanıcının workspace'inde mi) yapılır."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # --- sahne ve indeks gözlemleri
    async def list_scenes(self, garden_id: uuid.UUID) -> list[SceneWithIndices]:
        scenes = (
            (
                await self.session.execute(
                    select(SceneObservationModel)
                    .where(SceneObservationModel.garden_id == garden_id)
                    .order_by(SceneObservationModel.tarih)
                )
            )
            .scalars()
            .all()
        )
        rows = (
            (
                await self.session.execute(
                    select(IndexObservationModel).where(
                        IndexObservationModel.garden_id == garden_id
                    )
                )
            )
            .scalars()
            .all()
        )
        by_date: dict[date, dict[str, IndexObservationModel]] = {}
        for row in rows:
            by_date.setdefault(row.tarih, {})[row.indeks] = row
        return [SceneWithIndices(s, by_date.get(s.tarih, {})) for s in scenes]

    async def list_scenes_bulk(
        self, garden_ids: Sequence[uuid.UUID]
    ) -> dict[uuid.UUID, list[SceneWithIndices]]:
        """Birden çok bahçenin sahneleri: 3 sorgu (bahçe sayısından bağımsız, N+1 yok).

        Sorunlu bölge GeoJSON'ı ağırdır; yalnızca her (bahçe, indeks) için en son geçerli tarihte yüklenir
        (uyarı kuralları çok-indeks örtüşmesini yalnızca son görüntüde hesaplar).
        """
        result: dict[uuid.UUID, list[SceneWithIndices]] = {gid: [] for gid in garden_ids}
        if not garden_ids:
            return result
        scenes = (
            (
                await self.session.execute(
                    select(SceneObservationModel)
                    .where(SceneObservationModel.garden_id.in_(garden_ids))
                    .order_by(SceneObservationModel.garden_id, SceneObservationModel.tarih)
                )
            )
            .scalars()
            .all()
        )
        rows = (
            (
                await self.session.execute(
                    select(IndexObservationModel)
                    .options(defer(IndexObservationModel.sorunlu_bolge_geojson))
                    .where(IndexObservationModel.garden_id.in_(garden_ids))
                )
            )
            .scalars()
            .all()
        )
        latest = (
            select(
                IndexObservationModel.garden_id,
                IndexObservationModel.indeks,
                func.max(IndexObservationModel.tarih),
            )
            .where(IndexObservationModel.garden_id.in_(garden_ids))
            .group_by(IndexObservationModel.garden_id, IndexObservationModel.indeks)
        )
        # Aynı satır nesneleri üzerinde ertelenmiş sütunu doldurur (kimlik haritası)
        (
            await self.session.execute(
                select(IndexObservationModel)
                .options(undefer(IndexObservationModel.sorunlu_bolge_geojson))
                .where(
                    tuple_(
                        IndexObservationModel.garden_id,
                        IndexObservationModel.indeks,
                        IndexObservationModel.tarih,
                    ).in_(latest)
                )
            )
        ).scalars().all()
        by_key: dict[tuple[uuid.UUID, date], dict[str, IndexObservationModel]] = {}
        for row in rows:
            by_key.setdefault((row.garden_id, row.tarih), {})[row.indeks] = row
        for scene in scenes:
            result[scene.garden_id].append(
                SceneWithIndices(scene, by_key.get((scene.garden_id, scene.tarih), {}))
            )
        return result

    async def get_scene(self, garden_id: uuid.UUID, tarih: date) -> SceneWithIndices | None:
        scene = (
            await self.session.execute(
                select(SceneObservationModel).where(
                    SceneObservationModel.garden_id == garden_id,
                    SceneObservationModel.tarih == tarih,
                )
            )
        ).scalar_one_or_none()
        if scene is None:
            return None
        rows = (
            (
                await self.session.execute(
                    select(IndexObservationModel).where(
                        IndexObservationModel.garden_id == garden_id,
                        IndexObservationModel.tarih == tarih,
                    )
                )
            )
            .scalars()
            .all()
        )
        return SceneWithIndices(scene, {r.indeks: r for r in rows})

    async def scene_map(self, garden_id: uuid.UUID) -> dict[date, SceneWithIndices]:
        return {item.scene.tarih: item for item in await self.list_scenes(garden_id)}

    async def add_scene(self, scene: SceneObservationModel) -> bool:
        """(garden_id, tarih) zaten varsa eklemez; aynı tarih ikinci kez hesaplanmaz."""
        try:
            async with self.session.begin_nested():
                self.session.add(scene)
                await self.session.flush()
        except IntegrityError:
            return False
        return True

    async def upsert_index(self, row: IndexObservationModel) -> None:
        """Aynı (bahçe, tarih, indeks) varsa (eski kayıt) üzerine yazar."""
        existing = (
            await self.session.execute(
                select(IndexObservationModel).where(
                    IndexObservationModel.garden_id == row.garden_id,
                    IndexObservationModel.tarih == row.tarih,
                    IndexObservationModel.indeks == row.indeks,
                )
            )
        ).scalar_one_or_none()
        if existing is None:
            self.session.add(row)
        else:
            for column in (
                "ortalama",
                "medyan",
                "p10",
                "p90",
                "minimum",
                "maksimum",
                "png_yolu",
                "veri_yolu",
                "sorunlu_bolge_geojson",
            ):
                setattr(existing, column, getattr(row, column))
        await self.session.flush()

    async def storage_keys(self, garden_id: uuid.UUID) -> list[str]:
        """Bahçenin tüm depolama anahtarları."""
        result = await self.session.execute(
            text(
                """
                SELECT s.gercek_renk_png_yolu FROM scene_observations s
                 WHERE s.garden_id = :g AND s.gercek_renk_png_yolu IS NOT NULL
                UNION ALL
                SELECT i.png_yolu FROM index_observations i
                  JOIN scene_observations s ON s.garden_id = i.garden_id AND s.tarih = i.tarih
                 WHERE i.garden_id = :g AND i.png_yolu IS NOT NULL
                UNION ALL
                SELECT i.veri_yolu FROM index_observations i
                  JOIN scene_observations s ON s.garden_id = i.garden_id AND s.tarih = i.tarih
                 WHERE i.garden_id = :g AND i.veri_yolu IS NOT NULL
                """
            ),
            {"g": garden_id},
        )
        return [key for (key,) in result.all()]

    async def delete_observations(self, garden_id: uuid.UUID) -> None:
        # index_observations, scene_observations silinince zincirleme (ON DELETE CASCADE) silinir
        query = delete(SceneObservationModel).where(SceneObservationModel.garden_id == garden_id)
        await self.session.execute(query)

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
        return int(getattr(result, "rowcount", 0) or 0)

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
