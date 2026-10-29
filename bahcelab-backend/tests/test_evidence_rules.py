"""Olay ön-yargı kuralları (SAF): destek / çelişki / kanıt yok, model satırlarının dışlanması, boş katalog, kaynak bağımsızlığı."""

import ast
import gzip
import json
from datetime import date, timedelta
from pathlib import Path

import httpx
import pytest

from bahcelab_backend.domain.agro.catalog import load_catalog
from bahcelab_backend.domain.evidence import catalog_file, providers, rules
from bahcelab_backend.domain.evidence.types import PublicRecord, Station, StationDay

RULE = load_catalog().dis_kanit
DAY = date(2024, 1, 10)
ST = Station("17340", "Mersin", 36.8, 34.6, 3.0, date(2015, 1, 1), date(2026, 2, 28), 36.0)
STATIONS = {ST.id: ST}


def day(d: date, tmin=None, prcp=None, kaynak="gozlem") -> StationDay:
    return StationDay(ST.id, d, tmin, prcp, kaynak)


def test_frost_is_supported_when_a_station_observed_min_at_or_below_threshold_within_the_window():
    r = rules.prejudge("don", DAY, DAY, [day(DAY + timedelta(days=1), tmin=-0.4)], STATIONS, [], "Mersin", "Erdemli", RULE)  # ±1 gün penceresi
    assert r.sonuc == "destekleniyor" and r.kanitlar[0].kaynak == "istasyon" and r.kanitlar[0].baglanti == "https://meteostat.net/en/station/17340"


def test_frost_is_contradicted_when_every_station_stays_well_above_freezing():
    r = rules.prejudge("don", DAY, DAY, [day(DAY, tmin=8.0)], STATIONS, [], None, None, RULE)
    assert r.sonuc == "celisiyor" and r.kanitlar[0].yon == "celisme"


def test_manually_obtained_station_has_no_public_link_but_names_its_source():
    mgm = Station("m1", "MGM Erdemli", 36.6, 34.3, 10.0, date(2015, 1, 1), date(2026, 1, 1), 5.0, "csv")
    r = rules.prejudge("don", DAY, DAY, [StationDay("m1", DAY, -1.0, None, "gozlem")], {"m1": mgm}, [], None, None, RULE)
    assert r.sonuc == "destekleniyor" and r.kanitlar[0].baglanti is None and "MGM Erdemli" in r.kanitlar[0].metin


def test_borderline_values_are_no_evidence_not_support():
    r = rules.prejudge("don", DAY, DAY, [day(DAY, tmin=2.5)], STATIONS, [], None, None, RULE)  # >0 ama <5: ne destek ne çelişki
    assert r.sonuc == "kanit_yok" and "sınırda" in r.neden


def test_no_data_is_no_evidence_never_support():
    assert rules.prejudge("don", DAY, DAY, [], STATIONS, [], None, None, RULE).sonuc == "kanit_yok"
    assert rules.prejudge("don", DAY, DAY, [day(DAY + timedelta(days=9), tmin=-5.0)], STATIONS, [], None, None, RULE).sonuc == "kanit_yok"  # pencere dışı
    assert rules.prejudge("don", DAY, DAY, [], {}, [], None, None, RULE).neden == "bahçeye yakın istasyon yok"


def test_model_filled_rows_are_never_evidence():
    r = rules.prejudge("don", DAY, DAY, [day(DAY, tmin=-6.0, kaynak="model")], STATIONS, [], None, None, RULE)
    assert r.sonuc == "kanit_yok" and not r.kanitlar
    mixed = rules.prejudge("don", DAY, DAY, [day(DAY, tmin=-6.0, kaynak="model"), day(DAY, tmin=9.0)], STATIONS, [], None, None, RULE)
    assert mixed.sonuc == "celisiyor"  # yalnız gerçek gözlem sayılır


def test_heavy_rain_support_and_contradiction():
    assert rules.prejudge("yagis", DAY, DAY, [day(DAY, prcp=42.0)], STATIONS, [], None, None, RULE).sonuc == "destekleniyor"
    assert rules.prejudge("yagis", DAY, DAY, [day(DAY, prcp=0.0)], STATIONS, [], None, None, RULE).sonuc == "celisiyor"
    assert rules.prejudge("yagis", DAY, DAY, [day(DAY, prcp=12.0)], STATIONS, [], None, None, RULE).sonuc == "kanit_yok"


def test_optical_and_radar_events_have_no_station_measurement():
    assert rules.prejudge("optik", DAY, DAY, [day(DAY, tmin=-9.0)], STATIONS, [], None, None, RULE).sonuc == "kanit_yok"


def test_public_record_supports_when_date_kind_and_place_match_and_empty_catalog_gives_no_evidence():
    rec = PublicRecord(DAY + timedelta(days=1), "don", "Mersin / Erdemli", "Örnek Müdürlük", "https://example.org/duyuru", "")
    r = rules.prejudge("don", DAY, DAY, [], STATIONS, [rec], "Mersin", "Erdemli", RULE)
    assert r.sonuc == "destekleniyor" and r.kanitlar[0].kaynak == "dis_kayit" and r.kanitlar[0].baglanti == "https://example.org/duyuru"
    assert rules.prejudge("don", DAY, DAY, [], STATIONS, [], "Mersin", "Erdemli", RULE).sonuc == "kanit_yok"
    other = PublicRecord(DAY, "don", "Antalya / Kumluca", "x", "https://example.org/b", "")
    assert rules.prejudge("don", DAY, DAY, [], STATIONS, [other], "Mersin", "Erdemli", RULE).sonuc == "kanit_yok"  # başka yer


