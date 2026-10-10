import json
import uuid
from dataclasses import dataclass
from datetime import date
from typing import Any

from sqlalchemy import delete, func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.domain.gardens.models import GardenModel
from bahcelab_backend.domain.ndvi.models import NdviObservationModel
from bahcelab_backend.domain.planning.models import SimulationPlanModel


@dataclass(frozen=True)
class Measurement:
    is_valid: bool
    reason: str | None
    area_dekar: float


@dataclass(frozen=True)
class GardenRow:
    garden: GardenModel
    geojson: dict[str, Any]
    son_ndvi_ortalama: float | None = None  # son geçerli (bulutsuz) NDVI gözleminin ortalaması
    son_ndvi_tarihi: date | None = None


# Alan elipsoit üzerinde (geography) hesaplanır: Türkiye'nin her yerinde UTM bölgesinden bağımsız doğrudur
_MEASURE_SQL = text(
    """
    SELECT ST_IsValid(g) AS is_valid,
           ST_IsValidReason(g) AS reason,
           ST_Area(g::geography) / 1000.0 AS area_dekar
    FROM (SELECT ST_SetSRID(ST_GeomFromGeoJSON(:geojson), 4326) AS g) AS t
    """
)


def _geom_expr(geojson: dict[str, Any]):
    return func.ST_SetSRID(func.ST_GeomFromGeoJSON(json.dumps(geojson)), 4326)


class GardenRepository:
    def __init__(self, session: AsyncSession, workspace_id: uuid.UUID) -> None:
        self.session = session
        self.workspace_id = workspace_id

    async def measure(self, geojson: dict[str, Any]) -> Measurement:
        """Geçerlilik ve alan (dekar) PostGIS'te hesaplanır; istemci değerine güvenilmez."""
        row = (await self.session.execute(_MEASURE_SQL, {"geojson": json.dumps(geojson)})).one()
        return Measurement(bool(row.is_valid), row.reason, float(row.area_dekar))

    def _select(self):
        # Her bahçenin son geçerli NDVI gözlemi (liste rozeti ve silüet rengi için)
        latest = (
            select(
                NdviObservationModel.garden_id.label("gid"),
                NdviObservationModel.ortalama.label("son_ortalama"),
                NdviObservationModel.tarih.label("son_tarih"),
            )
            .where(NdviObservationModel.durum == "tamam")
            .distinct(NdviObservationModel.garden_id)
            .order_by(NdviObservationModel.garden_id, NdviObservationModel.tarih.desc())
            .subquery()
        )
        return (
            select(
                GardenModel,
                func.ST_AsGeoJSON(GardenModel.geom).label("geojson"),
                latest.c.son_ortalama,
                latest.c.son_tarih,
            )
            .outerjoin(latest, latest.c.gid == GardenModel.id)
            .where(GardenModel.workspace_id == self.workspace_id)
        )

    @staticmethod
    def _row(values) -> GardenRow:
        garden, geojson, ortalama, tarih = values
        return GardenRow(garden, json.loads(geojson), ortalama, tarih)

    async def list_gardens(self) -> list[GardenRow]:
        result = await self.session.execute(self._select().order_by(GardenModel.created_at.desc()))
        return [self._row(values) for values in result.all()]

    async def get(self, garden_id: uuid.UUID) -> GardenRow | None:
        result = await self.session.execute(self._select().where(GardenModel.id == garden_id))
        values = result.first()
        return self._row(values) if values else None

    async def create(
        self, *, values: dict[str, Any], geojson: dict[str, Any], area_dekar: float
    ) -> uuid.UUID:
        garden = GardenModel(
            workspace_id=self.workspace_id,
            geom=_geom_expr(geojson),
            alan_dekar=round(area_dekar, 3),
            **values,
        )
        self.session.add(garden)
        await self.session.flush()
        return garden.id

    async def update(
        self,
        garden: GardenModel,
        *,
        values: dict[str, Any],
        geojson: dict[str, Any] | None,
        area_dekar: float | None,
    ) -> None:
        for key, value in values.items():
            setattr(garden, key, value)
        if geojson is not None and area_dekar is not None:
            garden.geom = _geom_expr(geojson)
            garden.alan_dekar = round(area_dekar, 3)
        await self.session.flush()

    async def delete(self, garden: GardenModel) -> None:
        # Bu bahçeye bağlı planlama taslakları bahçesiz kalır, silinmez
        await self.session.execute(
            update(SimulationPlanModel)
            .where(SimulationPlanModel.garden_id == garden.id)
            .values(garden_id=None)
        )
        await self.session.execute(delete(GardenModel).where(GardenModel.id == garden.id))
