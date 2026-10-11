import json
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from geoalchemy2.shape import from_shape
from shapely.geometry import MultiPolygon
from sqlalchemy import func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.domain.multiyear.models import (
    MultiyearResultModel,
    MultiyearRunModel,
    MultiyearYearModel,
    MultiyearZoneModel,
)


@dataclass
class ZoneRow:
    zone: MultiyearZoneModel
    geojson: dict[str, Any]


class MultiyearRepository:
    """Yetki denetimi servis katmanında yapılır (bahçe kullanıcının çalışma alanında mı)."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # --- çalıştırma ve yıllar
    async def get_run(self, garden_id: uuid.UUID) -> MultiyearRunModel | None:
        return await self.session.get(MultiyearRunModel, garden_id)

    async def save_run(self, run: MultiyearRunModel) -> None:
        merged = await self.session.merge(run)
        merged.updated_at = datetime.now(UTC)
        await self.session.flush()

    async def list_years(self, garden_id: uuid.UUID) -> list[MultiyearYearModel]:
        result = await self.session.execute(select(MultiyearYearModel).where(MultiyearYearModel.garden_id == garden_id).order_by(MultiyearYearModel.yil))
        return list(result.scalars())

    async def get_year(self, garden_id: uuid.UUID, yil: int) -> MultiyearYearModel | None:
        result = await self.session.execute(select(MultiyearYearModel).where(MultiyearYearModel.garden_id == garden_id, MultiyearYearModel.yil == yil))
        return result.scalar_one_or_none()

    async def ensure_year(self, garden_id: uuid.UUID, yil: int, kismi: bool) -> MultiyearYearModel:
        """Yıl satırı yoksa oluşturur (idempotent: eşzamanlı çağrılarda tek satır)."""
        await self.session.execute(
            text(
                "INSERT INTO multiyear_years (id, garden_id, yil, durum, kismi, sahne_sayisi, aday_sayisi, uyumsuz, created_at) "
                "VALUES (:id, :g, :y, 'bekliyor', :k, 0, 0, false, now()) ON CONFLICT (garden_id, yil) DO NOTHING"
            ),
            {"id": uuid.uuid4(), "g": garden_id, "y": yil, "k": kismi},
        )
        year = await self.get_year(garden_id, yil)
        assert year is not None
        return year

    async def reset_year(self, year: MultiyearYearModel, kismi: bool) -> None:
        year.durum, year.sahne_sayisi, year.aday_sayisi, year.kismi = "bekliyor", 0, 0, kismi
        year.hata_mesaji = year.kompozit_yolu = year.baslangic = year.bitis = year.sure_saniye = None
        year.uyumsuz, year.korelasyon, year.uyumsuz_nedeni, year.kapsam = False, None, None, None
        await self.session.flush()

    async def claim_year(self, garden_id: uuid.UUID, yil: int) -> bool:
        """Görevi tek işçinin alması için: yalnızca bekleyen/hatalı yıl «işleniyor» olur (tamam/işleniyor yeniden alınmaz)."""
        result = await self.session.execute(
            update(MultiyearYearModel)
            .where(MultiyearYearModel.garden_id == garden_id, MultiyearYearModel.yil == yil, MultiyearYearModel.durum.in_(("bekliyor", "hata")))
            .values(durum="isleniyor", baslangic=datetime.now(UTC), hata_mesaji=None)
        )
        return bool(getattr(result, "rowcount", 0))

    async def fail_stale(self, message: str) -> int:
        """Açılışta: önceki süreçte yarıda kalan «işleniyor» yıllar hataya çekilir (yeniden başlatılabilir)."""
        result = await self.session.execute(
            update(MultiyearYearModel).where(MultiyearYearModel.durum == "isleniyor").values(durum="hata", hata_mesaji=message, bitis=datetime.now(UTC))
        )
        return int(getattr(result, "rowcount", 0) or 0)

    async def geometry_hash(self, garden_id: uuid.UUID) -> str | None:
        result = await self.session.execute(text("SELECT md5(ST_AsText(geom)) FROM gardens WHERE id = :id"), {"id": garden_id})
        return result.scalar_one_or_none()

    async def geometry_geojson(self, garden_id: uuid.UUID) -> dict[str, Any] | None:
        result = await self.session.execute(text("SELECT ST_AsGeoJSON(geom) FROM gardens WHERE id = :id"), {"id": garden_id})
        raw = result.scalar_one_or_none()
        return json.loads(raw) if raw else None

    # --- sonuçlar
    async def next_version(self, garden_id: uuid.UUID, k: int) -> int:
        current = (
            await self.session.execute(
                select(func.max(MultiyearResultModel.versiyon)).where(MultiyearResultModel.garden_id == garden_id, MultiyearResultModel.bolge_sayisi == k)
            )
        ).scalar_one_or_none()
        return (current or 0) + 1

    async def add_result(
        self, result: MultiyearResultModel, zones: list[tuple[str, int, MultiPolygon, dict[str, float | None]]]
    ) -> MultiyearResultModel:
        await self.session.execute(
            update(MultiyearResultModel)
            .where(MultiyearResultModel.garden_id == result.garden_id, MultiyearResultModel.bolge_sayisi == result.bolge_sayisi)
            .values(aktif=False)
        )
        self.session.add(result)
        await self.session.flush()
        for tur, cls, geom, stats in zones:
            self.session.add(
                MultiyearZoneModel(
                    result_id=result.id,
                    tur=tur,
                    sinif=cls,
                    alan_m2=float(stats["alan_m2"] or 0.0),
                    pay=float(stats["pay"] or 0.0),
                    fark_yuzde=stats.get("fark_yuzde"),
                    istikrar=stats.get("istikrar"),
                    ortalama=stats.get("ortalama"),
                    geom=from_shape(geom, srid=4326),
                )
            )
        await self.session.flush()
        return result

    async def active_result(self, garden_id: uuid.UUID, k: int) -> MultiyearResultModel | None:
        result = await self.session.execute(
            select(MultiyearResultModel).where(
                MultiyearResultModel.garden_id == garden_id, MultiyearResultModel.bolge_sayisi == k, MultiyearResultModel.aktif.is_(True)
            )
        )
        return result.scalar_one_or_none()

    async def active_ks(self, garden_id: uuid.UUID) -> list[int]:
        result = await self.session.execute(
            select(MultiyearResultModel.bolge_sayisi).where(MultiyearResultModel.garden_id == garden_id, MultiyearResultModel.aktif.is_(True))
        )
        return sorted(set(result.scalars()))

    async def zones(self, result_id: uuid.UUID) -> list[ZoneRow]:
        rows = (
            await self.session.execute(
                select(MultiyearZoneModel, func.ST_AsGeoJSON(MultiyearZoneModel.geom)).where(MultiyearZoneModel.result_id == result_id).order_by(MultiyearZoneModel.tur, MultiyearZoneModel.sinif)
            )
        ).all()
        return [ZoneRow(zone, json.loads(geojson)) for zone, geojson in rows]