def test_station_contradiction_wins_over_public_record_and_says_sources_disagree():
    rec = PublicRecord(DAY, "don", "Erdemli", "x", "https://example.org/a", "")
    r = rules.prejudge("don", DAY, DAY, [day(DAY, tmin=9.0)], STATIONS, [rec], None, "Erdemli", RULE)
    assert r.sonuc == "celisiyor" and "ayrışıyor" in r.neden


def test_shipped_public_catalog_is_valid_and_every_row_has_a_source_url():
    rows = catalog_file.load_public_records()
    assert all(r.url.startswith("http") for r in rows)  # boş da olabilir: asla uydurulmaz
    with pytest.raises(ValueError):
        catalog_file.parse_records({"kayitlar": [{"tarih": "2024-01-01", "olay_turu": "don", "yer": "Erdemli", "kaynak": "x", "url": ""}]})
    assert catalog_file.parse_records({"kayitlar": []}) == []


def test_external_support_is_a_separate_count_and_no_evidence_is_not_counted_as_support():
    out = rules.__dict__  # noqa: F841
    from bahcelab_backend.domain.fieldbook import rules as fr

    s = fr.external_support([("don", "destekleniyor"), ("don", "celisiyor"), ("don", "kanit_yok"), ("don", "kanit_yok"), ("yagis", None)])
    assert s["don"]["dis_destekleniyor"] == 1 and s["don"]["dis_celisiyor"] == 1 and s["don"]["dis_kanit_yok"] == 2 and "yagis" not in s


def test_evidence_module_never_imports_the_event_engines_own_inputs():
    """Kaynak bağımsızlığı: kanıt modülü ERA5, Sentinel-2/HLS/radar, hava (Open-Meteo) ve olay motoru kodunu içe aktaramaz."""
    forbidden = ("era5", "acquisitions", "hls", "radar", "weather", "events", "ndvi", "water", "multiyear", "biophys")
    folder = Path(rules.__file__).parent
    for path in folder.glob("*.py"):
        for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
            names = [node.module or ""] if isinstance(node, ast.ImportFrom) else [a.name for a in node.names] if isinstance(node, ast.Import) else []
            for name in names:
                parts = name.split(".")
                assert not any(p in forbidden for p in parts), f"{path.name} yasaklı bağımlılık içe aktarıyor: {name}"
    from bahcelab_backend.domain.evidence.types import KANIT_KAYNAKLARI

    assert KANIT_KAYNAKLARI == ("istasyon", "dis_kayit")


# ---------------------------------------------------------------- sağlayıcılar
def _meteostat_transport() -> httpx.MockTransport:
    stations = [
        {"id": "17340", "name": {"en": "Mersin"}, "location": {"latitude": 36.8, "longitude": 34.6, "elevation": 3}, "inventory": {"daily": {"start": "2024-01-01", "end": "2024-01-31"}}},
        {"id": "00001", "name": {"en": "Uzak"}, "location": {"latitude": 41.0, "longitude": 29.0, "elevation": 3}, "inventory": {"daily": {"start": "2020-01-01", "end": "2024-01-31"}}},
        {"id": "00002", "name": {"en": "Günlüksüz"}, "location": {"latitude": 36.7, "longitude": 34.4, "elevation": 3}, "inventory": {"daily": {"start": None, "end": None}}},
    ]
    csv_text = "2023-12-31,10,5.0,12,0.0,,,,,,\n2024-01-10,5,-1.5,9,2.0,,,,,,\n2024-02-05,6,-9.0,9,0.0,,,,,,\n"

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("lite.json.gz"):
            return httpx.Response(200, content=gzip.compress(json.dumps(stations).encode()))
        return httpx.Response(200, content=gzip.compress(csv_text.encode()))

    return httpx.MockTransport(handler)


async def test_meteostat_provider_picks_nearby_stations_with_daily_inventory_and_marks_rows_outside_it_as_model():
    async with httpx.AsyncClient(transport=_meteostat_transport()) as client:
        p = providers.MeteostatProvider(client)
        near = await p.nearest(36.664, 34.380, max_km=80, limit=3)
        assert [s.id for s in near] == ["17340"]  # uzak ve günlüksüz istasyon elenir
        rows = {d.tarih: d for d in await p.daily(near[0], date(2023, 1, 1), date(2024, 12, 31))}
    assert rows[date(2024, 1, 10)].kaynak == "gozlem" and rows[date(2024, 1, 10)].tmin == -1.5
    assert rows[date(2023, 12, 31)].kaynak == "model" and rows[date(2024, 2, 5)].kaynak == "model"  # envanter dışı: model/dolgu


async def test_csv_provider_uses_the_same_interface_for_manually_obtained_data(tmp_path):
    (tmp_path / "istasyonlar.json").write_text(json.dumps([{"id": "mgm1", "ad": "MGM Erdemli", "lat": 36.62, "lng": 34.30, "gozlem_baslangic": "2024-01-01", "gozlem_bitis": "2024-12-31"}]), encoding="utf-8")
    (tmp_path / "mgm1.csv").write_text("tarih,tmin,prcp,kaynak\n2024-01-10,-2.0,0.0,\n2024-01-11,-3.0,0.0,model\n", encoding="utf-8")
    p = providers.CsvStationProvider(tmp_path)
    near = await p.nearest(36.664, 34.380, max_km=80, limit=3)
    days = await p.daily(near[0], date(2024, 1, 1), date(2024, 1, 31))
    assert [(d.tarih.day, d.kaynak) for d in days] == [(10, "gozlem"), (11, "model")]
    assert rules.prejudge("don", date(2024, 1, 10), date(2024, 1, 10), days, {near[0].id: near[0]}, [], None, None, RULE).sonuc == "destekleniyor"
