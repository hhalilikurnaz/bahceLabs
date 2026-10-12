"""Durum kademesi (v1, SAF): İyi ≥85 · İzle 70–84 · Dikkat 50–69 · Sorun <50; aktif risk varken en fazla İzle.
Eşikler katalogda «ön değer · v1»; sayı arayüze çıkmaz, kademe nedeni hangi bileşenin düşürdüğünü söyler."""

from datetime import date, timedelta

import pytest

from bahcelab_backend.config import Settings
from bahcelab_backend.domain.agro import catalog as cat
from bahcelab_backend.domain.agro.score import (
    AktifRisk,
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
    assert label_from_score(95, [], CFG, risk_level="orta") == "izle"  # orta zararlı riski: en fazla İzle
    assert label_from_score(95, [], CFG, risk_level="yuksek") == "dikkat"  # yüksek zararlı riski: en fazla Dikkat
    assert label_from_score(75, [], CFG, risk_level="yuksek") == "dikkat" and label_from_score(55, [], CFG, risk_level="orta") == "dikkat"
    assert label_from_score(30, [], CFG, risk_level="yuksek") == "sorun"  # daha kötü kademe yükseltilmez
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
    result = assess(scenes, spans=SPANS, sat_severities=[], weather_severities=[], today=scenes[-1].tarih, cfg=CFG, active_risks=[AktifRisk("Meyve sineği", "yuksek")])
    assert result.durum == "dikkat"  # skor yüksek ama yüksek risk var: en fazla Dikkat
    risk = next(c for c in result.cipler if c.kod == "risk")
    assert risk.seviye == "belirgin_dusuk" and risk.etiket == "yüksek"
    assert "risk" in result.kademe_nedeni.lower() and "en fazla Dikkat" in result.kademe_nedeni


def test_medium_pest_risk_names_the_pest_caps_the_tier_and_explains_it() -> None:
    """Hava sekmesinde meyve sineği «orta» iken Risk çipi «normal», kademe «İyi» kalamaz."""
    scenes = series(date(2026, 6, 1), [0.62] * 20)
    kwargs = {"spans": SPANS, "sat_severities": [], "weather_severities": [], "today": scenes[-1].tarih, "cfg": CFG}
    plain = assess(scenes, **kwargs)
    result = assess(scenes, **kwargs, active_risks=[AktifRisk("Meyve sineği", "orta")])
    assert plain.durum == "iyi" and result.durum == "izle"
    risk = next(c for c in result.cipler if c.kod == "risk")
    assert risk.seviye == "normalin_alti" and risk.etiket == "orta" and "Meyve sineği · orta" in risk.aciklama  # çip seviyeyi yazar
    assert result.dusuren == "risk"
    assert "Meyve sineği · orta" in result.kademe_nedeni and "en fazla İzle" in result.kademe_nedeni
    # düşük risk kademeyi etkilemez; iki risk birlikte adlanır
    assert assess(scenes, **kwargs, active_risks=[]).durum == "iyi"
    both = assess(scenes, **kwargs, active_risks=[AktifRisk("Meyve sineği", "orta"), AktifRisk("Kırmızı örümcek", "yuksek")])
    assert next(c for c in both.cipler if c.kod == "risk").seviye == "belirgin_dusuk"
    assert both.durum == "dikkat" and next(c for c in both.cipler if c.kod == "risk").etiket == "yüksek"  # en yüksek risk seviyesi yazılır
    assert "Kırmızı örümcek · yüksek" in both.kademe_nedeni


def test_no_data_has_no_tier_chips_or_reason_numbers() -> None:
    result = assess([], spans=SPANS, sat_severities=[], weather_severities=[], today=date(2026, 10, 10), cfg=CFG)
    assert result.durum == "veri_yok" and all(c.seviye is None for c in result.cipler if c.kod != "risk")
