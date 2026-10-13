"""Durum v2 (ADR 0018): bileşen puanları, birleştirme, bayatlık, risk tavanı, kademe ve «Nasıl hesaplandı?» — saf fonksiyonlar."""

import re
from datetime import date, timedelta

import pytest

from bahcelab_backend.domain.agro.catalog import load_catalog
from bahcelab_backend.domain.agro.score import AktifRisk
from bahcelab_backend.domain.agro.status_v2 import (
    ChangeSignal,
    HeatInput,
    IndexInput,
    StatusInputs,
    change_points,
    combine_water,
    evaluate,
    fill_points,
    heat_points,
    index_points,
    robust_center_scale,
)

RULE = load_catalog().durum_v2
TODAY = date(2026, 10, 13)
HISTORY = [0.66, 0.68, 0.70, 0.67, 0.69, 0.71, 0.68, 0.70, 0.69, 0.67, 0.72, 0.70, 0.68, 0.69]  # ortanca ≈ 0,69, MAD ≈ 0,01 → ölçek taban 0,03


def idx(value: float, day: date = TODAY - timedelta(days=3), history: list[float] | None = None) -> IndexInput:
    return IndexInput(value, day, HISTORY if history is None else history)


def inputs(**kw):  # noqa: ANN003, ANN201
    base = {
        "bugun": TODAY, "ndvi": idx(0.69), "ndmi": idx(0.69), "ndre": idx(0.69), "doluluk": 70.0, "doluluk_tarihi": TODAY - timedelta(days=2),
        "degisimler": [], "isi": HeatInput(TODAY - timedelta(days=10), 8.0, 10.0, False), "riskler": [],
    }
    return StatusInputs(**{**base, **kw})


def test_only_downward_deviation_is_penalised_and_scale_never_falls_below_the_floor() -> None:
    center, scale = robust_center_scale(HISTORY, RULE.sigma_taban_ndvi)
    assert center == pytest.approx(0.69, abs=0.005) and scale == RULE.sigma_taban_ndvi  # MAD küçük: taban geçerli
    assert index_points(idx(0.95), RULE.sigma_taban_ndvi, RULE)[0] == 100  # normalin ÜSTÜ ceza değil
    assert index_points(idx(0.69 - 0.03), RULE.sigma_taban_ndvi, RULE)[0] == 100  # 1 ölçek: tolerans içinde
    mid = index_points(idx(0.69 - 0.06), RULE.sigma_taban_ndvi, RULE)[0]
    assert mid is not None and 40 <= mid <= 60  # 2 ölçek aşağıda ≈ yarı puan
    assert index_points(idx(0.69 - 0.12), RULE.sigma_taban_ndvi, RULE)[0] == 0


def test_too_little_same_month_history_means_no_judgement() -> None:
    points, why = index_points(idx(0.2, history=[0.7] * (RULE.asgari_ornek - 1)), RULE.sigma_taban_ndvi, RULE)
    assert points is None and "yeterli geçmiş" in why
    assert index_points(None, RULE.sigma_taban_ndvi, RULE)[0] is None


def test_water_is_the_mean_of_ndmi_and_fill_but_the_worse_one_when_both_are_below_normal() -> None:
    assert combine_water(100, 100, RULE) == 100
    assert combine_water(100, 60, RULE) == 80  # biri normal: ortalama
    assert combine_water(70, 60, RULE) == 60  # ikisi de normalin altı: kötüsü
    assert combine_water(None, 50, RULE) == 50 and combine_water(40, None, RULE) == 40 and combine_water(None, None, RULE) is None
    assert fill_points(RULE.doluluk_normal_min, RULE) == 100 and fill_points(RULE.doluluk_sifir, RULE) == 0 and fill_points(25.0, RULE) == 50 and fill_points(None, RULE) is None


def test_change_component_looks_only_at_recent_events_and_both_sources_are_worse() -> None:
    s2, radar = ChangeSignal("s2", TODAY - timedelta(days=5)), ChangeSignal("radar", TODAY - timedelta(days=9))
    assert change_points([], TODAY, RULE)[0] == 100
    assert change_points([s2], TODAY, RULE)[0] == RULE.ani_s2_puan and change_points([radar], TODAY, RULE)[0] == RULE.ani_radar_puan
    assert change_points([s2, radar], TODAY, RULE)[0] == RULE.ani_ikisi_puan
    assert change_points([ChangeSignal("s2", TODAY - timedelta(days=RULE.ani_pencere_gun + 1))], TODAY, RULE)[0] == 100  # eski olay sayılmaz


def test_heat_is_unavailable_for_mixed_pixels_and_penalised_only_above_the_months_band() -> None:
    assert heat_points(HeatInput(TODAY, 12.0, 10.0, True), RULE)[0] is None  # karışık piksel
    assert heat_points(HeatInput(TODAY, 9.0, 10.0, False), RULE)[0] == 100
    p, _ = heat_points(HeatInput(TODAY, 11.5, 10.0, False), RULE)
    assert p == 50  # bandın 1,5 °C üstü = 3 °C sıfır noktasının yarısı
    assert heat_points(HeatInput(TODAY, 14.0, 10.0, False), RULE)[0] == 0
    assert heat_points(HeatInput(TODAY, None, None, False), RULE)[0] is None and heat_points(None, RULE)[0] is None


