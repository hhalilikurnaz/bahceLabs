"""Sahne geometrisi (SAF): güneş ve görüş açıları — LAI girdisi. Kaynak: granül meta verisi (MTD_TL.xml) `Mean_Sun_Angle` ve bant başına
`Mean_Viewing_Incidence_Angle` (SNAP `view_zenith_mean` / `view_azimuth_mean` gibi bantlar ortalaması)."""

from __future__ import annotations

import math
import re
from dataclasses import dataclass

_SUN = re.compile(r"<Mean_Sun_Angle>\s*<ZENITH_ANGLE[^>]*>([-\d.eE+]+)</ZENITH_ANGLE>\s*<AZIMUTH_ANGLE[^>]*>([-\d.eE+]+)</AZIMUTH_ANGLE>", re.S)
_VIEW = re.compile(
    r"<Mean_Viewing_Incidence_Angle bandId=\"\d+\">\s*<ZENITH_ANGLE[^>]*>([-\d.eE+]+)</ZENITH_ANGLE>\s*<AZIMUTH_ANGLE[^>]*>([-\d.eE+]+)</AZIMUTH_ANGLE>", re.S
)


@dataclass(frozen=True)
class SceneAngles:
    sun_zenith: float
    sun_azimuth: float
    view_zenith: float
    view_azimuth: float


def _circular_mean_deg(values: list[float]) -> float:
    """Azimut ortalaması dairesel alınır (359° ile 1° → 0°)."""
    s = sum(math.sin(math.radians(v)) for v in values)
    c = sum(math.cos(math.radians(v)) for v in values)
    return math.degrees(math.atan2(s, c)) % 360.0


def parse_granule_angles(xml: str) -> SceneAngles:
    sun = _SUN.search(xml)
    views = _VIEW.findall(xml)
    if sun is None or not views:
        raise ValueError("Granül meta verisinde güneş/görüş açısı bulunamadı.")
    view_zenith = sum(float(z) for z, _ in views) / len(views)
    return SceneAngles(float(sun.group(1)), float(sun.group(2)), view_zenith, _circular_mean_deg([float(a) for _, a in views]))
