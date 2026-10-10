import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.domain.weather.models import WeatherCellModel, WeatherDailyModel
from bahcelab_backend.domain.weather.provider import DailyPoint

_POINT_SQL = """
    SELECT id, ad, ST_Y(ST_Centroid(geom)) AS enlem, ST_X(ST_Centroid(geom)) AS boylam
    FROM gardens WHERE workspace_id = :workspace_id
"""


class WeatherRepository:
    def __init__(self, session: AsyncSession, workspace_id: uuid.UUID) -> None:
        self.session = session
        self.workspace_id = workspace_id

    async def garden_points(self, garden_id: uuid.UUID | None = None) -> list[dict[str, Any]]:
        """Kullanıcının bahçelerinin merkez noktaları (başkasının bahçesi hiç dönmez)."""
        sql = _POINT_SQL + (" AND id = :garden_id" if garden_id else "") + " ORDER BY created_at DESC"
        params: dict[str, Any] = {"workspace_id": self.workspace_id}
        if garden_id:
            params["garden_id"] = garden_id
        rows = (await self.session.execute(text(sql), params)).mappings().all()
        return [dict(r) for r in rows]

    async def cell(self, lat: float, lng: float) -> WeatherCellModel:
        await self.session.execute(
            insert(WeatherCellModel)
            .values(id=uuid.uuid4(), enlem=lat, boylam=lng)
            .on_conflict_do_nothing(constraint="uq_weather_cell")
        )
        result = await self.session.execute(
            select(WeatherCellModel).where(
                WeatherCellModel.enlem == lat, WeatherCellModel.boylam == lng
            )
        )
        return result.scalar_one()

    async def refresh_cell(self, cell: WeatherCellModel) -> None:
        await self.session.refresh(cell)

    async def save_forecast(
        self, cell: WeatherCellModel, payload: dict[str, Any], at: datetime, source: str
    ) -> None:
        cell.tahmin = payload
        cell.tahmin_zamani = at
        cell.tahmin_kaynak = source
        await self.session.flush()

    async def daily(self, cell_id: uuid.UUID, start: date, end: date) -> dict[date, WeatherDailyModel]:
        result = await self.session.execute(
            select(WeatherDailyModel).where(
                WeatherDailyModel.cell_id == cell_id,
                WeatherDailyModel.tarih >= start,
                WeatherDailyModel.tarih <= end,
            )
        )
        return {row.tarih: row for row in result.scalars()}

    async def upsert_daily(self, cell_id: uuid.UUID, points: list[DailyPoint], source: str) -> None:
        if not points:
            return
        values = [
            {
                "cell_id": cell_id,
                "tarih": p.tarih,
                "min_sicaklik": p.min,
                "max_sicaklik": p.max,
                "yagis_mm": p.yagis,
                "et0_mm": p.et0,
                "kaynak": source,
            }
            for p in points
        ]
        statement = insert(WeatherDailyModel)
        statement = statement.on_conflict_do_update(
            index_elements=["cell_id", "tarih"],
            set_={
                "min_sicaklik": statement.excluded.min_sicaklik,
                "max_sicaklik": statement.excluded.max_sicaklik,
                "yagis_mm": statement.excluded.yagis_mm,
                "et0_mm": statement.excluded.et0_mm,
                "kaynak": statement.excluded.kaynak,
            },
            # Arşiv (ERA5) verisi tahmin API'sinin geçmiş gününden her zaman üstündür
            where=(WeatherDailyModel.kaynak != "arsiv") | (statement.excluded.kaynak == "arsiv"),
        )
        # Parametre sınırı: parçalar halinde yaz
        for i in range(0, len(values), 500):
            await self.session.execute(statement, values[i : i + 500])
        await self.session.flush()