def test_all_normal_is_iyi_with_high_confidence_and_three_sentences_without_numbers() -> None:
    result = evaluate(inputs(), RULE)
    assert result.kademe == "iyi" and result.guven == "yuksek" and result.dusuren == [] and not result.risk_sinirladi
    assert [c.kod for c in result.bilesenler] == ["agac_gucu", "su", "beslenme", "ani_degisim", "isi"] and all(c.seviye == "normal" for c in result.bilesenler)
    assert 1 <= len(result.nasil) <= 3 and not any(re.search(r"\d+[,.]?\d*\s?%|\b\d{2,}\b", s.split("Veri:")[0]) for s in result.nasil[:1])


def test_a_low_tree_vigour_lowers_the_tier_and_is_named_as_the_cause() -> None:
    result = evaluate(inputs(ndvi=idx(0.69 - 0.09)), RULE)  # 3 ölçek aşağıda: ağaç gücü puanı 0
    assert result.kademe in ("izle", "dikkat") and result.dusuren[0] == "agac_gucu" and "Ağaç gücü" in result.nasil[0]
    assert next(c for c in result.bilesenler if c.kod == "agac_gucu").seviye == "belirgin_dusuk"


def test_water_below_normal_in_both_signals_counts_the_worse_of_them() -> None:
    result = evaluate(inputs(ndmi=idx(0.69 - 0.06), doluluk=20.0), RULE)  # NDMI ≈ 50, doluluk 33 → ikisi de normalin altı → kötüsü
    water = next(c for c in result.bilesenler if c.kod == "su")
    assert water.puan == min(index_points(idx(0.69 - 0.06), 0.03, RULE)[0] or 0, fill_points(20.0, RULE) or 0) and "birlikte düşük" in water.neden


def test_stale_satellite_data_redistributes_weight_and_lowers_confidence() -> None:
    old = TODAY - timedelta(days=RULE.bayat_s2_gun + 1)
    result = evaluate(inputs(ndvi=idx(0.69, old), ndmi=idx(0.69, old), ndre=idx(0.69, old)), RULE)
    by = {c.kod: c for c in result.bilesenler}
    assert not by["agac_gucu"].kullanilabilir and by["agac_gucu"].bayat and not by["beslenme"].kullanilabilir
    assert by["su"].kullanilabilir  # kök bölgesi doluluğu (ERA5) tek başına sürer
    assert sum(c.etkin_agirlik for c in result.bilesenler) == pytest.approx(1.0)  # ağırlık dağıtıldı
    assert result.guven in ("orta", "dusuk") and "bayat" in result.guven_nedeni
    stale_heat = evaluate(inputs(isi=HeatInput(TODAY - timedelta(days=RULE.bayat_landsat_gun + 1), 8.0, 10.0, False)), RULE)
    assert not next(c for c in stale_heat.bilesenler if c.kod == "isi").kullanilabilir and stale_heat.guven != "yuksek"


def test_risk_ceiling_medium_risk_caps_at_izle_and_high_risk_at_dikkat_but_never_improves_a_worse_tier() -> None:
    medium = evaluate(inputs(riskler=[AktifRisk("Meyve sineği", "orta")]), RULE)
    assert medium.kademe == "izle" and medium.risk_sinirladi
    high = evaluate(inputs(riskler=[AktifRisk("Meyve sineği", "yuksek")]), RULE)
    assert high.kademe == "dikkat"
    bad = evaluate(inputs(ndvi=idx(0.3), ndmi=idx(0.3), ndre=idx(0.3), doluluk=0.0, riskler=[AktifRisk("X", "orta")]), RULE)
    assert bad.kademe in ("dikkat", "sorun") and bad.kademe != "izle"  # tavan kademeyi İYİLEŞTİRMEZ
    assert evaluate(inputs(kirmizi_uyari=True), RULE).kademe == "dikkat"


def test_no_usable_data_is_veri_yok_unless_a_risk_decides() -> None:
    nothing = StatusInputs(TODAY, None, None, None, None, None, [], None)
    assert evaluate(nothing, RULE).kademe == "veri_yok" and evaluate(nothing, RULE).guven == "dusuk"
    assert evaluate(StatusInputs(TODAY, None, None, None, None, None, [], None, [AktifRisk("X", "yuksek")]), RULE).kademe == "dikkat"


def test_ani_degisim_enters_the_score_and_names_the_sources() -> None:
    quiet = evaluate(inputs(), RULE)
    hit = evaluate(inputs(degisimler=[ChangeSignal("s2", TODAY - timedelta(days=4)), ChangeSignal("radar", TODAY - timedelta(days=6))]), RULE)
    assert (hit.ic_puan or 0) < (quiet.ic_puan or 0) and "optik düşüş ve radar değişimi" in next(c for c in hit.bilesenler if c.kod == "ani_degisim").neden
    assert "ani_degisim" in hit.dusuren
