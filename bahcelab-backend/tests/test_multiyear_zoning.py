"""Çok yıllık bölgeleme: sentetik raster desenleriyle bilinen desen → beklenen bölgeler, istikrar, uyumsuz yıl, homojen bahçe."""

import numpy as np
import pytest

from bahcelab_backend.domain.multiyear.zoning import (
    YearMap,
    ZoningConfig,
    classify,
    compute_zones,
    gaussian_nan,
    kmeans_1d,
    merge_small_parts,
    rank_normalize,
)

H = W = 60
CFG = ZoningConfig(min_years=3, smoothing_sigma_px=1.0, min_zone_area_m2=500.0)
MASK = np.ones((H, W), dtype=bool)


def bands(levels: list[float]) -> np.ndarray:
    """Dikey şeritler: soldan sağa `levels` değerleri (eşit genişlik)."""
    out = np.empty((H, W), dtype=np.float32)
    edges = np.linspace(0, W, len(levels) + 1).astype(int)
    for level, a, b in zip(levels, edges[:-1], edges[1:], strict=True):
        out[:, a:b] = level
    return out


def years_from(
    pattern: np.ndarray, count: int, noise: float = 0.01, seed: int = 1, first: int = 2018
) -> list[YearMap]:
    rng = np.random.default_rng(seed)
    return [
        YearMap(first + i, (pattern + rng.normal(0, noise, pattern.shape)).astype(np.float32))
        for i in range(count)
    ]


def expected_labels(k: int) -> np.ndarray:
    edges = np.linspace(0, W, k + 1).astype(int)
    out = np.zeros((H, W), dtype=np.int8)
    for i, (a, b) in enumerate(zip(edges[:-1], edges[1:], strict=True), start=1):
        out[:, a:b] = i
    return out


# ----------------------------------------------------------------------------- yardımcılar
def test_rank_normalize_is_a_percentile_rank_and_ties_share_the_average():
    values = np.array([[1.0, 2.0], [3.0, 4.0]], dtype=np.float32)
    ranks = rank_normalize(values, np.ones((2, 2), bool))
    assert ranks.ravel().tolist() == pytest.approx([0.0, 1 / 3, 2 / 3, 1.0])
    flat = rank_normalize(np.full((3, 3), 0.5, np.float32), np.ones((3, 3), bool))
    assert np.allclose(flat, 0.5)  # düz alan sahte desen üretmez
    masked = rank_normalize(values, np.array([[True, False], [True, True]]))
    assert np.isnan(masked[0, 1]) and masked[1, 1] == 1.0


def test_kmeans_and_classify_are_deterministic_and_ordered():
    values = np.concatenate([np.full(50, 0.2), np.full(50, 0.5), np.full(50, 0.8)])
    centers = kmeans_1d(values, 3)
    assert centers.tolist() == pytest.approx([0.2, 0.5, 0.8])
    assert classify(np.array([0.1, 0.55, 0.9, np.nan]), centers).tolist() == [1, 2, 3, 0]


def test_gaussian_nan_ignores_missing_pixels_and_keeps_them_missing():
    v = np.full((9, 9), 2.0, np.float32)
    v[4, 4] = np.nan
    out = gaussian_nan(v, 1.0)
    assert (
        np.isnan(out[4, 4]) and np.nanmax(np.abs(out - 2.0)) < 1e-4
    )  # eksik piksel komşuları sıfıra çekmez


def test_small_parts_are_merged_into_the_majority_neighbour():
    labels = np.full((20, 20), 1, dtype=np.int8)
    labels[:, 10:] = 2
    labels[5, 5] = 3  # tek piksellik parça
    out = merge_small_parts(labels, 3, min_pixels=4)
    assert out[5, 5] == 1 and (out == 3).sum() == 0
    keep = np.full((20, 20), 1, dtype=np.int8)
    keep[:, 10:] = 2
    assert (merge_small_parts(keep, 2, min_pixels=4) == keep).all()  # büyük parçalar korunur


# ----------------------------------------------------------------------------- bilinen desen → beklenen bölgeler
@pytest.mark.parametrize("k", [3, 5])
def test_known_pattern_gives_the_expected_zones_and_high_stability(k):
    pattern = bands(list(np.linspace(0.45, 0.8, k)))
    result = compute_zones(years_from(pattern, 8), MASK, k, CFG)
    assert result.status == "ok" and result.labels is not None and result.stability is not None
    agreement = (result.labels == expected_labels(k)).mean()
    assert agreement >= 0.95, agreement
    assert not result.homogeneous and result.spread_percent and result.spread_percent > 30
    assert [z.cls for z in result.zones] == list(range(1, k + 1))
    assert (
        result.zones[0].diff_percent < 0 < result.zones[-1].diff_percent
    )  # en zayıf bahçe ortalamasının altında
    assert result.zones[0].mean_raw < result.zones[-1].mean_raw
    assert float(np.nanmean(result.stability)) > 0.85  # her yıl aynı desen → istikrarlı
    assert sum(z.share for z in result.zones) == pytest.approx(1.0)
    assert result.years_used == list(range(2018, 2026)) and not any(
        a.incompatible for a in result.assessments
    )


def test_instability_is_low_where_years_disagree():
    k = 3
    pattern = bands([0.45, 0.6, 0.75])
    years = years_from(pattern, 8)
    # Orta şerit yıllara göre değişken: bazı yıllar zayıf, bazıları güçlü (desen korunur, ama orta şeridin sınıfı oynar)
    rng = np.random.default_rng(5)
    for y in years:
        shift = rng.choice([-0.2, 0.2])
        y.values[:, 20:40] += np.float32(shift)
    result = compute_zones(
        years, MASK, k, CFG, include={y.year: True for y in years}
    )  # tüm yıllar dahil (otomatik işaret kapalı)
    assert result.stability is not None
    mid = result.stability[:, 22:38]
    edge_left = result.stability[:, 2:15]
    assert float(np.nanmean(mid)) < float(np.nanmean(edge_left)) - 0.2


