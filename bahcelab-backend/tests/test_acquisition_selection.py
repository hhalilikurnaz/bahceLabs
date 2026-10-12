"""Ay bazlı sahne seçimi (SAF): en iyi 2 net sahne, aralarında ≥ 10 gün; ay aralıkları."""

from datetime import date

from bahcelab_backend.domain.acquisitions.selection import (
    is_spaced,
    month_first,
    month_last,
    months_between,
    next_candidate_order,
)


def test_month_helpers() -> None:
    assert month_first(date(2026, 10, 12)) == date(2026, 10, 1)
    assert month_last(date(2026, 2, 1)) == date(2026, 2, 28) and month_last(date(2028, 2, 1)) == date(2028, 2, 29)
    assert month_last(date(2026, 12, 1)) == date(2026, 12, 31)
    assert months_between(date(2015, 11, 20), date(2016, 2, 3)) == [date(2015, 11, 1), date(2015, 12, 1), date(2016, 1, 1), date(2016, 2, 1)]


def test_spacing_rule_is_inclusive_at_ten_days() -> None:
    accepted = [date(2026, 6, 10)]
    assert not is_spaced(date(2026, 6, 19), accepted, 10)  # 9 gün
    assert is_spaced(date(2026, 6, 20), accepted, 10)  # tam 10 gün
    assert is_spaced(date(2026, 5, 31), accepted, 10)
    assert is_spaced(date(2026, 6, 10), [], 10)


def test_candidates_are_read_least_cloudy_first_unknown_last() -> None:
    cands = [(date(2026, 6, 5), 30.0, "a"), (date(2026, 6, 1), None, "b"), (date(2026, 6, 9), 2.0, "c"), (date(2026, 6, 3), 2.0, "d")]
    assert [c[2] for c in next_candidate_order(cands)] == ["d", "c", "a", "b"]
