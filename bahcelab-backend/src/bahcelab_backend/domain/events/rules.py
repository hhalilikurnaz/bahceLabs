"""Olay motoru kuralları (SAF, ADR 0018): kaynak sinyalleri → birleştirme → güven.

Sinyal kaynakları: S2 ani düşüş (bitişik yama), radar (yalnız güven=yüksek aday), don, aşırı yağış, kuvvetli rüzgâr (hava saatlik verisinden).
Birleştirme: aynı bahçede ±N gün içindeki sinyaller TEK olay olur (en çok M gün yayılır). Güven: kaynak ailesi başına en iyi sinyalin puanı toplanır.
Eşikler katalogda (`olay`, ön değer · mühendis onayı bekliyor); bu modülde sabit eşik yoktur.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Literal

import numpy as np
from scipy.ndimage import label, uniform_filter

from bahcelab_backend.domain.agro.catalog import OlayKurali

FORMULA_VERSION = "olay-v1"
Tur = Literal["don", "asiri_yagis", "ruzgar", "s2_dusus", "radar_degisim"]
PRIORITY: tuple[str, ...] = ("don", "asiri_yagis", "ruzgar", "s2_dusus", "radar_degisim")  # birleşik olayda baskın tür
FAMILY: dict[str, str] = {"don": "hava", "asiri_yagis": "hava", "ruzgar": "hava", "s2_dusus": "s2", "radar_degisim": "radar"}
LAYER: dict[str, str | None] = {"s2_dusus": "degisim", "radar_degisim": "radarDegisim", "don": None, "asiri_yagis": None, "ruzgar": None}
PIXEL_M2 = 100.0  # 10 m piksel
DA_M2 = 1000.0


@dataclass(frozen=True)
class SourceRef:
    tablo: str  # change_events | acquisitions | era5_daily
    kimlik: str
    rol: str
    tarih: date


@dataclass(frozen=True)
class Signal:
    tur: str
    baslangic: date
    bitis: date
    guven: Literal["orta", "dusuk"]  # sinyalin kendi güveni
    alan_da: float | None = None  # YALNIZ motorun ölçtüğü alan (S2)
    siddet: str | None = None
    kaynaklar: tuple[SourceRef, ...] = ()
    ayrinti: dict[str, float | str | None] = field(default_factory=dict)


@dataclass(frozen=True)
class Event:
    tur: str
    turler: tuple[str, ...]
    baslangic: date
    bitis: date
    alan_da: float | None
    guven: Literal["dusuk", "orta", "yuksek"]
    siddet: str | None
    katman: str | None
    kaynaklar: tuple[SourceRef, ...]
    ayrinti: dict[str, float | str | None]

    @property
    def anahtar(self) -> str:
        return f"{self.tur}:{self.baslangic.isoformat()}"


@dataclass(frozen=True)
class HourDay:
    """Bir günün saatlik hava dizileri (yerel gün; eksik saat None). `model`: değerler tahmin modelinden (ERA5 değil)."""

    tarih: date
    t2m: list[float | None]
    yagis: list[float | None]
    hamle: list[float | None]
    model: bool
    kimlik: str  # era5_daily bileşik anahtarı «hücre:tarih»


# ----------------------------------------------------------------------------- hava sinyalleri
def _episodes(days: list[date]) -> list[list[date]]:
    """Ardışık günleri (en çok 1 gün boşluk) bölümlere ayırır."""
    out: list[list[date]] = []
    for day in sorted(days):
        if out and (day - out[-1][-1]).days <= 1:
            out[-1].append(day)
        else:
            out.append([day])
    return out


def frost_signals(days: list[HourDay], rule: OlayKurali) -> list[Signal]:
    hit: dict[date, tuple[float, HourDay]] = {}
    for d in days:
        known = [v for v in d.t2m if v is not None]
        if known and min(known) <= rule.don_c:
            hit[d.tarih] = (min(known), d)
    out: list[Signal] = []
    for ep in _episodes(list(hit)):
        coldest = min(hit[x][0] for x in ep)
        out.append(
            Signal(
                "don", ep[0], ep[-1], "orta", siddet="siddetli" if coldest <= rule.don_siddetli_c else "normal",
                kaynaklar=tuple(SourceRef("era5_daily", hit[x][1].kimlik, "don", x) for x in ep), ayrinti={"en_dusuk_c": round(coldest, 1)},
            )
        )
    return out


def rain_signals(days: list[HourDay], rule: OlayKurali) -> list[Signal]:
    """Art arda gelen günlerin saatlik yağışından yuvarlanan 24 saatlik toplam ≥ eşik → olay (kesintisiz gün dizileri üzerinde)."""
    ordered = sorted(days, key=lambda d: d.tarih)
    hit: dict[date, tuple[float, HourDay]] = {}
    for run in _runs(ordered):
        flat = [v for d in run for v in d.yagis]
        if len(flat) < 24:
            continue
        arr = np.array([0.0 if v is None else v for v in flat])
        window = np.convolve(arr, np.ones(24), mode="valid")
        for i in np.flatnonzero(window >= rule.yagis_24s_mm):
            end_day = run[min(len(run) - 1, (int(i) + 23) // 24)]
            prev = hit.get(end_day.tarih)
            if prev is None or window[i] > prev[0]:
                hit[end_day.tarih] = (float(window[i]), end_day)
    return [
        Signal(
            "asiri_yagis", ep[0], ep[-1], "orta", kaynaklar=tuple(SourceRef("era5_daily", hit[x][1].kimlik, "asiri_yagis", x) for x in ep),
            ayrinti={"en_yuksek_24s_mm": round(max(hit[x][0] for x in ep), 1)},
        )
        for ep in _episodes(list(hit))
    ]


def _runs(ordered: list[HourDay]) -> list[list[HourDay]]:
    out: list[list[HourDay]] = []
    for d in ordered:
        if out and (d.tarih - out[-1][-1].tarih).days == 1:
            out[-1].append(d)
        else:
            out.append([d])
    return out


def wind_signals(days: list[HourDay], rule: OlayKurali) -> list[Signal]:
    """Hamle ≥ eşik. Geçmiş (ERA5, 31 km: hamleyi düşük gösterir) güven=düşük; tahmin modeli verisi güven=orta."""
    hit: dict[date, tuple[float, HourDay]] = {}
    for d in days:
        known = [v for v in d.hamle if v is not None]
        if known and max(known) >= rule.hamle_kmh:
            hit[d.tarih] = (max(known), d)
    return [
        Signal(
            "ruzgar", ep[0], ep[-1], "orta" if all(hit[x][1].model for x in ep) else "dusuk",
            kaynaklar=tuple(SourceRef("era5_daily", hit[x][1].kimlik, "ruzgar", x) for x in ep), ayrinti={"en_yuksek_hamle_kmh": round(max(hit[x][0] for x in ep), 1)},
        )
        for ep in _episodes(list(hit))
    ]


# ----------------------------------------------------------------------------- S2 ani düşüş
def s2_patch(previous: np.ndarray, current: np.ndarray, rule: OlayKurali) -> tuple[float, float, int] | None:
    """NDVI ızgaraları (bahçe dışı NaN): (alan da, medyan Δ, piksel). Δ ≤ −eşik piksellerinin EN BÜYÜK bitişik (8-komşuluk) yaması ≥ min(pay × bahçe, alan_min_da); yoksa None."""
    delta = current - previous
    valid = np.isfinite(delta)
    n = int(valid.sum())
    if n == 0:
        return None
    if rule.s2_yumusatma > 1:
        total = uniform_filter(np.where(valid, delta, 0.0), size=rule.s2_yumusatma, mode="nearest")
        count = uniform_filter(valid.astype(np.float64), size=rule.s2_yumusatma, mode="nearest")
        with np.errstate(divide="ignore", invalid="ignore"):
            delta = np.where(valid & (count > 0), total / count, np.nan)
    drop = np.isfinite(delta) & (delta <= -rule.s2_ndvi_dusus)
    labels, count_labels = label(drop, structure=np.ones((3, 3), dtype=int))
    if not count_labels:
        return None
    sizes = np.bincount(labels.ravel())[1:]
    biggest = int(sizes.max())
    need = max(1.0, min(rule.s2_alan_orani * n, rule.s2_alan_min_da * DA_M2 / PIXEL_M2))
    if biggest < need:
        return None
    patch = labels == (int(np.argmax(sizes)) + 1)
    return biggest * PIXEL_M2 / DA_M2, float(np.median(delta[patch])), biggest


# ----------------------------------------------------------------------------- birleştirme ve güven
def cluster(signals: list[Signal], rule: OlayKurali) -> list[list[Signal]]:
    """Sinyalleri tarihe göre sıralar; komşu sinyaller arası ≤ `birlestirme_gun` ise aynı olaya koyar, olay `birlestirme_azami_sure_gun`'den fazla yayılmaz."""
    ordered = sorted(signals, key=lambda s: (s.baslangic, s.bitis))
    groups: list[list[Signal]] = []
    for s in ordered:
        if groups:
            current = groups[-1]
            last_end = max(x.bitis for x in current)
            first_start = min(x.baslangic for x in current)
            if (s.baslangic - last_end).days <= rule.birlestirme_gun and (max(s.bitis, last_end) - first_start).days <= rule.birlestirme_azami_sure_gun:
                current.append(s)
                continue
        groups.append([s])
    return groups


