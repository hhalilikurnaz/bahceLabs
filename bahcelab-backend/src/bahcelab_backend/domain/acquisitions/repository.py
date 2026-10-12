import uuid
from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy import delete, func, select, text, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.domain.acquisitions.models import (
    ACQ_NET,
    MONTH_DONE,
    MONTH_ERROR,
    MONTH_PENDING,
    MONTH_RUNNING,
    AcquisitionModel,
    AcquisitionStatModel,
    BackfillMonthModel,
    NormalBandModel,
)
from bahcelab_backend.domain.acquisitions.store import PixelStats


class AcquisitionRepository:
    """Yetki denetimi servis katmanında yapılır."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # --- ay görevleri
    async def ensure_months(self, garden_id: uuid.UUID, source_id: str, months: list[date], geometry_hash: str) -> None:
        """Eksik ay satırlarını açar; sınır özeti değiştiyse bütün aylar yeniden «bekliyor» olur."""
        stale = await self.session.execute(
            select(func.count()).select_from(BackfillMonthModel).where(
                BackfillMonthModel.garden_id == garden_id, BackfillMonthModel.source_id == source_id, BackfillMonthModel.geometry_hash.is_not(None), BackfillMonthModel.geometry_hash != geometry_hash
            )
        )
        if int(stale.scalar_one()) > 0:
            await self.session.execute(delete(AcquisitionModel).where(AcquisitionModel.garden_id == garden_id, AcquisitionModel.source_id == source_id))
            await self.session.execute(delete(BackfillMonthModel).where(BackfillMonthModel.garden_id == garden_id, BackfillMonthModel.source_id == source_id))
        for month in months:
            await self.session.execute(
                insert(BackfillMonthModel).values(garden_id=garden_id, source_id=source_id, ay=month, durum=MONTH_PENDING, geometry_hash=geometry_hash).on_conflict_do_nothing()
            )
        await self.session.flush()

    async def has_months(self, garden_id: uuid.UUID, source_id: str) -> bool:
        n = await self.session.execute(select(func.count()).select_from(BackfillMonthModel).where(BackfillMonthModel.garden_id == garden_id, BackfillMonthModel.source_id == source_id))
        return int(n.scalar_one()) > 0

    async def has_stale_months(self, garden_id: uuid.UUID, source_id: str, geometry_hash: str) -> bool:
        n = await self.session.execute(
            select(func.count()).select_from(BackfillMonthModel).where(
                BackfillMonthModel.garden_id == garden_id, BackfillMonthModel.source_id == source_id, BackfillMonthModel.geometry_hash.is_not(None), BackfillMonthModel.geometry_hash != geometry_hash
            )
        )
        return int(n.scalar_one()) > 0

    async def claim_month(self, garden_id: uuid.UUID, source_id: str, month: date, *, force: bool = False) -> bool:
        """Görevi tek işçinin alması için: yalnızca bekleyen/hatalı ay «işleniyor» olur (`force`: artımlı çekimde tamam ay da yeniden taranır)."""
        allowed = (MONTH_PENDING, MONTH_ERROR, MONTH_DONE) if force else (MONTH_PENDING, MONTH_ERROR)
        result = await self.session.execute(
            update(BackfillMonthModel)
            .where(BackfillMonthModel.garden_id == garden_id, BackfillMonthModel.source_id == source_id, BackfillMonthModel.ay == month, BackfillMonthModel.durum.in_(allowed))
            .values(durum=MONTH_RUNNING, hata_mesaji=None, guncelleme=datetime.now(UTC))
        )
        return bool(getattr(result, "rowcount", 0))

    async def finish_month(self, garden_id: uuid.UUID, source_id: str, month: date, *, status: str, net: int, candidates: int, error: str | None, seconds: float) -> None:
        await self.session.execute(
            update(BackfillMonthModel)
            .where(BackfillMonthModel.garden_id == garden_id, BackfillMonthModel.source_id == source_id, BackfillMonthModel.ay == month)
            .values(durum=status, net_sahne=net, aday_sayisi=candidates, hata_mesaji=error, sure_saniye=round(seconds, 2), guncelleme=datetime.now(UTC))
        )

    async def pending_months(self, garden_id: uuid.UUID, source_id: str) -> list[date]:
        rows = await self.session.execute(
            select(BackfillMonthModel.ay).where(BackfillMonthModel.garden_id == garden_id, BackfillMonthModel.source_id == source_id, BackfillMonthModel.durum.in_((MONTH_PENDING, MONTH_ERROR))).order_by(BackfillMonthModel.ay.desc())
        )
        return [r[0] for r in rows]

    async def fail_stale(self, message: str) -> int:
        result = await self.session.execute(update(BackfillMonthModel).where(BackfillMonthModel.durum == MONTH_RUNNING).values(durum=MONTH_ERROR, hata_mesaji=message))
        return int(getattr(result, "rowcount", 0))

    async def progress(self, garden_id: uuid.UUID, source_id: str) -> dict[str, Any]:
        rows = (
            await self.session.execute(
                select(BackfillMonthModel.durum, func.count(), func.coalesce(func.sum(BackfillMonthModel.net_sahne), 0))
                .where(BackfillMonthModel.garden_id == garden_id, BackfillMonthModel.source_id == source_id)
                .group_by(BackfillMonthModel.durum)
            )
        ).all()
        counts = {r[0]: int(r[1]) for r in rows}
        return {"counts": counts, "net": sum(int(r[2]) for r in rows), "total": sum(counts.values())}

    async def month_rows(self, garden_id: uuid.UUID, source_id: str) -> list[BackfillMonthModel]:
        rows = await self.session.execute(select(BackfillMonthModel).where(BackfillMonthModel.garden_id == garden_id, BackfillMonthModel.source_id == source_id).order_by(BackfillMonthModel.ay))
        return list(rows.scalars())

    # --- edinimler
    async def acquisitions_between(self, garden_id: uuid.UUID, source_id: str, first: date, last: date) -> list[AcquisitionModel]:
        rows = await self.session.execute(
            select(AcquisitionModel).where(AcquisitionModel.garden_id == garden_id, AcquisitionModel.source_id == source_id, AcquisitionModel.tarih >= first, AcquisitionModel.tarih <= last)
        )
        return list(rows.scalars())

    async def upsert_acquisition(self, row: AcquisitionModel, stats: dict[str, PixelStats]) -> None:
        existing = (
            await self.session.execute(select(AcquisitionModel).where(AcquisitionModel.garden_id == row.garden_id, AcquisitionModel.source_id == row.source_id, AcquisitionModel.scene_id == row.scene_id))
        ).scalar_one_or_none()
        if existing is None:
            self.session.add(row)
            await self.session.flush()
            target = row
        else:
            for column in ("tarih", "bulut_orani", "durum", "hata_mesaji", "gecerli_oran", "gecikme_gun", "isleme_surumu", "formul_surumu", "izgara_yolu", "izgara_boyut_bayt"):
                setattr(existing, column, getattr(row, column))
            await self.session.execute(delete(AcquisitionStatModel).where(AcquisitionStatModel.acquisition_id == existing.id))
            target = existing
        for name, s in stats.items():
            self.session.add(
                AcquisitionStatModel(
                    acquisition_id=target.id, indeks=name, ortalama=s.ortalama, medyan=s.medyan, p10=s.p10, p25=s.p25, p75=s.p75, p90=s.p90, minimum=s.minimum, maksimum=s.maksimum, gecerli_piksel=s.gecerli_piksel
                )
            )
        await self.session.flush()

    async def monthly_values(self, garden_id: uuid.UUID, source_id: str, indeks: str) -> dict[int, dict[int, float]]:
        """{yıl: {ay: temsilci değer}}: net edinimlerin bahçe medyanlarının ortalaması."""
        rows = (
            await self.session.execute(
                text(
                    "SELECT extract(year FROM a.tarih)::int AS y, extract(month FROM a.tarih)::int AS m, avg(s.medyan) AS v "
                    "FROM acquisitions a JOIN acquisition_stats s ON s.acquisition_id = a.id "
                    "WHERE a.garden_id = :g AND a.source_id = :s AND a.durum = :net AND s.indeks = :i GROUP BY 1, 2"
                ),
                {"g": garden_id, "s": source_id, "net": ACQ_NET, "i": indeks},
            )
        ).all()
        out: dict[int, dict[int, float]] = {}
        for y, m, v in rows:
            out.setdefault(int(y), {})[int(m)] = float(v)
        return out

    async def storage_bytes(self, garden_id: uuid.UUID) -> tuple[int, int]:
        row = (await self.session.execute(select(func.coalesce(func.sum(AcquisitionModel.izgara_boyut_bayt), 0), func.count()).where(AcquisitionModel.garden_id == garden_id, AcquisitionModel.durum == ACQ_NET))).one()
        return int(row[0] or 0), int(row[1] or 0)

    # --- normal bantlar
    async def replace_bands(self, garden_id: uuid.UUID, source_id: str, indeks: str, rows: list[NormalBandModel]) -> None:
        await self.session.execute(delete(NormalBandModel).where(NormalBandModel.garden_id == garden_id, NormalBandModel.source_id == source_id, NormalBandModel.indeks == indeks))
        self.session.add_all(rows)
        await self.session.flush()

    async def bands(self, garden_id: uuid.UUID, source_id: str) -> list[NormalBandModel]:
        rows = await self.session.execute(select(NormalBandModel).where(NormalBandModel.garden_id == garden_id, NormalBandModel.source_id == source_id).order_by(NormalBandModel.indeks, NormalBandModel.ay))
        return list(rows.scalars())

    async def geometry_geojson(self, garden_id: uuid.UUID) -> dict[str, Any] | None:
        import json

        value = (await self.session.execute(text("SELECT ST_AsGeoJSON(geom) FROM gardens WHERE id = :g"), {"g": garden_id})).scalar_one_or_none()
        return json.loads(value) if value else None

    async def geometry_hash(self, garden_id: uuid.UUID) -> str | None:
        value = (await self.session.execute(text("SELECT md5(ST_AsEWKB(geom)) FROM gardens WHERE id = :g"), {"g": garden_id})).scalar_one_or_none()
        return str(value)[:40] if value else None
