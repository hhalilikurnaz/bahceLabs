import pytest

from bahcelab_backend.domain.planning.geometry_service import (
    GeometryValidationError,
    validate_and_measure_land,
)
from bahcelab_backend.domain.planning.schemas import GeoJsonPolygon


def _square_polygon(size: float = 0.001) -> GeoJsonPolygon:
    """Small square polygon near Istanbul for testing."""
    return GeoJsonPolygon(
        coordinates=[
            [
                [28.97, 41.01],
                [28.97 + size, 41.01],
                [28.97 + size, 41.01 + size],
                [28.97, 41.01 + size],
                [28.97, 41.01],
            ]
        ]
    )


def test_validate_square_polygon():
    land = validate_and_measure_land(_square_polygon())
    assert land.validation_status == "valid"
    assert land.area_m2 is not None
    assert land.area_m2 > 0
    assert land.perimeter_m is not None
    assert land.perimeter_m > 0


def test_reject_self_intersecting_polygon():
    bowtie = GeoJsonPolygon(
        coordinates=[
            [
                [28.97, 41.01],
                [28.971, 41.011],
                [28.97, 41.011],
                [28.971, 41.01],
                [28.97, 41.01],
            ]
        ]
    )
    with pytest.raises(GeometryValidationError) as exc_info:
        validate_and_measure_land(bowtie)
    assert "self-intersection" in exc_info.value.message.lower()


def test_reject_non_polygon():
    line = GeoJsonPolygon(
        coordinates=[
            [
                [28.97, 41.01],
                [28.971, 41.011],
                [28.97, 41.01],
            ]
        ]
    )
    with pytest.raises(GeometryValidationError):
        validate_and_measure_land(line)
