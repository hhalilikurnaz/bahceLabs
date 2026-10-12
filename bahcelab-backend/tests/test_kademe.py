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


# ----------------------------------------------------------------------------- normal banda göre karar (ortanca/MAD sapması)
from bahcelab_backend.domain.agro.score import AY_ADLARI, BandRef  # noqa: E402


def band(month: int = 10, median: float = 0.60, mad: float = 0.02, years: int = 9) -> BandRef:
    decile = years >= 8
    return BandRef(ay=month, yil_sayisi=years, yillar=list(range(2016, 2016 + years)), p25=median - mad, p50=median, p75=median + mad, p10=median - 2 * mad if decile else None, onluk_yeterli=decile)


def october_scenes(ndvi_last: float) -> list[SceneValue]:
    return [SceneValue(date(2026, 8, 1) + timedelta(days=i * 5), {"ndvi": ndvi_last, "ndmi": 0.2}) for i in range(12)]  # son sahne Eki 1 civarı


def test_tree_vigor_chip_follows_the_normal_band_not_the_recent_weeks() -> None:
    scenes = october_scenes(0.60)
    today = scenes[-1].tarih
    bands = {"ndvi": band(month=today.month)}
    normal = assess(scenes, spans=SPANS, sat_severities=[], weather_severities=[], today=today, cfg=CFG, bands=bands)
    assert next(c for c in normal.cipler if c.kod == "agac_gucu").seviye == "normal"
    # sabit 0,50: kendi son haftalarına göre «normal» görünürdü; banda göre ortancanın çok altında
    low = [SceneValue(s.tarih, {"ndvi": 0.50, "ndmi": 0.2}) for s in scenes]
    result = assess(low, spans=SPANS, sat_severities=[], weather_severities=[], today=today, cfg=CFG, bands=bands)
    chip = next(c for c in result.cipler if c.kod == "agac_gucu")
    assert chip.seviye == "belirgin_dusuk" and result.durum != "iyi" and result.dusuren == "agac_gucu"
    assert "bandının en düşüğünde" in chip.aciklama


def test_band_only_penalises_values_below_the_median() -> None:
    scenes = october_scenes(0.72)  # ortancanın çok üstünde
    result = assess(scenes, spans=SPANS, sat_severities=[], weather_severities=[], today=scenes[-1].tarih, cfg=CFG, bands={"ndvi": band(month=scenes[-1].tarih.month)})
    assert next(c for c in result.cipler if c.kod == "agac_gucu").seviye == "normal"


def test_confidence_is_told_in_terms_of_the_band_and_its_years() -> None:
    scenes = october_scenes(0.60)
    today = scenes[-1].tarih
    result = assess(scenes, spans=SPANS, sat_severities=[], weather_severities=[], today=today, cfg=CFG, bands={"ndvi": band(month=today.month)})
    assert f"{AY_ADLARI[today.month]} bandı: 9 yıl, 2016–2024" in result.guven.aciklama and result.guven.seviye == "yuksek"
    few = assess(scenes, spans=SPANS, sat_severities=[], weather_severities=[], today=today, cfg=CFG, bands={"ndvi": band(month=today.month, years=5)})
    assert few.guven.seviye == "orta"  # 5–7 yıl: orta güven


def test_insufficient_band_falls_back_to_own_history_and_says_so() -> None:
    scenes = october_scenes(0.60)
    today = scenes[-1].tarih
    short = BandRef(ay=today.month, yil_sayisi=3, yillar=[2023, 2024, 2025], p25=0.58, p50=0.6, p75=0.62)
    result = assess(scenes, spans=SPANS, sat_severities=[], weather_severities=[], today=today, cfg=CFG, bands={"ndvi": short})
    assert "yetersiz geçmiş" in result.guven.aciklama.lower()


def test_how_computed_text_is_at_most_three_short_sentences_and_names_a_risk_once() -> None:
    scenes = october_scenes(0.60)
    today = scenes[-1].tarih
    result = assess(scenes, spans=SPANS, sat_severities=[], weather_severities=[], today=today, cfg=CFG, bands={"ndvi": band(month=today.month)}, active_risks=[AktifRisk("Meyve sineği", "orta")])
    assert 1 <= len(result.cumleler) <= 3 and all(len(c) < 140 for c in result.cumleler)
    text = " ".join(result.cumleler)
    assert text.count("Meyve sineği") == 1 and "normalin altı" not in text  # aynı risk iki kez sayılmaz; seviye yazılır
    assert "orta" in text and "en fazla İzle" in text and f"{AY_ADLARI[today.month]} bandı" in text


# ----------------------------------------------------------------------------- tutarlılık: çip, çubuk ve kademe AYNI bant kuralı
from bahcelab_backend.domain.acquisitions.normal_bands import (  # noqa: E402
    MonthBand,
    position_in_band,
)


@pytest.mark.parametrize(
    ("value", "position", "level"),
    [(0.64, "ust", "normal"), (0.60, "normal", "normal"), (0.585, "normal", "normal"), (0.57, "alt", "normalin_alti"), (0.55, "en_dusuk", "belirgin_dusuk")],
)
def test_chip_and_bar_use_the_same_band_rule(value: float, position: str, level: str) -> None:
    ref = band(median=0.60, mad=0.02)  # p10 0,56 · p25 0,58 · p75 0,62
    scenes = october_scenes(value)
    today = scenes[-1].tarih
    result = assess(scenes, spans=SPANS, sat_severities=[], weather_severities=[], today=today, cfg=CFG, bands={"ndvi": band(month=today.month)})
    chip = next(c for c in result.cipler if c.kod == "agac_gucu")
    month_band = MonthBand(today.month, ref.yil_sayisi, ref.yillar, p10=ref.p10, p25=ref.p25, p50=ref.p50, p75=ref.p75, ceyrek_yeterli=True, onluk_yeterli=True)
    assert position_in_band(value, month_band) == position  # çubuk
    assert chip.seviye == level  # çip: aynı etiket


def test_value_below_the_median_but_inside_the_quartile_band_is_normal_everywhere() -> None:
    scenes = october_scenes(0.59)  # ortancanın altında, p25 (0,58) üstünde
    today = scenes[-1].tarih
    result = assess(scenes, spans=SPANS, sat_severities=[], weather_severities=[], today=today, cfg=CFG, bands={"ndvi": band(month=today.month)})
    assert next(c for c in result.cipler if c.kod == "agac_gucu").seviye == "normal"
    assert result.durum == "iyi"


def test_risk_chip_label_and_description_come_from_the_same_active_risks_even_without_images() -> None:
    risks = [AktifRisk("Meyve sineği", "orta")]
    for scenes in ([], october_scenes(0.60)):
        today = scenes[-1].tarih if scenes else date(2026, 10, 10)
        result = assess(scenes, spans=SPANS, sat_severities=[], weather_severities=[], today=today, cfg=CFG, active_risks=risks)
        chip = next(c for c in result.cipler if c.kod == "risk")
        assert chip.etiket == "orta" and "Meyve sineği · orta" in chip.aciklama and "görünmüyor" not in chip.aciklama
    none = assess([], spans=SPANS, sat_severities=[], weather_severities=[], today=date(2026, 10, 10), cfg=CFG)
    chip = next(c for c in none.cipler if c.kod == "risk")
    assert chip.etiket is None and "Meyve sineği" not in chip.aciklama
