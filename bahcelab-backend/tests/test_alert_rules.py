"""Uydu uyarı kuralları: bahçenin kendi mevsim normuna göre; mevsimsel düşüş uyarı ÜRETMEZ; çoklu indeks tek olay."""

import uuid
from datetime import date, timedelta

import pytest

from bahcelab_backend.config import Settings
from bahcelab_backend.domain.ndvi.baseline import BaselineConfig
from bahcelab_backend.domain.ndvi.models import IndexObservationModel, SceneObservationModel
from bahcelab_backend.domain.ndvi.repository import SceneWithIndices
from bahcelab_backend.domain.ndvi.rules import build_alerts

CFG = BaselineConfig.from_settings(Settings())
GID = uuid.uuid4()


def zone(x0: float) -> dict:
    ring = [[x0, 0], [x0 + 0.001, 0], [x0 + 0.001, 0.001], [x0, 0.001], [x0, 0]]
    return {"type": "FeatureCollection", "features": [{"type": "Feature", "properties": {}, "geometry": {"type": "Polygon", "coordinates": [ring]}}]}


def scene(day: date, means: dict[str, float], zones: dict[str, dict] | None = None) -> SceneWithIndices:
    item = SceneWithIndices(
        SceneObservationModel(garden_id=GID, tarih=day, scene_id=f"s-{day}", durum="tamam", gecerli_piksel_orani=1.0, kaynak="test"),
    )
    for name, mean in means.items():
        item.indices[name] = IndexObservationModel(
            garden_id=GID, tarih=day, indeks=name, ortalama=mean, medyan=mean, p10=mean, p90=mean, minimum=mean, maksimum=mean,
            png_yolu="x", veri_yolu="y", sorunlu_bolge_geojson=(zones or {}).get(name),
        )
    return item


def curve(start: date, days: int, value_at, step: int = 5, names=("ndvi",)) -> list[SceneWithIndices]:
    return [scene(start + timedelta(days=i), {n: value_at(i) for n in names}) for i in range(0, days, step)]


def decline(i: int, high: float = 0.62, low: float = 0.50, span: int = 60) -> float:
    """`span` gün boyunca yumuşak düşüş (mevsimsel)."""
    return high - (high - low) * min(i, span) / span


def test_autumn_seasonal_decline_produces_no_alert_when_last_year_declined_too():
    last_year = curve(date(2025, 9, 20), 80, decline)
    this_year = curve(date(2026, 9, 20), 56, decline)  # aynı mevsimsel düşüş
    assert build_alerts([*last_year, *this_year], CFG) == []


def test_spring_seasonal_dip_produces_no_alert_when_last_year_dipped_too():
    def dip(i: int) -> float:
        return 0.60 - 0.10 * min(i, 45) / 45  # nisan–mayıs: çiçeklenme sonrası beklenen düşüş

    last_year = curve(date(2025, 4, 1), 80, dip)
    this_year = curve(date(2026, 4, 1), 56, dip)
    assert build_alerts([*last_year, *this_year], CFG) == []


def test_same_drop_is_an_alert_when_last_year_was_stable():
    last_year = curve(date(2025, 9, 20), 80, lambda i: 0.62)  # geçen yıl düşüş yoktu
    this_year = curve(date(2026, 9, 20), 56, lambda i: 0.62 if i < 41 else 0.62 - 0.12 * (i - 40) / 15)  # son 15 günde ani düşüş
    alerts = build_alerts([*last_year, *this_year], CFG)
    assert [a.indeks for a in alerts] == ["ndvi"]
    alert = alerts[0]
    assert alert.norm_kaynagi == "gecmis_sezon" and alert.norm_degeri == pytest.approx(0.62, abs=0.01)
    assert alert.normdan_sapma_yuzde is not None and alert.normdan_sapma_yuzde < -5
    assert alert.beklenen_degisim_yuzde == pytest.approx(0, abs=1) and "kendi normu" in alert.mesaj


def test_raw_drop_alone_is_not_enough_without_history():
    scenes = curve(date(2026, 9, 1), 30, lambda i: 0.70 if i < 20 else 0.58)  # kısa geçmiş: norm yok
    assert build_alerts(scenes, CFG) == []


def test_sudden_anomaly_against_own_recent_level_still_alerts():
    flat = curve(date(2026, 6, 1), 100, lambda i: 0.62)
    drop = scene(date(2026, 9, 9), {"ndvi": 0.50})
    alerts = build_alerts([*flat, drop], CFG)
    assert [a.indeks for a in alerts] == ["ndvi"] and alerts[0].norm_kaynagi == "son_gunler"


def multi_scenes(zones: dict[str, dict]) -> list[SceneWithIndices]:
    names = tuple(zones)
    flat = [scene(date(2026, 6, 1) + timedelta(days=i), {n: 0.5 for n in names}) for i in range(0, 100, 5)]
    last = scene(date(2026, 9, 9), {n: 0.38 for n in names}, zones)
    return [*flat, last]


def test_same_day_same_area_drops_merge_into_one_event():
    alerts = build_alerts(multi_scenes({"ndvi": zone(0.0), "ndre": zone(0.0), "msavi": zone(0.0)}), CFG)
    assert len(alerts) == 1  # bir olay = bir uyarı
    event = alerts[0]
    assert event.tur == "coklu_indeks" and event.oncelik == "yuksek"
    assert event.indeksler == ["msavi", "ndre", "ndvi"] and event.indeks is None
    assert "tek olay" in event.mesaj and event.son_tarih == date(2026, 9, 9)


def test_drops_in_different_areas_stay_separate_alerts():
    alerts = build_alerts(multi_scenes({"ndvi": zone(0.0), "ndre": zone(1.0)}), CFG)
    assert sorted(a.indeks or "" for a in alerts) == ["ndre", "ndvi"]
    assert all(a.tur == "indeks_dusus" and a.oncelik == "normal" for a in alerts)


def test_partial_overlap_groups_only_the_overlapping_indices():
    alerts = build_alerts(multi_scenes({"ndvi": zone(0.0), "ndre": zone(0.0), "msavi": zone(1.0)}), CFG)
    kinds = sorted((a.tur, tuple(a.indeksler)) for a in alerts)
    assert kinds == [("coklu_indeks", ("ndre", "ndvi")), ("indeks_dusus", ("msavi",))]


def test_water_stress_uses_the_norm_and_absolute_gap():
    flat = [scene(date(2026, 6, 1) + timedelta(days=i), {"ndmi": 0.30}) for i in range(0, 100, 5)]
    stressed = scene(date(2026, 9, 9), {"ndmi": 0.18})  # normun 0,12 altında ve bağıl %40 düşüş
    mild = scene(date(2026, 9, 9), {"ndmi": 0.27})  # normun 0,03 altında: eşik altı
    assert [a.indeks for a in build_alerts([*flat, stressed], CFG)] == ["ndmi"]
    assert build_alerts([*flat, mild], CFG) == []
