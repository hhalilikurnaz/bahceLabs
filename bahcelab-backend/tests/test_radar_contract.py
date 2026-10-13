"""Planetary Computer `sentinel-1-rtc` sözleşme testi (ağ yok): KAYITLI gerçek STAC yanıtı (Eylül–Ekim 2026, Mersin) sağlayıcı kurallarıyla çalışır."""

import json
from datetime import date
from pathlib import Path
from typing import Any

import pystac

from bahcelab_backend.domain.imagery import radar

RECORDED = json.loads((Path(__file__).parent / "fixtures" / "stac" / "s1_rtc_eylul_2026.json").read_text())


class _FakeSearch:
    def items(self) -> list[pystac.Item]:
        return [pystac.Item.from_dict(d) for d in RECORDED["items"]]


class _FakeClient:
    calls: list[dict[str, Any]] = []

    def search(self, **kwargs: Any) -> _FakeSearch:
        self.calls.append(kwargs)
        return _FakeSearch()


def test_recorded_items_expose_orbit_direction_and_vh_vv_assets() -> None:
    for d in RECORDED["items"]:
        item = pystac.Item.from_dict(d)
        assert {"vh", "vv"} <= set(item.assets)
        assert item.properties["sat:orbit_state"] in ("ascending", "descending") and isinstance(item.properties["sat:relative_orbit"], int)
        assert item.properties["sar:polarizations"] == ["VV", "VH"] and item.properties["s1:orbit_source"]
        assert item.assets["vh"].extra_fields["raster:bands"][0]["nodata"] == -32768


def test_search_groups_slices_into_passes_with_orbit_and_direction(monkeypatch) -> None:
    client = _FakeClient()
    monkeypatch.setattr(radar.Client, "open", lambda url: client)
    refs = radar.PlanetaryRadarProvider().search(RECORDED["geometry"], date(2026, 9, 1), date(2026, 10, 12))
    assert client.calls[0]["collections"] == ["sentinel-1-rtc"]
    assert len(refs) == 16 and refs == sorted(refs, key=lambda r: (r.tarih, r.yorunge))
    assert {(r.yorunge, r.yon) for r in refs} == {(87, "cikis"), (167, "inis"), (94, "inis")}
    assert all(r.platform.startswith("SENTINEL-1") and len(r.handle) == 1 for r in refs)  # platform adı büyük harfe normalize


def test_two_slices_of_the_same_pass_become_one_scene(monkeypatch) -> None:
    doubled = [*RECORDED["items"], {**RECORDED["items"][0], "id": RECORDED["items"][0]["id"] + "_B"}]

    class _Search:
        def items(self) -> list[pystac.Item]:
            return [pystac.Item.from_dict(d) for d in doubled]

    class _Client:
        def search(self, **kwargs: Any) -> _Search:
            return _Search()

    monkeypatch.setattr(radar.Client, "open", lambda url: _Client())
    refs = radar.PlanetaryRadarProvider().search(RECORDED["geometry"], date(2026, 9, 1), date(2026, 10, 12))
    assert len(refs) == 16
    merged = next(r for r in refs if len(r.handle) == 2)
    assert merged.scene_id == min(i.id for i in merged.handle)  # kararlı kimlik: sıralı ilk dilim


def test_orbit_summary_ranks_the_most_frequent_orbit_first(monkeypatch) -> None:
    monkeypatch.setattr(radar.Client, "open", lambda url: _FakeClient())
    summary = radar.PlanetaryRadarProvider().orbit_summary(RECORDED["geometry"], date(2026, 9, 1), date(2026, 10, 12))
    assert summary[0].sahne_sayisi >= summary[-1].sahne_sayisi and sum(o.sahne_sayisi for o in summary) == 16
    assert summary[0].yillik == {2026: summary[0].sahne_sayisi}
