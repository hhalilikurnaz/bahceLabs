"""Su ve sıcaklık kaynakları sözleşme testleri (ağ yok): KAYITLI gerçek yanıtlar/yapılar ayrıştırıcılardan geçer."""

import json
from datetime import date
from pathlib import Path
from typing import Any

import h5py
import numpy as np
import pystac
import pytest
import rasterio
from rasterio.transform import from_origin

from bahcelab_backend.domain.imagery import landsat
from bahcelab_backend.domain.water import era5, validation
from bahcelab_backend.domain.water.era5_sync import merge_day

FIX = Path(__file__).parent / "fixtures"
ERA5_LAND = json.loads((FIX / "water" / "open_meteo_era5_land.json").read_text())
ERA5 = json.loads((FIX / "water" / "open_meteo_era5.json").read_text())
MODEL = json.loads((FIX / "water" / "open_meteo_model.json").read_text())
LANDSAT = json.loads((FIX / "stac" / "landsat_c2_l2_eylul_2026.json").read_text())


def test_recorded_open_meteo_responses_parse_and_merge_into_a_full_day() -> None:
    land = era5.parse_era5_land(ERA5_LAND)
    rean = era5.parse_era5(ERA5)
    day = date(2024, 1, 10)
    assert set(land[day]) == {"sm0", "sm1", "sm2", "sm3", "t2m"} and set(rean[day]) == {"yagis", "et0"}
    merged = merge_day(land[day], rean[day], None)
    assert merged is not None and merged["toprak_kaynak"] == "era5_land" and merged["hava_kaynak"] == "era5_land"
    assert 0.05 < merged["sm0"] < 0.6 and merged["sm3"] is not None and merged["yagis_mm"] is not None and merged["et0_mm"] is not None and len(merged["saatlik"]["sm0"]) == 24


def test_recorded_forecast_model_maps_to_the_four_era5_layers_with_the_deepest_one_empty() -> None:
    model = era5.parse_model(MODEL)
    assert len(model) >= 2
    first = next(iter(model.values()))
    row = merge_day(None, None, first)
    assert row is not None and row["toprak_kaynak"] == "model" and row["hava_kaynak"] == "model"
    assert row["sm0"] is not None and row["sm1"] is not None and row["sm2"] is not None and row["sm3"] is None  # 100–255 cm modelde yok


def test_recorded_landsat_items_have_surface_temperature_and_qa_assets_with_scale_and_offset() -> None:
    assert LANDSAT["items"], "kayıtlı yanıt boş"
    for d in LANDSAT["items"]:
        item = pystac.Item.from_dict(d)
        assert {"lwir11", "qa_pixel"} <= set(item.assets) and item.properties["platform"] in ("landsat-8", "landsat-9")
        band = item.assets["lwir11"].extra_fields["raster:bands"][0]
        assert band["scale"] == pytest.approx(0.00341802) and band["offset"] == 149.0 and band["nodata"] == 0 and band["spatial_resolution"] == 30
        assert landsat._scale_offset(item) == (pytest.approx(0.00341802), 149.0)


def test_landsat_search_keeps_one_scene_per_day_with_cloud_and_platform(monkeypatch) -> None:
    class _Search:
        def items(self) -> list[pystac.Item]:
            return [pystac.Item.from_dict(d) for d in LANDSAT["items"]]

    class _Client:
        def search(self, **kwargs: Any) -> _Search:
            assert kwargs["collections"] == ["landsat-c2-l2"] and kwargs["query"] == {"platform": {"in": ["landsat-8", "landsat-9"]}}
            return _Search()

    monkeypatch.setattr(landsat.Client, "open", lambda url: _Client())
    refs = landsat.PlanetaryLandsatProvider().search(LANDSAT["geometry"], date(2026, 9, 1), date(2026, 9, 20))
    assert refs == sorted(refs, key=lambda r: r.tarih) and len({r.tarih for r in refs}) == len(refs)
    assert all(r.platform in ("landsat-8", "landsat-9") and r.bulut_orani is not None and r.yol_satir.count("/") == 1 for r in refs)


