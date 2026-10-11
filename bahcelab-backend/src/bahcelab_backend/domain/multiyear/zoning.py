"""Ağaç gücü / verim potansiyeli bölgeleri (SAF; ağ ve veritabanı yok).

Girdi: her yıl için bahçe penceresi ortak ızgarasında yıllık kompozit (NDVI medyanı; geçersiz = NaN) ve bahçe maskesi.
Adımlar: (1) her yıl bahçe içinde normalize (yüzdelik sıra) → (2) yıllar arası uyum (korelasyon) ve uyumsuz yılların işaretlenmesi →
(3) dahil edilen yılların ortalaması = potansiyel haritası → (4) yumuşatma + 1B k-means + küçük parça birleştirme = bölgeler →
(5) istikrar (her pikselin yıllar içinde aynı sınıfta kalma oranı) → (6) bahçe homojen mi.
Eşikler `ZoningConfig`'dedir (config.py).
"""

from __future__ import annotations

import warnings
from dataclasses import dataclass, field
from typing import Literal

import numpy as np
from scipy import ndimage

Stability = Literal["yuksek", "orta", "dusuk"]


@dataclass(frozen=True)
class ZoningConfig:
    min_years: int = 3  # bölgeleme için gereken en az (dahil) yıl
    year_min_correlation: float = 0.5  # yıl haritasının diğer yılların ortalamasıyla korelasyonu bunun altındaysa uyumsuz
    min_year_coverage: float = 0.6  # yılın bahçe piksellerinin en az bu kadarında geçerli kompozit olmalı
    min_pixel_year_share: float = 0.5  # bir pikselin potansiyeli için dahil yılların en az bu payında geçerli olmalı
    smoothing_sigma_px: float = 1.5  # Gauss yumuşatma (piksel)
    min_zone_area_m2: float = 500.0  # bundan küçük parçalar komşu bölgeye katılır
    homogeneous_diff_percent: float = 8.0  # en güçlü ve en zayıf bölge ortalaması arası fark bu yüzdenin altındaysa bahçe homojen
    stability_high: float = 0.75
    stability_mid: float = 0.5
    weak_zone_diff_percent: float = 8.0  # «yerinde kontrol edin» için bölgenin bahçe ortalamasının en az bu kadar altında olması
    pixel_area_m2: float = 100.0  # 10 m × 10 m


@dataclass(frozen=True)
class YearMap:
    year: int
    values: np.ndarray  # (H, W) float32, geçersiz = NaN (ham NDVI kompoziti)


@dataclass
class YearAssessment:
    year: int
    coverage: float  # bahçe piksellerinin geçerli oranı
    correlation: float | None  # diğer (tutulan) yılların ortalamasıyla; yıl sayısı yetmezse None
    incompatible: bool  # otomatik işaret
    reason: str | None = None


@dataclass
class ZoneStat:
    cls: int  # 1 = en zayıf … k = en güçlü
    area_m2: float
    share: float  # bahçe alanı payı (0–1)
    mean_raw: float
    diff_percent: float  # bahçe ortalamasına göre %
    stability_mean: float


@dataclass
class ZoningResult:
    status: Literal["ok", "insufficient"]
    message: str | None
    k: int
    years_used: list[int]
    assessments: list[YearAssessment]
    labels: np.ndarray | None = None  # (H, W) int8: 0 = bahçe dışı/veri yok, 1..k bölge
    stability: np.ndarray | None = None  # (H, W) float32 0–1 (NaN = yok)
    stability_class: np.ndarray | None = None  # (H, W) int8: 0 yok, 1 düşük, 2 orta, 3 yüksek
    potential: np.ndarray | None = None
    zones: list[ZoneStat] = field(default_factory=list)
    homogeneous: bool = False
    spread_percent: float | None = None
    garden_mean: float | None = None