# ----------------------------------------------------------------------------- uyumsuz yıl
def test_incompatible_year_is_flagged_excluded_and_user_can_include_it():
    k = 3
    pattern = bands([0.45, 0.6, 0.75])
    years = years_from(pattern, 7)
    rng = np.random.default_rng(99)
    flood = rng.uniform(0.3, 0.8, (H, W)).astype(np.float32)  # sel yılı: desen yok
    years.insert(3, YearMap(2021, flood))
    years = sorted(years, key=lambda y: y.year)
    # yıl numaraları çakışmasın
    for i, y in enumerate(years):
        years[i] = YearMap(2018 + i, y.values)
    flood_year = (
        2021 if years[3].values is flood else next(y.year for y in years if y.values is flood)
    )
    result = compute_zones(years, MASK, k, CFG)
    flagged = [a.year for a in result.assessments if a.incompatible]
    assert flagged == [flood_year]
    assert flood_year not in result.years_used and len(result.years_used) == 7
    bad = next(a for a in result.assessments if a.year == flood_year)
    assert bad.correlation is not None and bad.correlation < CFG.year_min_correlation and bad.reason
    assert (result.labels == expected_labels(k)).mean() >= 0.95  # sel yılı sonucu bozmaz

    forced = compute_zones(years, MASK, k, CFG, include={flood_year: True})
    assert flood_year in forced.years_used and len(forced.years_used) == 8
    manual_out = compute_zones(years, MASK, k, CFG, include={2018: False})
    assert 2018 not in manual_out.years_used


def test_too_few_years_is_insufficient_not_a_guess():
    pattern = bands([0.45, 0.6, 0.75])
    result = compute_zones(years_from(pattern, 2), MASK, 3, CFG)
    assert (
        result.status == "insufficient"
        and result.labels is None
        and "en az 3 yıl" in (result.message or "")
    )
    mostly_cloudy = [YearMap(2018 + i, np.full((H, W), np.nan, np.float32)) for i in range(5)]
    assert compute_zones(mostly_cloudy, MASK, 3, CFG).status == "insufficient"


def test_year_with_low_coverage_is_flagged_and_excluded():
    pattern = bands([0.45, 0.6, 0.75])
    years = years_from(pattern, 6)
    years[2].values[:, 20:] = np.nan  # bahçenin üçte ikisinde veri yok
    result = compute_zones(years, MASK, 3, CFG)
    gap = result.assessments[2]
    assert (
        gap.incompatible
        and gap.coverage < CFG.min_year_coverage
        and "net görüntü" in (gap.reason or "")
    )
    assert years[2].year not in result.years_used


# ----------------------------------------------------------------------------- homojen bahçe
def test_homogeneous_garden_is_reported_even_though_years_are_uncorrelated_noise():
    flat = np.full((H, W), 0.65, dtype=np.float32)
    result = compute_zones(years_from(flat, 8, noise=0.005, seed=3), MASK, 3, CFG)
    assert result.status == "ok"
    assert (
        result.homogeneous is True
        and result.spread_percent is not None
        and result.spread_percent < CFG.homogeneous_diff_percent
    )
    assert not any(a.incompatible for a in result.assessments)  # gürültü yılları uyumsuz sayılmaz


def test_difference_just_above_the_threshold_is_not_homogeneous():
    cfg = ZoningConfig(min_years=3, smoothing_sigma_px=1.0, homogeneous_diff_percent=8.0)
    low = compute_zones(years_from(bands([0.64, 0.66]), 6, noise=0.002), MASK, 2, cfg)  # ≈ %3 fark
    high = compute_zones(
        years_from(bands([0.60, 0.70]), 6, noise=0.002), MASK, 2, cfg
    )  # ≈ %15 fark
    assert low.homogeneous is True and high.homogeneous is False


def test_circular_garden_mask_only_counts_pixels_inside():
    yy, xx = np.mgrid[:H, :W]
    mask = (yy - 30) ** 2 + (xx - 30) ** 2 <= 25**2
    pattern = bands([0.45, 0.6, 0.75])
    years = years_from(pattern, 6)
    result = compute_zones(years, mask, 3, CFG)
    assert result.labels is not None
    assert (result.labels[~mask] == 0).all() and (result.labels[mask] > 0).all()
    assert sum(z.area_m2 for z in result.zones) == pytest.approx(mask.sum() * CFG.pixel_area_m2)


def test_incompatible_recent_year_is_never_silently_dropped():
    """Son iki yıl uyumsuz çıksa bile varsayılan olarak analizde kalır (gerçek bir değişim olabilir); karar kullanıcıya sorulur."""
    pattern = bands([0.45, 0.6, 0.75])
    years = years_from(pattern, 7)
    rng = np.random.default_rng(99)
    last = YearMap(2025, rng.uniform(0.3, 0.8, (H, W)).astype(np.float32))  # son yıl: desen yok
    years.append(last)
    result = compute_zones(years, MASK, 3, CFG)
    flagged = next(a for a in result.assessments if a.year == 2025)
    assert flagged.incompatible and flagged.protected  # uyumsuz ama korumalı
    assert 2025 in result.years_used  # sessizce atılmadı
    excluded = compute_zones(years, MASK, 3, CFG, include={2025: False})
    assert 2025 not in excluded.years_used  # kullanıcı kararı geçerli
    assert [a.year for a in result.assessments if a.protected] == [2025]  # yalnız uyumsuz ve son iki yılda olan
