"""Gösterge formülleri (tek modül): bilinen değerlerle; LAI açı yoksa üretilmez; formül sürümü sabit."""

import numpy as np
import pytest
from rasterio.crs import CRS
from rasterio.transform import Affine

from bahcelab_backend.domain.imagery.angles import SceneAngles
from bahcelab_backend.domain.imagery.formulas import (
    FORMULA_VERSION,
    INDICATORS,
    ROLES_NEEDED,
    compute_indicators,
)
from bahcelab_backend.domain.ndvi.processing import SceneBands


def scene(values: dict[str, float], angles: SceneAngles | None = None, valid: bool = True) -> SceneBands:
    bands = {role: np.full((2, 2), v, dtype=np.float32) for role, v in values.items()}
    return SceneBands(bands=bands, valid=np.full((2, 2), valid), transform=Affine.identity(), crs=CRS.from_epsg(32636), acilar=angles)


FOUR = {"red": 0.1, "nir": 0.5, "rededge": 0.2, "nir_narrow": 0.45, "swir1": 0.25}


def test_known_values_for_the_four_indices() -> None:
    out = compute_indicators(scene(FOUR))
    assert out["ndvi"][0, 0] == pytest.approx((0.5 - 0.1) / (0.5 + 0.1), abs=1e-5)  # 0,6667
    assert out["ndmi"][0, 0] == pytest.approx((0.45 - 0.25) / (0.45 + 0.25), abs=1e-5)  # 0,2857
    assert out["ndre"][0, 0] == pytest.approx((0.45 - 0.2) / (0.45 + 0.2), abs=1e-5)  # 0,3846
    assert out["msavi"][0, 0] == pytest.approx((2 * 0.5 + 1 - np.sqrt((2 * 0.5 + 1) ** 2 - 8 * (0.5 - 0.1))) / 2, abs=1e-5)  # 0,5528
    assert set(out) == {"ndvi", "ndmi", "ndre", "msavi"}  # açı yok: LAI üretilmez


def test_cloudy_pixels_are_nan_not_zero() -> None:
    out = compute_indicators(scene(FOUR, valid=False))
    assert all(np.isnan(v).all() for v in out.values())


def test_lai_is_added_when_angles_and_inputs_exist() -> None:
    lai_inputs = {"green": 0.056024, "red": 0.012462, "rededge": 0.088543, "rededge2": 0.41626, "rededge3": 0.49575, "nir_narrow": 0.51452, "swir1": 0.14425, "swir2": 0.043583}
    angles = SceneAngles(sun_zenith=float(np.degrees(np.arccos(0.90957))), sun_azimuth=float(np.degrees(np.arccos(-0.99999))), view_zenith=float(np.degrees(np.arccos(0.99367))), view_azimuth=0.0)
    out = compute_indicators(scene({**FOUR, **lai_inputs}, angles))
    assert set(out) == set(INDICATORS) and out["lai"][0, 0] == pytest.approx(4.3194, abs=5e-3)  # SNAP referans vakası


def test_formula_version_and_needed_roles_are_declared() -> None:
    assert FORMULA_VERSION.startswith("f1+snap-biophys")
    assert {"green", "swir2", "rededge2", "rededge3"} <= set(ROLES_NEEDED)
