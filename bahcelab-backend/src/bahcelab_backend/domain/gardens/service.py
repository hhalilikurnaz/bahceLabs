import uuid
from typing import Any

from bahcelab_backend.domain.gardens.models import GardenModel
from bahcelab_backend.domain.gardens.repository import GardenRepository, GardenRow, Measurement
from bahcelab_backend.domain.gardens.schemas import (
    MAX_DEKAR,
    MIN_DEKAR,
    GardenCreate,
    GardenResponse,
    GardenUpdate,
    GeoJsonGeometry,
    MeasureResponse,
)
from bahcelab_backend.shared.errors import AppError, AppErrorCode


def _tr(number: float, digits: int = 1) -> str:
    """Türkçe sayı biçimi: 1.234,5"""
    text = f"{number:,.{digits}f}"
    return text.replace(",", "§").replace(".", ",").replace("§", ".")


def _location_label(il: str | None, ilce: str | None) -> str | None:
    parts = [p for p in (ilce, il) if p]
    return ", ".join(parts) if parts else None


def to_response(row: GardenRow) -> GardenResponse:
    g = row.garden
    area = float(g.alan_dekar)
    return GardenResponse(
        id=g.id,
        ad=g.ad,
        urun=g.urun,
        cesit=g.cesit,
        dikim_yili=g.dikim_yili,
        geometry=row.geojson,
        alan_dekar=area,
        il=g.il,
        ilce=g.ilce,
        created_at=g.created_at,
        updated_at=g.updated_at,
        name=g.ad,
        location_label=_location_label(g.il, g.ilce),
        area_m2=round(area * 1000, 1),
    )


def _invalid(message: str, **details: Any) -> AppError:
    return AppError(422, AppErrorCode.INVALID_GEOMETRY, message, details=details)


def _check_measurement(m: Measurement) -> None:
    if not m.is_valid:
        raise _invalid(
            "Bahçe sınırı geçersiz: çizgiler birbirini kesiyor. Köşeleri düzeltip tekrar deneyin.",
            reason=m.reason,
        )
    if m.area_dekar < MIN_DEKAR:
        raise _invalid(
            f"Bahçe en az {_tr(MIN_DEKAR)} dekar olmalı; "
            f"çizdiğiniz alan {_tr(m.area_dekar, 2)} dekar.",
            alan_dekar=m.area_dekar,
        )
    if m.area_dekar > MAX_DEKAR:
        raise _invalid(
            f"Bahçe en fazla {_tr(MAX_DEKAR, 0)} dekar olabilir; çizdiğiniz alan "
            f"{_tr(m.area_dekar, 0)} dekar. Daha küçük parçalara bölerek ekleyin.",
            alan_dekar=m.area_dekar,
        )


class GardenService:
    def __init__(self, repo: GardenRepository) -> None:
        self.repo = repo

    async def _validated_area(self, geometry: GeoJsonGeometry) -> tuple[dict[str, Any], float]:
        geojson = geometry.to_geojson_dict()
        measurement = await self.repo.measure(geojson)
        _check_measurement(measurement)
        return geojson, measurement.area_dekar

    async def _get_model(self, garden_id: uuid.UUID) -> GardenRow:
        row = await self.repo.get(garden_id)
        if row is None:
            raise AppError(404, AppErrorCode.NOT_FOUND, "Bahçe bulunamadı.")
        return row

    async def list_gardens(self) -> list[GardenResponse]:
        return [to_response(r) for r in await self.repo.list_gardens()]

    async def get(self, garden_id: uuid.UUID):
        return to_response(await self._get_model(garden_id))

    async def measure(self, geometry: GeoJsonGeometry) -> MeasureResponse:
        _, area = await self._validated_area(geometry)
        return MeasureResponse(alan_dekar=round(area, 3), alan_m2=round(area * 1000, 1))

    async def create(self, request: GardenCreate):
        geojson, area = await self._validated_area(request.geometry)
        garden_id = await self.repo.create(
            values=request.model_dump(exclude={"geometry"}), geojson=geojson, area_dekar=area
        )
        return await self.get(garden_id)

    async def update(self, garden_id: uuid.UUID, request: GardenUpdate):
        row = await self._get_model(garden_id)
        garden: GardenModel = row.garden

        geojson = area = None
        if "geometry" in request.model_fields_set and request.geometry is not None:
            geojson, area = await self._validated_area(request.geometry)

        values = request.model_dump(exclude={"geometry"}, exclude_unset=True)
        await self.repo.update(garden, values=values, geojson=geojson, area_dekar=area)
        return await self.get(garden_id)

    async def delete(self, garden_id: uuid.UUID) -> None:
        row = await self._get_model(garden_id)
        await self.repo.delete(row.garden)
