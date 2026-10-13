import json
from pathlib import Path

import pytest

from bahcelab_backend.domain.water import pedotransfer as pt

SOILGRIDS = json.loads((Path(__file__).parent / "fixtures" / "water" / "soilgrids_jlnnlk.json").read_text())


def test_saxton_rawls_gives_plausible_field_capacity_and_wilting_point_for_known_textures() -> None:
    # Tipik değerler (Saxton & Rawls 2006 Tablo/şekil aralıkları): kum ≈ FC 0,10 / WP 0,04; tın ≈ 0,27 / 0,12; kil ≈ 0,40+ / 0,25+
    sand = pt.saxton_rawls(90, 5, 1.0)
    loam = pt.saxton_rawls(40, 20, 2.5)
    clay = pt.saxton_rawls(20, 55, 2.5)
    assert 0.06 < sand[0] < 0.16 and 0.02 < sand[1] < 0.07
    assert 0.22 < loam[0] < 0.34 and 0.09 < loam[1] < 0.16
    assert clay[0] > 0.38 and clay[1] > 0.25
    for fc, wp in (sand, loam, clay):
        assert fc > wp  # kullanılabilir su pozitif


def test_organic_matter_raises_both_thresholds_and_is_capped_at_eight_percent() -> None:
    low, high = pt.saxton_rawls(35, 25, 0.5), pt.saxton_rawls(35, 25, 4.0)
    assert high[0] > low[0]
    assert pt.saxton_rawls(35, 25, 20.0) == pt.saxton_rawls(35, 25, 8.0)  # geçerlilik sınırı


def test_recorded_soilgrids_response_aggregates_to_a_loam_with_organic_carbon() -> None:
    tex = pt.aggregate_soilgrids(SOILGRIDS)
    assert tex.kum_yuzde + tex.kil_yuzde + tex.silt_yuzde == pytest.approx(100, abs=2.0)  # d_factor ile % birimine çevrildi (g/kg ÷ 10)
    assert 30 < tex.kum_yuzde < 40 and 20 < tex.kil_yuzde < 30 and 38 < tex.silt_yuzde < 46  # kayıtlı Mersin noktası: tın
    assert 10 < tex.organik_karbon_g_kg < 30  # dg/kg ÷ 10 = g/kg; derinlikle azalır
    fc, wp = pt.saxton_rawls(tex.kum_yuzde, tex.kil_yuzde, tex.organik_madde_yuzde)
    assert 0.2 < fc < 0.4 and 0.08 < wp < 0.2


def test_soilgrids_with_too_few_depths_is_rejected_rather_than_guessed() -> None:
    bad = json.loads(json.dumps(SOILGRIDS))
    for layer in bad["properties"]["layers"]:
        layer["depths"] = layer["depths"][:2]  # yalnız 0–15 cm
    with pytest.raises(ValueError):
        pt.aggregate_soilgrids(bad)


def test_available_water_is_the_depth_integral_in_mm() -> None:
    assert pt.available_water_mm(0.30, 0.15, 80) == pytest.approx(120.0)  # 0,15 × 800 mm
    assert pt.available_water_mm(0.10, 0.20, 80) == 0.0
