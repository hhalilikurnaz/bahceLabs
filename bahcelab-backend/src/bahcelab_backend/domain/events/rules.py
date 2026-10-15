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

FORMULA_VERSION = "olay-v2"
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
    durum: Literal["olay", "bekliyor", "suphe"] = "olay"  # bekliyor: en son sahnedeki düşüş, sonraki net görüntü doğrulayacak · suphe: atmosfer şüphesi — olay DEĞİLDİR (bildirim ve birleştirme dışı)


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
    durum: Literal["olay", "bekliyor", "suphe"] = "olay"

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
def smooth_valid(grid: np.ndarray, window: int) -> np.ndarray:
    """Geçerli komşu ortalamasıyla yumuşatma (NaN sayılmaz, NaN kalır)."""
    if window <= 1:
        return grid
    valid = np.isfinite(grid)
    total = uniform_filter(np.where(valid, grid, 0.0), size=window, mode="nearest")
    count = uniform_filter(valid.astype(np.float64), size=window, mode="nearest")
    with np.errstate(divide="ignore", invalid="ignore"):
        return np.where(valid & (count > 0), total / count, np.nan)


def circular_doy_gap(a: date, b: date) -> int:
    d = abs(a.timetuple().tm_yday - b.timetuple().tm_yday)
    return min(d, 366 - d)


def period_percentile(history: list[np.ndarray], rule: OlayKurali) -> np.ndarray:
    """Pikselin DİĞER yılların aynı dönemindeki (±pencere) kendi dağılımının alt yüzdeliği (varsayılan p10). Örnek sayısı yetersiz piksel NaN (değerlendirilmez)."""
    if not history:
        return np.full((1, 1), np.nan)
    stack = np.stack(history)
    count = np.isfinite(stack).sum(axis=0)
    with np.errstate(all="ignore"):
        q = np.nanpercentile(stack, rule.s2_normal_alt_yuzde, axis=0)
    return np.where(count >= rule.s2_min_ornek, q, np.nan)


def s2_patch(previous: np.ndarray, current: np.ndarray, floor: np.ndarray, rule: OlayKurali) -> tuple[float, float, np.ndarray, float] | None:
    """NDVI ızgaraları (yumuşatılmış, bahçe dışı NaN). Düşüş pikseli = Δ ≤ −eşik VE değer pikselin dönem p10'unun (`floor`) altında.
    Dönüş: (alan da, medyan Δ, yama maskesi, düşen piksel payı); EN BÜYÜK bitişik (8-komşuluk) yama ≥ min(pay × bahçe, alan_min_da) değilse None."""
    delta = current - previous
    valid = np.isfinite(current)
    n = int(valid.sum())
    if n == 0:
        return None
    drop = np.isfinite(delta) & (delta <= -rule.s2_ndvi_dusus) & np.isfinite(floor) & (current < floor)
    labels, count_labels = label(drop, structure=np.ones((3, 3), dtype=int))
    if not count_labels:
        return None
    sizes = np.bincount(labels.ravel())[1:]
    biggest = int(sizes.max())
    need = max(1.0, min(rule.s2_alan_orani * n, rule.s2_alan_min_da * DA_M2 / PIXEL_M2))
    if biggest < need:
        return None
    patch = labels == (int(np.argmax(sizes)) + 1)
    return biggest * PIXEL_M2 / DA_M2, float(np.median(delta[patch])), patch, float(drop.sum()) / n


def s2_persists(following: np.ndarray, floor: np.ndarray, patch: np.ndarray, rule: OlayKurali) -> bool:
    """Kalıcılık: sonraki net görüntüde yama piksellerinin en az `s2_kalicilik_orani` kadarı hâlâ dönem p10'unun altında mı? Tek görüntülük düşüş atmosfer şüphesidir."""
    known = patch & np.isfinite(following) & np.isfinite(floor)
    if int(known.sum()) == 0:
        return False
    return float((following[known] < floor[known]).sum()) / float(patch.sum()) >= rule.s2_kalicilik_orani


def frost_precedes(frost: Signal, s2: Signal, rule: OlayKurali) -> bool:
    """Asimetrik hasar penceresi: S2 düşüşünün BAŞLAYABİLECEĞİ aralık [önceki görüntü + 1 gün, düşüşü gören görüntü] don bitişinden sonraki 0..+`don_hasar_gun` pencere ile kesişiyor mu?"""
    return s2.bitis >= frost.bitis and s2.baslangic <= frost.bitis + timedelta(days=rule.don_hasar_gun)