def confidence(signals: list[Signal], rule: OlayKurali) -> Literal["dusuk", "orta", "yuksek"]:
    """Kaynak ailesi başına en iyi sinyal (orta = `guven_orta_puan`, düşük = 1) toplanır; toplam ≥ yüksek eşik → yüksek, ≥ orta eşik → orta, aksi düşük."""
    best: dict[str, int] = {}
    for s in signals:
        points = rule.guven_orta_puan if s.guven == "orta" else 1
        fam = FAMILY[s.tur]
        best[fam] = max(best.get(fam, 0), points)
    total = sum(best.values())
    return "yuksek" if total >= rule.guven_yuksek_min else "orta" if total >= rule.guven_orta_min else "dusuk"


def to_event(group: list[Signal], rule: OlayKurali) -> Event:
    kinds = sorted({s.tur for s in group}, key=PRIORITY.index)
    main = kinds[0]
    areas = [s.alan_da for s in group if s.alan_da is not None]
    severities = [s.siddet for s in group if s.siddet]
    layer = "degisim" if "s2_dusus" in kinds else LAYER[main]
    detail: dict[str, float | str | None] = {}
    for s in group:
        detail.update({f"{s.tur}.{k}": v for k, v in s.ayrinti.items()})
    return Event(
        main, tuple(kinds), min(s.baslangic for s in group), max(s.bitis for s in group), max(areas) if areas else None, confidence(group, rule),
        "siddetli" if "siddetli" in severities else ("normal" if severities else None), layer, tuple(r for s in group for r in s.kaynaklar), detail,
    )


def build_events(signals: list[Signal], rule: OlayKurali) -> list[Event]:
    return [to_event(g, rule) for g in cluster(signals, rule)]


def is_forecast(event: Event, today: date) -> bool:
    return event.bitis > today


def day_range(start: date, end: date) -> list[date]:
    return [start + timedelta(days=i) for i in range((end - start).days + 1)]
