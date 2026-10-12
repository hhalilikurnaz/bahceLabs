"""Yıl veri yeterliliği (SAF): net sahne sayısı ve 10 günlük dönem kapsamı; yetersiz yıl «uyumsuz» sayılmaz."""

from datetime import date, timedelta

from bahcelab_backend.domain.multiyear.sufficiency import assess_sufficiency, period_count

FIRST, LAST = date(2021, 6, 1), date(2021, 9, 30)  # Haz–Eyl = 122 gün → 13 dönem (10 gün)


def days(*offsets: int) -> list[date]:
    return [FIRST + timedelta(days=o) for o in offsets]


def test_period_count_rounds_up() -> None:
    assert period_count(FIRST, LAST, 10) == 13


def test_enough_scenes_and_coverage_is_sufficient() -> None:
    result = assess_sufficiency(days(2, 12, 22, 32, 42, 52, 62, 72), FIRST, LAST, min_scenes=3, min_period_coverage=0.5, period_days=10)
    assert not result.insufficient and result.net_days == 8 and result.period_coverage == round(8 / 13, 3)


def test_few_scenes_is_insufficient_and_says_why() -> None:
    result = assess_sufficiency(days(5), FIRST, LAST, min_scenes=3, min_period_coverage=0.5, period_days=10)
    assert result.insufficient and "1 net sahne" in (result.reason or "")


def test_clustered_scenes_fail_period_coverage() -> None:
    # 5 sahne ama hepsi aynı 10 günlükte: sayı yeter, zamansal kapsam yetmez
    result = assess_sufficiency(days(1, 2, 3, 4, 5), FIRST, LAST, min_scenes=3, min_period_coverage=0.5, period_days=10)
    assert result.insufficient and result.period_coverage < 0.5 and "dönem" in (result.reason or "")


def test_same_day_duplicates_count_once() -> None:
    result = assess_sufficiency(days(3, 3, 3, 13), FIRST, LAST, min_scenes=3, min_period_coverage=0.1, period_days=10)
    assert result.net_days == 2 and result.insufficient


def test_no_scenes() -> None:
    result = assess_sufficiency([], FIRST, LAST, min_scenes=3, min_period_coverage=0.5, period_days=10)
    assert result.insufficient and result.net_days == 0 and result.period_coverage == 0.0


def test_dates_outside_window_are_ignored() -> None:
    result = assess_sufficiency([date(2021, 5, 1), date(2021, 10, 1)], FIRST, LAST, min_scenes=1, min_period_coverage=0.0, period_days=10)
    assert result.net_days == 0 and result.insufficient


def test_spread_by_period_takes_best_scene_of_each_period_first() -> None:
    from bahcelab_backend.domain.imagery.provider import SceneRef
    from bahcelab_backend.domain.multiyear.composite import spread_by_period

    def ref(offset: int, cloud: float) -> SceneRef:
        d = FIRST + timedelta(days=offset)
        return SceneRef(tarih=d, scene_id=f"S{offset}", bulut_orani=cloud)

    # 1. dönemde 3 çok temiz sahne, 2. ve 3. dönemde birer bulutlu sahne: sınırlı bütçede her döneme yer ayrılmalı
    ordered = spread_by_period([ref(1, 1), ref(2, 2), ref(3, 3), ref(12, 40), ref(25, 30)], FIRST, 10)
    assert {r.scene_id for r in ordered[:3]} == {"S1", "S12", "S25"}  # her dönemden en temizi önce
    assert {r.scene_id for r in ordered} == {"S1", "S2", "S3", "S12", "S25"}  # hiçbir aday kaybolmaz
