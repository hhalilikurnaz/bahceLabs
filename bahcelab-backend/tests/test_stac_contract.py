"""Planetary Computer sözleşme testi (ağ yok): KAYITLI gerçek STAC yanıtı (Temmuz 2025, Mersin) `search_scenes` ve seçim kuralıyla çalışır."""

import json
from datetime import date
from pathlib import Path
from typing import Any

import pystac

from bahcelab_backend.domain.acquisitions.selection import is_spaced, next_candidate_order
from bahcelab_backend.domain.imagery import sentinel2

RECORDED = json.loads((Path(__file__).parent / "fixtures" / "stac" / "s2_temmuz_2025.json").read_text())


class _FakeSearch:
    def items(self) -> list[pystac.Item]:
        return [pystac.Item.from_dict(d) for d in RECORDED["items"]]


class _FakeClient:
    calls: list[dict[str, Any]] = []

    def search(self, **kwargs: Any) -> _FakeSearch:
        self.calls.append(kwargs)
        return _FakeSearch()


def test_recorded_stac_response_becomes_one_scene_per_day_with_cloud_and_baseline(monkeypatch) -> None:
    client = _FakeClient()
    monkeypatch.setattr(sentinel2.Client, "open", lambda url: client)
    refs = sentinel2.search_scenes(RECORDED["geometry"], date(2025, 7, 1), date(2025, 7, 31), 60.0)
    assert client.calls[0]["collections"] == ["sentinel-2-l2a"] and client.calls[0]["query"] == {"eo:cloud_cover": {"lte": 60.0}}
    assert refs and [r.tarih for r in refs] == sorted({r.tarih for r in refs})  # günde tek sahne, tarih sıralı
    assert all(r.scene_id.startswith("S2") and r.bulut_orani is not None and r.handle.properties["s2:processing_baseline"] for r in refs)
    assert all(date(2025, 7, 1) <= r.tarih <= date(2025, 7, 31) for r in refs)


def test_recorded_items_expose_the_assets_and_angles_the_pipeline_needs() -> None:
    item = pystac.Item.from_dict(RECORDED["items"][0])
    for asset in ("B04", "B08", "SCL", "product-metadata", "granule-metadata"):
        assert asset in item.assets
    assert "s2:mean_solar_zenith" in item.properties and "s2:processing_baseline" in item.properties


def test_monthly_budget_picks_best_two_scenes_at_least_ten_days_apart_from_the_recorded_month(monkeypatch) -> None:
    monkeypatch.setattr(sentinel2.Client, "open", lambda url: _FakeClient())
    refs = sentinel2.search_scenes(RECORDED["geometry"], date(2025, 7, 1), date(2025, 7, 31), 60.0)
    accepted: list[date] = []
    for tarih, _cloud, _sid in next_candidate_order([(r.tarih, r.bulut_orani, r.scene_id) for r in refs]):
        if len(accepted) < 2 and is_spaced(tarih, accepted, 10):
            accepted.append(tarih)
    assert len(accepted) == 2 and abs((accepted[0] - accepted[1]).days) >= 10
    best = min(refs, key=lambda r: r.bulut_orani if r.bulut_orani is not None else 101.0)
    assert best.tarih in accepted  # en az bulutlu sahne her zaman seçilir