def classify_s2(candidate: Signal, persists: bool | None, drop_share: float, others: list[Signal], rule: OlayKurali, today: date | None = None) -> Signal:
    """Aday S2 düşüşünü olay, «doğrulama bekliyor» ya da atmosfer şüphesi yapar (sıra önemlidir):
    1. sonraki net görüntüde toparlandıysa (persists=False) → şüphe (toparlandi);
    2. bahçenin > %90'ı düşüyorsa hava/radar ±destek gün içinde ya da önceki `don_hasar_gun` günde don yoksa → şüphe (tum_bahce_destek_yok);
    3. sonraki net görüntü yoksa (None): düşüşü gören görüntü son `s2_azami_aralik_gun` içindeyse → **bekliyor** (şüphe değil; sonraki görüntü doğrularsa olaya yükselir), daha eskiyse → şüphe (teyit_edilemedi);
    4. aksi → olay."""
    detail: dict[str, float | str | None] = {**candidate.ayrinti, "dusen_pay": round(drop_share, 3), "kalici": None if persists is None else str(persists)}

    def make(durum: Literal["olay", "bekliyor", "suphe"], reason: str | None = None) -> Signal:
        extra = {**detail, "neden": reason} if reason else detail
        return Signal("s2_dusus", candidate.baslangic, candidate.bitis, candidate.guven, candidate.alan_da, None, candidate.kaynaklar, extra, durum=durum)

    if persists is False:
        return make("suphe", "toparlandi")
    if drop_share > rule.s2_tum_bahce_orani:
        window = timedelta(days=rule.s2_destek_gun)
        supported = any(
            (o.tur == "don" and frost_precedes(o, candidate, rule)) or (o.tur != "s2_dusus" and o.baslangic - window <= candidate.bitis and o.bitis + window >= candidate.baslangic) for o in others
        )
        if not supported:
            return make("suphe", "tum_bahce_destek_yok")
    if persists is None:
        recent = today is not None and (today - candidate.bitis).days <= rule.s2_azami_aralik_gun
        return make("bekliyor") if recent else make("suphe", "teyit_edilemedi")
    return make("olay")


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
        for k, v in s.ayrinti.items():
            key = f"{s.tur}.{k}"
            old = detail.get(key)
            if isinstance(old, (int, float)) and isinstance(v, (int, float)):
                detail[key] = min(old, v) if k.startswith("en_dusuk") else max(old, v)  # birleşen aynı türde en uç değer (en düşük sıcaklık / en yüksek yağış, hamle) kalır
            else:
                detail[key] = v
    return Event(
        main, tuple(kinds), min(s.baslangic for s in group), max(s.bitis for s in group), max(areas) if areas else None, confidence(group, rule),
        "siddetli" if "siddetli" in severities else ("normal" if severities else None), layer, tuple(r for s in group for r in s.kaynaklar), detail,
    )


def suspect_event(s: Signal) -> Event:
    """Atmosfer şüphesi: kendi kaydıdır, birleşmez, güveni düşüktür; olay listelerine ve bildirime girmez."""
    return Event("s2_suphe", ("s2_dusus",), s.baslangic, s.bitis, s.alan_da, "dusuk", None, "degisim", s.kaynaklar, {f"s2_dusus.{k}": v for k, v in s.ayrinti.items()}, "suphe")


def _can_join(group: list[Signal], s: Signal, rule: OlayKurali) -> bool:
    last_end = max(x.bitis for x in group)
    first_start = min(x.baslangic for x in group)
    gap = max((s.baslangic - last_end).days, (first_start - s.bitis).days)  # aralıklar arası boşluk (çakışma ≤ 0)
    return gap <= rule.birlestirme_gun and (max(s.bitis, last_end) - min(s.baslangic, first_start)).days <= rule.birlestirme_azami_sure_gun


def merge_optical(groups: list[list[Signal]], s2_signals: list[Signal], rule: OlayKurali) -> list[list[Signal]]:
    """S2 düşüşlerini hava/radar gruplarına bağlar (iki aşama: önce hava+radar kendi içinde kümelenir, sonra her S2 düşüşü yerleştirilir).

    Don → S2 bağlama (ASİMETRİK pencere, `don_hasar_gun`): düşüş, başlayabileceği aralık donun bitişinden sonraki 0..+N günle kesişen EN YAKIN dona bağlanır (don + optik hasar izi; kaynak ailesi sayısı arttığı için güven yüksek).
    Don yoksa standart kural: ±`birlestirme_gun` içindeki gruba (en çok `birlestirme_azami_sure_gun` yayılımla) katılır; hiçbirine uymazsa kendi olayı olur."""
    out = [list(g) for g in groups]
    for s in sorted(s2_signals, key=lambda x: (x.baslangic, x.bitis)):
        frost_hosts = [g for g in out if any(f.tur == "don" and frost_precedes(f, s, rule) for f in g)]
        if frost_hosts:
            max(frost_hosts, key=lambda g: max(f.bitis for f in g if f.tur == "don")).append(s)
            continue
        host = next((g for g in out if _can_join(g, s, rule)), None)
        if host is not None:
            host.append(s)
        else:
            out.append([s])
    return out


def pending_event(s: Signal) -> Event:
    """Doğrulama bekleyen S2 düşüşü: kendi kaydıdır (birleşmez), güveni orta (önemli düzeyde bildirim); sonraki net görüntü doğrularsa olaya yükselir."""
    return Event("s2_dusus", ("s2_dusus",), s.baslangic, s.bitis, s.alan_da, "orta", None, "degisim", s.kaynaklar, {f"s2_dusus.{k}": v for k, v in s.ayrinti.items()}, "bekliyor")


def build_events(signals: list[Signal], rule: OlayKurali) -> list[Event]:
    real = [s for s in signals if s.durum == "olay"]
    groups = merge_optical(cluster([s for s in real if s.tur != "s2_dusus"], rule), [s for s in real if s.tur == "s2_dusus"], rule)
    return [*(to_event(g, rule) for g in groups), *(pending_event(s) for s in signals if s.durum == "bekliyor"), *(suspect_event(s) for s in signals if s.durum == "suphe")]


def is_forecast(event: Event, today: date) -> bool:
    return event.bitis > today


def day_range(start: date, end: date) -> list[date]:
    return [start + timedelta(days=i) for i in range((end - start).days + 1)]
