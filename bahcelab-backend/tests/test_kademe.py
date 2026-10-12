"""Durum kademesi (v1, SAF): İyi ≥85 · İzle 70–84 · Dikkat 50–69 · Sorun <50; aktif risk varken en fazla İzle.
Eşikler katalogda «ön değer · v1»; sayı arayüze çıkmaz, kademe nedeni hangi bileşenin düşürdüğünü söyler."""

from datetime import date, timedelta

import pytest

from bahcelab_backend.config import Settings
from bahcelab_backend.domain.agro import catalog as cat
from bahcelab_backend.domain.agro.score import (
    SceneValue,
    ScoreConfig,
    assess,
    derive_status,
    label_from_score,
)

CFG = ScoreConfig.from_settings(Settings())
SPANS = {"ndvi": 0.9, "ndmi": 0.8}


def test_thresholds_live_in_the_catalog_as_preliminary_v1_values():
    rule = cat.load_catalog().durum_kademesi
    assert (rule.iyi_min, rule.izle_min, rule.dikkat_min) == (85, 70, 50)
    assert rule.durum == "dogrulanmadi" and "v1" in rule.kaynak


@pytest.mark.parametrize(
    ("score", "expected"),
    [(100, "iyi"), (85, "iyi"), (84, "izle"), (70, "izle"), (69, "dikkat"), (50, "dikkat"), (49, "sorun"), (0, "sorun")],
)
def test_score_maps_to_four_tiers(score: int, expected: str) -> None:
    assert label_from_score(score, [], CFG) == expected
    assert derive_status(has_data=True, severities=[], score=score, cfg=CFG) == expected


def test_active_risk_caps_at_watch_but_does_not_hide_worse_tiers() -> None:
    assert label_from_score(95, ["sari"], CFG) == "izle"
    assert label_from_score(95, [], CFG, risk_active=True) == "izle"  # yüksek zararlı riski
    assert label_from_score(75, ["sari"], CFG) == "izle"
    assert label_from_score(55, ["sari"], CFG) == "dikkat"  # zaten daha düşük: yükseltilmez
    assert label_from_score(30, ["sari"], CFG) == "sorun"
    assert label_from_score(95, ["kirmizi"], CFG) == "dikkat"  # kırmızı uyarı en az Dikkat
    assert label_from_score(30, ["kirmizi"], CFG) == "sorun"


def series(start: date, values: list[float], ndmi: float = 0.2) -> list[SceneValue]:
    return [SceneValue(start + timedelta(days=i * 5), {"ndvi": v, "ndmi": ndmi}) for i, v in enumerate(values)]


def test_normal_garden_has_all_chips_normal_and_a_plain_reason() -> None:
    scenes = series(date(2026, 6, 1), [0.62] * 20)
    result = assess(scenes, spans=SPANS, sat_severities=[], weather_severities=[], today=scenes[-1].tarih, cfg=CFG)
    assert result.durum == "iyi" and result.dusuren is None
    assert {c.kod: c.seviye for c in result.cipler} == {"agac_gucu": "normal", "su": "normal", "risk": "normal"}
    assert "normal" in result.kademe_nedeni.lower()


def test_sudden_vigor_drop_names_the_component_that_lowered_the_tier() -> None:
    scenes = series(date(2026, 6, 1), [*([0.62] * 19), 0.40])
    result = assess(scenes, spans=SPANS, sat_severities=[], weather_severities=[], today=scenes[-1].tarih, cfg=CFG)
    chips = {c.kod: c.seviye for c in result.cipler}
    assert chips["agac_gucu"] == "belirgin_dusuk" and chips["su"] == "normal"
    assert result.dusuren == "agac_gucu"
    assert "Ağaç gücü" in result.kademe_nedeni and result.durum in ("izle", "dikkat", "sorun")
    assert not any(ch.isdigit() and "/100" in result.kademe_nedeni for ch in result.kademe_nedeni)  # skor sayısı metinde yok
    assert "/100" not in result.ozet and "/100" not in result.kademe_nedeni


def test_risk_chip_and_cap_explain_themselves() -> None:
    scenes = series(date(2026, 6, 1), [0.62] * 20)
    result = assess(scenes, spans=SPANS, sat_severities=[], weather_severities=[], today=scenes[-1].tarih, cfg=CFG, risk_high_count=1)
    assert result.durum == "izle"  # skor yüksek ama aktif risk var
    assert next(c for c in result.cipler if c.kod == "risk").seviye != "normal"
    assert "risk" in result.kademe_nedeni.lower() and "en fazla" in result.kademe_nedeni


def test_no_data_has_no_tier_chips_or_reason_numbers() -> None:
    result = assess([], spans=SPANS, sat_severities=[], weather_severities=[], today=date(2026, 10, 10), cfg=CFG)
    assert result.durum == "veri_yok" and all(c.seviye is None for c in result.cipler if c.kod != "risk")
