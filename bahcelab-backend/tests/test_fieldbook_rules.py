"""Saha Defteri kuralları: doğruluk özeti (yetersiz doğrulamada yorum yok), en yakın komşu sıra, stres yaması (saf birim testleri)."""

import numpy as np

from bahcelab_backend.domain.fieldbook import rules as fr


def test_event_type_groups_put_merged_frost_and_optical_trace_under_frost():
    assert fr.tur_grubu("don", ["don", "s2_dusus"]) == "don"
    assert fr.tur_grubu("asiri_yagis", ["asiri_yagis"]) == "yagis"
    assert fr.tur_grubu("s2_dusus", ["s2_dusus"]) == "optik" and fr.tur_grubu("radar_degisim", ["radar_degisim"]) == "radar"
    assert fr.tur_grubu("kademe", []) == "uyari"


def test_accuracy_says_not_enough_verifications_instead_of_a_ratio_when_n_is_small():
    rows = [("don", "gerceklesti"), ("don", "gerceklesmedi"), ("don", "bilinmiyor"), ("don", None), ("yagis", None)]
    result = {r.tur: r for r in fr.accuracy(rows, min_n=5)}
    assert result["don"].dogrulanan == 2 and result["don"].bekleyen == 1 and result["don"].bilinmiyor == 1  # bilinmiyor yargı sayılmaz
    assert not result["don"].yeterli and "henüz yeterli doğrulama yok" in result["don"].metin and "gerçekleşti" not in result["don"].metin.replace("henüz yeterli doğrulama yok", "")
    assert result["yagis"].dogrulanan == 0 and "henüz yeterli doğrulama yok" in result["yagis"].metin
    assert "ruzgar" not in result  # kaydı olmayan tür listelenmez


def test_accuracy_reports_counts_once_there_are_enough_verifications():
    rows = [("optik", "gerceklesti")] * 3 + [("optik", "gerceklesmedi")] * 2
    r = fr.accuracy(rows, min_n=5)[0]
    assert r.yeterli and r.gerceklesti == 3 and r.gerceklesmedi == 2 and r.metin == "5 doğrulama: 3 gerçekleşti, 2 yanlış alarm"


def test_nearest_neighbour_orders_from_the_start_and_legs_add_up():
    pts = [(27.0030, 38.0), (27.0010, 38.0), (27.0020, 38.0)]  # doğuya doğru üç nokta, karışık verilmiş
    start = (27.0, 38.0)
    order = fr.nearest_neighbour(pts, start)
    assert order == [1, 2, 0]
    legs = fr.legs(pts, order, start)
    assert len(legs) == 3 and all(leg > 0 for leg in legs) and abs(sum(legs) - fr.haversine_m(start, pts[0])) < 1.0  # düz hatta toplam = uç noktaya mesafe
    assert fr.nearest_neighbour([], start) == []


def test_tour_minutes_uses_walking_speed_and_per_stop_time():
    assert fr.tour_minutes(400, 5, 40, 4) == 30


def test_stress_patch_finds_the_largest_contiguous_low_area_and_ignores_small_or_missing():
    rng = np.random.default_rng(1)
    grid = 0.7 + rng.normal(0, 0.005, (30, 30)).astype(np.float32)
    grid[5:12, 5:12] = 0.4  # 49 piksel = 4,9 da (10 m piksel)
    patch = fr.stress_patch(grid, percentile=10, min_da=3.0)
    assert patch is not None and 4.5 <= patch.area_da <= 5.5 and 6.5 <= patch.row <= 9.5 and 6.5 <= patch.col <= 9.5
    small = 0.7 + rng.normal(0, 0.005, (30, 30)).astype(np.float32)
    small[5:7, 5:7] = 0.4
    assert fr.stress_patch(small, percentile=10, min_da=3.0) is None  # 0,4 da: çok küçük
    assert fr.stress_patch(np.full((4, 4), np.nan, dtype=np.float32), 10, 3.0) is None


def test_stress_patch_must_be_a_cluster_not_scattered_specks():
    rng = np.random.default_rng(3)
    grid = (0.7 + rng.normal(0, 0.01, (40, 40))).astype(np.float32)  # alt %10 dağınık benekler: bitişik küme yok
    assert fr.stress_patch(grid, percentile=10, min_da=0.3) is None
