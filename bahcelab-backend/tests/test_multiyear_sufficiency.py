"""Yıl veri yeterliliği (SAF): net sahne sayısı ve ay kapsamı; yetersiz yıl «uyumsuz» sayılmaz."""

from datetime import date

from bahcelab_backend.domain.multiyear.sufficiency import (
    assess_sufficiency,
    period_count,
    window_months,
)

FIRST, LAST = date(2021, 6, 1), date(2021, 9, 30)  # Haz–Eyl = 4 ay


def d(*month_day: tuple[int, int]) -> list[date]:
    return [date(2021, m, day) for m, day in month_day]


def test_window_months() -> None:
    assert window_months(FIRST, LAST) == [(2021, 6), (2021, 7), (2021, 8), (2021, 9)] and period_count(FIRST, LAST) == 4


def test_two_scenes_in_each_month_is_sufficient() -> None:
    r = assess_sufficiency(d((6, 3), (6, 20), (7, 4), (7, 20), (8, 3), (8, 19), (9, 2), (9, 15)), FIRST, LAST, min_scenes=3, min_month_coverage=0.75)
    assert not r.insufficient and r.net_days == 8 and r.periods_covered == 4 and r.period_coverage == 1.0


def test_three_of_four_months_is_the_minimum_coverage() -> None:
    ok = assess_sufficiency(d((6, 3), (7, 4), (8, 3)), FIRST, LAST, min_scenes=3, min_month_coverage=0.75)
    assert not ok.insufficient and ok.period_coverage == 0.75


def test_few_scenes_is_insufficient_and_says_why() -> None:
    r = assess_sufficiency(d((7, 5)), FIRST, LAST, min_scenes=3, min_month_coverage=0.75)
    assert r.insufficient and "1 net sahne" in (r.reason or "")


def test_clustered_scenes_in_two_months_fail_month_coverage() -> None:
    r = assess_sufficiency(d((6, 1), (6, 12), (6, 25), (7, 3), (7, 20)), FIRST, LAST, min_scenes=3, min_month_coverage=0.75)
    assert r.insufficient and r.period_coverage == 0.5 and "ayın yalnızca 2" in (r.reason or "")


def test_same_day_duplicates_count_once_and_outside_dates_are_ignored() -> None:
    r = assess_sufficiency(d((6, 3), (6, 3), (7, 4)) + [date(2021, 5, 1), date(2021, 10, 1)], FIRST, LAST, min_scenes=1, min_month_coverage=0.0)
    assert r.net_days == 2


def test_no_scenes() -> None:
    r = assess_sufficiency([], FIRST, LAST, min_scenes=3, min_month_coverage=0.75)
    assert r.insufficient and r.net_days == 0 and r.period_coverage == 0.0
