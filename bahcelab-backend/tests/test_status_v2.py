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


# ----------------------------------------------------------------------------- tek etiket kuralı (9F düzeltmesi)
BAND = (5.0, 7.0, 9.0, 11.0)  # p10, p25, p75, p90


def test_one_label_rule_for_every_component_p25_p75_normal_outer_bands_below_or_above_and_beyond_p10_p90_distinct() -> None:
    from bahcelab_backend.domain.agro.status_v2 import position_label

    labels = [position_label(v, BAND, RULE) for v in (4.0, 6.0, 8.0, 10.0, 12.0)]
    assert labels == ["belirgin_dusuk", "normalin_alti", "normal", "normalin_ustu", "belirgin_yuksek"]
    assert position_label(7.0, BAND, RULE) == "normal" and position_label(9.0, BAND, RULE) == "normal"  # sınırlar normal bandın içindedir
    assert position_label(5.0, BAND, RULE) == "normalin_alti" and position_label(11.0, BAND, RULE) == "normalin_ustu"  # tam p10/p90: «belirgin» için aşılması gerekir


def test_index_label_uses_the_gardens_own_same_month_history() -> None:
    from bahcelab_backend.domain.agro.status_v2 import index_label

    history = [0.60 + 0.01 * i for i in range(20)]  # 0,60 … 0,79
    assert index_label(idx(0.70, history=history), RULE) == "normal"
    assert index_label(idx(0.62, history=history), RULE) == "normalin_alti"  # p10–p25
    assert index_label(idx(0.50, history=history), RULE) == "belirgin_dusuk"
    assert index_label(idx(0.95, history=history), RULE) == "belirgin_yuksek"
    assert index_label(idx(0.5, history=history[: RULE.asgari_ornek - 1]), RULE) is None  # örnek yetersiz: etiket yok


def test_water_label_follows_the_points_rule_worse_when_both_low_otherwise_at_most_normalin_alti() -> None:
    from bahcelab_backend.domain.agro.status_v2 import water_label

    assert water_label("belirgin_dusuk", "normalin_alti") == "belirgin_dusuk" and water_label("normalin_alti", "belirgin_dusuk") == "belirgin_dusuk"
    assert water_label("belirgin_dusuk", "normal") == "normalin_alti" and water_label("normal", "normalin_alti") == "normalin_alti"  # tek sinyal: puan ortalaması gibi sınırlı
    assert water_label("normal", "normal") == "normal" and water_label(None, "belirgin_dusuk") == "belirgin_dusuk" and water_label("normalin_ustu", "normal") == "normalin_ustu" and water_label(None, None) is None


def test_heat_label_is_by_the_same_rule_and_mixed_pixels_have_no_label() -> None:
    from bahcelab_backend.domain.agro.status_v2 import heat_label

    heat = lambda f, mixed=False: HeatInput(TODAY, f, BAND[2], mixed, BAND)  # noqa: E731
    assert [heat_label(heat(v)) for v in (4.0, 6.0, 8.0, 10.0, 12.0)] == ["belirgin_dusuk", "normalin_alti", "normal", "normalin_ustu", "belirgin_yuksek"]
    assert heat_label(heat(12.0, True)) is None and heat_label(None) is None


def test_the_garden_that_is_1_6_degrees_above_its_p75_but_below_p90_is_labelled_normalin_ustu_not_belirgin() -> None:
    # jlnnlk 25 Eylül: fark 12,0 °C, aynı ay p75 = 10,4 °C; p90 = 12,6 °C → p75–p90: «normalin üstü»
    band = (6.9, 7.8, 10.4, 12.6)
    result = evaluate(inputs(isi=HeatInput(TODAY - timedelta(days=10), 12.0, 10.4, False, band)), RULE)
    heat = next(c for c in result.bilesenler if c.kod == "isi")
    assert heat.seviye == "normalin_ustu" and heat.puan is not None and heat.puan < 100  # cezası sürer (yukarı yön kötü), etiketi p10/p90 kuralına göre
    assert "isi" in result.dusuren and "üstünde" in heat.neden
    beyond = evaluate(inputs(isi=HeatInput(TODAY - timedelta(days=10), 13.0, 10.4, False, band)), RULE)
    assert next(c for c in beyond.bilesenler if c.kod == "isi").seviye == "belirgin_yuksek"


def test_the_change_component_is_labelled_by_event_kind_not_by_a_distribution() -> None:
    from bahcelab_backend.domain.agro.status_v2 import change_label

    assert change_label([]) == "normal" and change_label(["radar değişimi"]) == "normalin_alti" and change_label(["optik düşüş"]) == "belirgin_dusuk" and change_label(["optik düşüş", "radar değişimi"]) == "belirgin_dusuk"
