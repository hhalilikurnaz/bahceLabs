import uuid
from typing import Any, cast

from bahcelab_backend.domain.agro.catalog import load_catalog, match_variety
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
    Urun,
)
from bahcelab_backend.domain.ndvi.service import NdviCoordinator
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
        urun=cast(Urun, g.urun),
        cesit=g.cesit,
        cesit_kodu=g.cesit_kodu,
        dikim_yili=g.dikim_yili,
        agac_sayisi=g.agac_sayisi,
        geometry=row.geojson,
        alan_dekar=area,
        il=g.il,
        ilce=g.ilce,
        created_at=g.created_at,
        updated_at=g.updated_at,
        son_ndvi_ortalama=row.son_ndvi_ortalama,
        son_ndvi_tarihi=row.son_ndvi_tarihi,
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


def apply_variety(values: dict[str, Any], urun: str, current: GardenModel | None, *, creating: bool = False) -> dict[str, Any]:
    """Çeşit alanlarını katalogla uyumlu hâle getirir (`cesit_kodu` ↔ `cesit` metni).

    - `cesit_kodu` verilirse katalogda o ürüne ait olmalıdır; 'diger' dışında ad katalogdan yazılır.
    - Yalnızca eski biçim `cesit` metni gelirse kod, metinden eşlenir (bilinmiyorsa 'diger').
    - Ürün değişir ve eski kod yeni ürüne uymazsa kod, mevcut metinden yeniden eşlenir.
    """
    catalog = load_catalog()
    out = dict(values)
    if out.get("cesit_kodu"):
        found = catalog.cesit(urun, out["cesit_kodu"])
        if found is None:
            raise AppError(422, AppErrorCode.VALIDATION_ERROR, "Seçilen çeşit bu ürüne ait değil. Listeden bir çeşit seçin.")
        if found.kod != "diger":
            out["cesit"] = found.ad
        return out
    if "cesit_kodu" in out and not creating:  # açıkça temizlendi
        return out
    if "cesit" in out:
        out["cesit_kodu"] = match_variety(catalog, urun, out["cesit"])
    elif current is not None and "urun" in out and current.cesit_kodu and catalog.cesit(urun, current.cesit_kodu) is None:
        out["cesit_kodu"] = match_variety(catalog, urun, current.cesit)
    return out


class GardenService:
    def __init__(self, repo: GardenRepository, ndvi: NdviCoordinator | None = None) -> None:
        self.repo = repo
        self.ndvi = ndvi

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

    async def get(self, garden_id: uuid.UUID) -> GardenResponse:
        return to_response(await self._get_model(garden_id))

    async def measure(self, geometry: GeoJsonGeometry) -> MeasureResponse:
        _, area = await self._validated_area(geometry)
        return MeasureResponse(alan_dekar=round(area, 3), alan_m2=round(area * 1000, 1))

    async def create(self, request: GardenCreate) -> GardenResponse:
        geojson, area = await self._validated_area(request.geometry)
        values = apply_variety(request.model_dump(exclude={"geometry"}), request.urun, None, creating=True)
        garden_id = await self.repo.create(values=values, geojson=geojson, area_dekar=area)
        if self.ndvi:
            await self.ndvi.start_initial(garden_id)  # son 13 ay arka planda işlenir
        return await self.get(garden_id)

    async def update(self, garden_id: uuid.UUID, request: GardenUpdate) -> GardenResponse:
        row = await self._get_model(garden_id)
        garden: GardenModel = row.garden

        geojson = area = None
        if "geometry" in request.model_fields_set and request.geometry is not None:
            geojson, area = await self._validated_area(request.geometry)

        values = request.model_dump(exclude={"geometry"}, exclude_unset=True)
        values = apply_variety(values, values.get("urun", garden.urun), garden)
        await self.repo.update(garden, values=values, geojson=geojson, area_dekar=area)
        if geojson is not None and self.ndvi:
            await self.ndvi.restart_after_boundary_change(garden_id)  # eski NDVI kayıtları geçersiz
        return await self.get(garden_id)

    async def delete(self, garden_id: uuid.UUID) -> None:
        row = await self._get_model(garden_id)
        await self.repo.delete(row.garden)
        if self.ndvi:
            self.ndvi.purge_files(garden_id)
