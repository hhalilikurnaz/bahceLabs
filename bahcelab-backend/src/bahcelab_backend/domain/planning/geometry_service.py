from pyproj import Geod
from shapely import make_valid
from shapely.geometry import Polygon, mapping, shape
from shapely.validation import explain_validity

from bahcelab_backend.domain.planning.schemas import GeoJsonPolygon, PlanningLand

_WGS84 = Geod(ellps="WGS84")


class GeometryValidationError(Exception):
    def __init__(self, message: str, details: dict | None = None) -> None:
        self.message = message
        self.details = details or {}
        super().__init__(message)


def _geojson_to_shape(geometry: GeoJsonPolygon) -> Polygon:
    return shape(geometry.model_dump())


def _geodesic_area_and_perimeter(geom: Polygon) -> tuple[float, float]:
    """Compute area (m²) and perimeter (m) on WGS84 ellipsoid."""
    area_m2, perimeter_m = _WGS84.geometry_area_perimeter(geom)
    return abs(area_m2), abs(perimeter_m)


def validate_and_measure_land(geometry: GeoJsonPolygon) -> PlanningLand:
    """Validate polygon geometry and compute area (m²) and perimeter (m)."""
    geom = _geojson_to_shape(geometry)

    if geom.is_empty:
        raise GeometryValidationError("Arazi sınırı boş olamaz")

    if geom.geom_type != "Polygon":
        raise GeometryValidationError(
            f"Yalnızca Polygon desteklenir, alınan tip: {geom.geom_type}"
        )

    if not geom.is_valid:
        reason = explain_validity(geom)
        if "Self-intersection" in reason or "self-intersection" in reason:
            raise GeometryValidationError(
                "Arazi sınırı geçersiz: self-intersection detected",
                details={"reason": reason},
            )
        geom = make_valid(geom)
        if geom.geom_type != "Polygon":
            raise GeometryValidationError(
                "Arazi sınırı geçersiz: düzeltme sonrası polygon elde edilemedi",
                details={"reason": reason},
            )

    area_m2, perimeter_m = _geodesic_area_and_perimeter(geom)

    if area_m2 < 100:
        raise GeometryValidationError(
            "Arazi alanı çok küçük (minimum 100 m²)",
            details={"area_m2": area_m2},
        )

    normalized_geometry = GeoJsonPolygon.model_validate(mapping(geom))

    return PlanningLand(
        geometry=normalized_geometry,
        area_m2=round(area_m2, 2),
        perimeter_m=round(perimeter_m, 2),
        validation_status="valid",
        validation_message=None,
    )