def make_smap(path: Path, row: int, col: int) -> None:
    with h5py.File(path, "w") as h:
        for suffix, group, var in (("am", "Soil_Moisture_Retrieval_Data_AM", "soil_moisture"), ("pm", "Soil_Moisture_Retrieval_Data_PM", "soil_moisture_pm")):
            g = h.create_group(group)
            data = np.full(validation.SMAP_SHAPE, validation.SMAP_FILL, dtype=np.float32)
            data[row - 2 : row + 3, col - 2 : col + 3] = 0.05  # 25 piksel geçerli
            data[row, col] = -9999.0 if suffix == "am" else 0.08  # AM'de merkez geçersiz (kıyı), PM'de geçerli
            g.create_dataset(var, data=data)
            qual = np.zeros(validation.SMAP_SHAPE, dtype=np.uint16)
            qual[row - 2, col - 2 : col + 3] = 1  # bir satır önerilmeyen kalite
            g.create_dataset("retrieval_qual_flag" if suffix == "am" else "retrieval_qual_flag_pm", data=qual)


def test_smap_block_uses_the_point_pixel_when_valid_else_the_neighbourhood_and_drops_bad_quality(tmp_path: Path) -> None:
    row, col = validation.ease2_rowcol(36.66, 34.38)
    assert (row, col) == (326, 2296)  # gerçek granülün enlem/boylam dizisiyle doğrulandı (hücre merkezi 36,68 K 34,40 D)
    make_smap(tmp_path / "smap.h5", row, col)
    with h5py.File(tmp_path / "smap.h5", "r") as h:
        am, pm = validation.smap_block(h, row, col)
    assert am.indeks == "sm_yuzey_am" and am.ayrinti["deger_kaynagi"] == "komsu" and am.deger == pytest.approx(0.05) and am.ayrinti["komsu_gecerli"] == 19  # 24 geçerli − 5 kalitesiz
    assert pm.indeks == "sm_yuzey_pm" and pm.ayrinti["deger_kaynagi"] == "nokta" and pm.deger == pytest.approx(0.08)


def test_imerg_value_reads_the_cell_nearest_to_the_garden(tmp_path: Path) -> None:
    lons, lats = np.arange(-179.95, 180, 0.1), np.arange(-89.95, 90, 0.1)
    data = np.zeros((1, lons.size, lats.size), dtype=np.float32)
    i, j = int(np.argmin(abs(lons - 34.38))), int(np.argmin(abs(lats - 36.66)))
    data[0, i, j] = 7.5
    with h5py.File(tmp_path / "imerg.nc4", "w") as h:
        g = h.create_group("Grid")
        g.create_dataset("lon", data=lons)
        g.create_dataset("lat", data=lats)
        g.create_dataset("precipitation", data=data)
    with h5py.File(tmp_path / "imerg.nc4", "r") as h:
        obs = validation.imerg_value(h, 36.66, 34.38)
    assert obs.indeks == "yagis_mm" and obs.deger == pytest.approx(7.5)


def test_chirps_cog_window_returns_cell_value_and_none_when_the_file_is_missing(tmp_path: Path, monkeypatch) -> None:
    path = tmp_path / "chirps-v2.0.2024.01.10.cog"
    data = np.zeros((40, 40), dtype=np.float32)
    data[20, 20] = 3.2
    data[19, 19] = -9999
    with rasterio.open(path, "w", driver="GTiff", height=40, width=40, count=1, dtype="float32", crs="EPSG:4326", transform=from_origin(34.0, 37.0, 0.05, 0.05)) as dst:
        dst.write(data, 1)
    lng, lat = 34.0 + 20.5 * 0.05, 37.0 - 20.5 * 0.05
    monkeypatch.setattr(validation, "CHIRPS_URL", str(tmp_path / "chirps-v2.0.{y}.{m:02d}.{d:02d}.cog"))
    obs = validation.chirps_value(date(2024, 1, 10), lat, lng)
    assert obs is not None and obs.deger == pytest.approx(3.2)
    assert validation.chirps_value(date(2024, 1, 11), lat, lng) is None  # henüz yayımlanmamış gün: değer uydurulmaz


def test_pearson_needs_enough_points_and_variation() -> None:
    assert validation.pearson([1.0] * 12, list(map(float, range(12)))) is None
    assert validation.pearson([1.0, 2.0], [1.0, 2.0]) is None
    xs = [float(i) for i in range(20)]
    assert validation.pearson(xs, [2 * x + 1 for x in xs]) == pytest.approx(1.0)