# ----------------------------------------------------------------------------- yardımcılar
def rank_normalize(values: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """Bahçe içindeki geçerli piksellerin yüzdelik sırası (0 = en düşük, 1 = en yüksek); diğerleri NaN. Eşit değerler ortalama sıra alır."""
    out = np.full(values.shape, np.nan, dtype=np.float32)
    valid = mask & np.isfinite(values)
    n = int(valid.sum())
    if n < 2:
        return out
    flat = values[valid]
    order = np.argsort(flat, kind="stable")
    ranks = np.empty(n, dtype=np.float64)
    ranks[order] = np.arange(n)
    # eşit değerlerin sıralarını ortala (düz alanlar sahte desen üretmesin)
    sorted_vals = flat[order]
    boundaries = np.flatnonzero(np.diff(sorted_vals) != 0) + 1
    for group in np.split(np.arange(n), boundaries):
        if len(group) > 1:
            ranks[order[group]] = ranks[order[group]].mean()
    out[valid] = (ranks / (n - 1)).astype(np.float32)
    return out


def _pearson(a: np.ndarray, b: np.ndarray) -> float | None:
    ok = np.isfinite(a) & np.isfinite(b)
    if ok.sum() < 5:
        return None
    x, y = a[ok].astype(np.float64), b[ok].astype(np.float64)
    if x.std() < 1e-9 or y.std() < 1e-9:
        return None
    return float(np.corrcoef(x, y)[0, 1])


def gaussian_nan(values: np.ndarray, sigma: float) -> np.ndarray:
    """NaN'ı yok sayan Gauss yumuşatma (ağırlıklı); veri olmayan yerler NaN kalır."""
    if sigma <= 0:
        return values.astype(np.float32)
    valid = np.isfinite(values)
    num = ndimage.gaussian_filter(np.where(valid, values, 0.0).astype(np.float64), sigma, mode="constant")
    den = ndimage.gaussian_filter(valid.astype(np.float64), sigma, mode="constant")
    with np.errstate(invalid="ignore", divide="ignore"):
        out = num / den
    out[~valid | (den < 1e-6)] = np.nan
    return out.astype(np.float32)


def kmeans_1d(values: np.ndarray, k: int, iterations: int = 40) -> np.ndarray:
    """1B k-means; merkezler yüzdeliklerden başlatılır (deterministik). Artan sıralı merkezler."""
    centers = np.percentile(values, np.linspace(100 / (2 * k), 100 - 100 / (2 * k), k)).astype(np.float64)
    for _ in range(iterations):
        labels = np.argmin(np.abs(values[:, None] - centers[None, :]), axis=1)
        updated = np.array([values[labels == i].mean() if np.any(labels == i) else centers[i] for i in range(k)])
        if np.allclose(updated, centers, atol=1e-7):
            break
        centers = updated
    return np.sort(centers)


def classify(values: np.ndarray, centers: np.ndarray) -> np.ndarray:
    """Değeri en yakın merkeze atar → 1..k (NaN = 0)."""
    out = np.zeros(values.shape, dtype=np.int8)
    ok = np.isfinite(values)
    if ok.any():
        out[ok] = (np.argmin(np.abs(values[ok][:, None] - centers[None, :]), axis=1) + 1).astype(np.int8)
    return out


def merge_small_parts(labels: np.ndarray, k: int, min_pixels: int, max_rounds: int = 6) -> np.ndarray:
    """`min_pixels`'ten küçük bağlı parçalar, çevresindeki en yaygın komşu sınıfa katılır."""
    labels = labels.copy()
    structure = ndimage.generate_binary_structure(2, 1)
    for _ in range(max_rounds):
        changed = False
        for cls in range(1, k + 1):
            comps, count = ndimage.label(labels == cls, structure=structure)
            if count == 0:
                continue
            sizes = ndimage.sum(np.ones_like(comps), comps, index=np.arange(1, count + 1))
            for idx, size in enumerate(sizes, start=1):
                if size >= min_pixels:
                    continue
                part = comps == idx
                ring = ndimage.binary_dilation(part, structure=structure) & ~part
                neighbours = labels[ring]
                neighbours = neighbours[(neighbours > 0) & (neighbours != cls)]
                if neighbours.size:
                    labels[part] = np.bincount(neighbours).argmax()
                    changed = True
        if not changed:
            break
    return labels


# ----------------------------------------------------------------------------- yıl uyumu
def assess_years(
    years: list[YearMap], garden_mask: np.ndarray, cfg: ZoningConfig, *, flag_incompatible: bool = True
) -> tuple[list[YearAssessment], dict[int, np.ndarray]]:
    """Yılları normalize eder; kapsamı düşük yılları ve diğer yıllarla uyumsuz yılları işaretler.
    Uyumsuzluk yinelemeli bulunur: en düşük korelasyonlu yıl eşiğin altındaysa çıkarılır, kalanlar yeniden değerlendirilir."""
    total = max(1, int(garden_mask.sum()))
    normalized: dict[int, np.ndarray] = {}
    assessments: dict[int, YearAssessment] = {}
    for y in years:
        coverage = float((garden_mask & np.isfinite(y.values)).sum()) / total
        assessments[y.year] = YearAssessment(y.year, round(coverage, 4), None, False)
        if coverage < cfg.min_year_coverage:
            assessments[y.year].incompatible = True
            assessments[y.year].reason = f"Bahçenin yalnızca %{coverage * 100:.0f}'inde net görüntü var"
            continue
        normalized[y.year] = rank_normalize(y.values, garden_mask)

    def corr_with_rest(year: int, pool: list[int]) -> float | None:
        others = [normalized[o] for o in pool if o != year]
        if not others:
            return None
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", RuntimeWarning)  # hiç geçerli yılı olmayan pikseller NaN kalır
            mean_of_others = np.nanmean(np.stack(others), axis=0)
        return _pearson(normalized[year], mean_of_others)

    kept = sorted(normalized)
    while flag_incompatible and len(kept) >= 3:
        corrs = {y: corr_with_rest(y, kept) for y in kept}
        scored = {y: c for y, c in corrs.items() if c is not None}
        if not scored:
            break
        worst = min(scored, key=lambda y: scored[y])
        if scored[worst] >= cfg.year_min_correlation:
            break
        assessments[worst].incompatible = True
        assessments[worst].reason = "Diğer yıllarla desen uyumsuz (sel, budama, söküm gibi bir olay olabilir)"
        kept.remove(worst)
    for year_key in normalized:
        assessments[year_key].correlation = None if (c := corr_with_rest(year_key, kept)) is None else round(c, 3)
    return [assessments[y.year] for y in years], normalized


def _has_spatial_structure(years: list[YearMap], garden_mask: np.ndarray, cfg: ZoningConfig) -> bool:
    """Yıllar ortalamasında bahçe içi yayılım (P90–P10, ortalamaya göre %) homojenlik eşiğinin üstünde mi."""
    total = max(1, int(garden_mask.sum()))
    usable = [y.values for y in years if (garden_mask & np.isfinite(y.values)).sum() / total >= cfg.min_year_coverage]
    if not usable:
        return False
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        mean_map = np.nanmean(np.stack(usable), axis=0)
    vals = mean_map[garden_mask & np.isfinite(mean_map)]
    if vals.size < 10 or float(vals.mean()) == 0.0:
        return False
    spread = (np.percentile(vals, 90) - np.percentile(vals, 10)) / abs(float(vals.mean())) * 100.0
    return bool(spread >= cfg.homogeneous_diff_percent)


# ----------------------------------------------------------------------------- bölgeleme
def compute_zones(
    years: list[YearMap],
    garden_mask: np.ndarray,
    k: int,
    cfg: ZoningConfig,
    include: dict[int, bool] | None = None,
) -> ZoningResult:
    """`include`: kullanıcı geçersiz kılması (yıl → dahil mi); verilmeyen yıllar için otomatik karar (uyumsuz değilse dahil)."""
    # Bahçede belirgin mekânsal desen yoksa (homojen) yıllar arası korelasyon anlamsızdır (gürültü gürültüyle ilişkisizdir): uyumsuz işaretlenmez
    flag = _has_spatial_structure(years, garden_mask, cfg)
    assessments, normalized = assess_years(years, garden_mask, cfg, flag_incompatible=flag)
    used: list[int] = []
    for a in assessments:
        wanted = include[a.year] if include is not None and a.year in include else not a.incompatible
        if wanted and a.year in normalized:
            used.append(a.year)
    if len(used) < cfg.min_years:
        return ZoningResult(
            "insufficient", f"Bölgeleme için en az {cfg.min_years} yıl gerekir; kullanılabilir yıl: {len(used)}.", k, used, assessments
        )

    stack = np.stack([normalized[y] for y in used])
    counts = np.isfinite(stack).sum(axis=0)
    need = max(1, int(np.ceil(cfg.min_pixel_year_share * len(used))))
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        potential = np.where(counts >= need, np.nanmean(stack, axis=0), np.nan)
    potential = gaussian_nan(np.where(garden_mask, potential, np.nan), cfg.smoothing_sigma_px)
    valid = garden_mask & np.isfinite(potential)
    if valid.sum() < max(10, k * 3):
        return ZoningResult("insufficient", "Bahçede bölgeleme için yeterli geçerli piksel yok.", k, used, assessments)

    centers = kmeans_1d(potential[valid].astype(np.float64), k)
    labels = classify(np.where(valid, potential, np.nan), centers)
    labels = merge_small_parts(labels, k, max(1, int(round(cfg.min_zone_area_m2 / cfg.pixel_area_m2))))

    # İstikrar: her yılın (aynı yumuşatmayla) sınıfı, nihai sınıfla kaç yılda aynı
    agree = np.zeros(labels.shape, dtype=np.float32)
    seen = np.zeros(labels.shape, dtype=np.float32)
    for y in used:
        yearly = classify(gaussian_nan(normalized[y], cfg.smoothing_sigma_px), centers)
        ok = (yearly > 0) & (labels > 0)
        agree += np.where(ok & (yearly == labels), 1.0, 0.0)
        seen += ok.astype(np.float32)
    with np.errstate(invalid="ignore", divide="ignore"):
        stability = np.where(seen > 0, agree / seen, np.nan).astype(np.float32)
    stab_cls = np.zeros(labels.shape, dtype=np.int8)
    ok = np.isfinite(stability) & (labels > 0)
    stab_cls[ok] = np.where(stability[ok] >= cfg.stability_high, 3, np.where(stability[ok] >= cfg.stability_mid, 2, 1))

    # Ham NDVI ortalaması (dahil yıllar) → bölge farkları ve homojenlik
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        raw = np.nanmean(np.stack([next(y.values for y in years if y.year == yr) for yr in used]), axis=0)
    inside = labels > 0
    garden_mean = float(np.nanmean(raw[inside])) if inside.any() else float("nan")
    total_px = int(inside.sum())
    zones: list[ZoneStat] = []
    for cls in range(1, k + 1):
        part = labels == cls
        n = int(part.sum())
        if n == 0:
            continue
        mean_raw = float(np.nanmean(raw[part]))
        stab_vals = stability[part & np.isfinite(stability)]
        zones.append(
            ZoneStat(
                cls=cls,
                area_m2=n * cfg.pixel_area_m2,
                share=n / total_px,
                mean_raw=mean_raw,
                diff_percent=(mean_raw / garden_mean - 1.0) * 100.0 if garden_mean else 0.0,
                stability_mean=float(stab_vals.mean()) if stab_vals.size else 0.0,
            )
        )
    spread = (max(z.mean_raw for z in zones) - min(z.mean_raw for z in zones)) / garden_mean * 100.0 if zones and garden_mean else 0.0
    return ZoningResult(
        status="ok",
        message=None,
        k=k,
        years_used=used,
        assessments=assessments,
        labels=labels,
        stability=stability,
        stability_class=stab_cls,
        potential=potential,
        zones=zones,
        homogeneous=spread < cfg.homogeneous_diff_percent,
        spread_percent=round(spread, 2),
        garden_mean=garden_mean,
    )
