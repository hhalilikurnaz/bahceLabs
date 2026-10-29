"""Saha Defteri kuralları (SAF, veritabanı yok): doğruluk özeti, en yakın komşu sıralama, stres yaması."""

from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any, Literal

import numpy as np
from scipy.ndimage import label

Sonuc = Literal["gerceklesti", "gerceklesmedi", "bilinmiyor"]
TUR_GRUPLARI = ("don", "yagis", "ruzgar", "optik", "radar", "uyari")
TUR_ADLARI = {"don": "Don", "yagis": "Aşırı yağış", "ruzgar": "Rüzgâr", "optik": "Optik düşüş", "radar": "Radar değişimi", "uyari": "Uyarılar"}


def tur_grubu(tur: str, turler: Sequence[str]) -> str:
    """Olay → doğruluk grubu. Birleşen olay (don + optik hasar izi) «don» sayılır: hem hava hem uydu aynı olay için tek yargı alır."""
    if tur == "don":
        return "don"
    return {"asiri_yagis": "yagis", "ruzgar": "ruzgar", "s2_dusus": "optik", "radar_degisim": "radar"}.get(tur, "optik" if "s2_dusus" in turler else "uyari")


@dataclass(frozen=True)
class TurOzeti:
    tur: str
    ad: str
    gerceklesti: int
    gerceklesmedi: int
    bilinmiyor: int
    bekleyen: int  # henüz yanıtlanmamış kayıt sayısı
    dogrulanan: int  # gerçekleşti + gerçekleşmedi (bilinmiyor yargı sayılmaz)
    yeterli: bool
    metin: str


def accuracy(rows: Sequence[tuple[str, str | None]], min_n: int) -> list[TurOzeti]:
    """`rows` = (tür grubu, sonuç ya da None = yanıtsız). Yeterli doğrulama (≥ min_n) yoksa sayılar yorumlanmaz: «henüz yeterli doğrulama yok»."""
    out: list[TurOzeti] = []
    for tur in TUR_GRUPLARI:
        mine = [s for t, s in rows if t == tur]
        if not mine:
            continue
        g, gm, bn = (sum(1 for s in mine if s == k) for k in ("gerceklesti", "gerceklesmedi", "bilinmiyor"))
        pending = sum(1 for s in mine if s is None)
        checked = g + gm
        enough = checked >= min_n
        text = f"{checked} doğrulama: {g} gerçekleşti, {gm} yanlış alarm" if enough else f"henüz yeterli doğrulama yok ({checked}/{min_n})"
        out.append(TurOzeti(tur, TUR_ADLARI[tur], g, gm, bn, pending, checked, enough, text))
    return out


def haversine_m(a: tuple[float, float], b: tuple[float, float]) -> float:
    """(boylam, enlem) çifti arası büyük daire mesafesi (m)."""
    (lng1, lat1), (lng2, lat2) = a, b
    p1, p2 = math.radians(lat1), math.radians(lat2)
    h = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lng2 - lng1) / 2) ** 2
    return 2 * 6_371_000 * math.asin(math.sqrt(h))


def nearest_neighbour(points: Sequence[tuple[float, float]], start: tuple[float, float]) -> list[int]:
    """Başlangıç noktasına en yakın noktadan başlayıp her adımda en yakın ziyaret edilmemişe giden sıra (indeks listesi). Eşitlikte düşük indeks."""
    remaining = list(range(len(points)))
    order: list[int] = []
    here = start
    while remaining:
        nxt = min(remaining, key=lambda i: (haversine_m(here, points[i]), i))
        order.append(nxt)
        remaining.remove(nxt)
        here = points[nxt]
    return order


def legs(points: Sequence[tuple[float, float]], order: Sequence[int], start: tuple[float, float]) -> list[float]:
    """Sıradaki her noktaya, bir öncekinden (ilk için başlangıçtan) mesafe (m)."""
    out: list[float] = []
    here = start
    for i in order:
        out.append(haversine_m(here, points[i]))
        here = points[i]
    return out


def tour_minutes(total_m: float, stops: int, speed_m_min: float, per_stop_min: float) -> int:
    return round(total_m / speed_m_min + stops * per_stop_min)


@dataclass(frozen=True)
class Patch:
    row: float  # ağırlık merkezi (piksel satırı, ondalıklı)
    col: float
    area_da: float


def stress_patch(values: np.ndarray, percentile: float, min_da: float, pixel_m2: float = 100.0, min_share: float = 0.5) -> Patch | None:
    """Bahçenin KENDİ dağılımının alt yüzdeliğinin altındaki en büyük bitişik (8-komşu) yama. Yama gerçek bir KÜME olmalı: alt yüzdelikteki piksellerin en az
    `min_share` kadarını içermeli (dağınık benekler yama değildir) ve ≥ min_da olmalı; değilse None. NaN = bahçe dışı/geçersiz."""
    valid = np.isfinite(values)
    if int(valid.sum()) < 20:
        return None
    threshold = float(np.percentile(values[valid], percentile))
    low = valid & (values <= threshold)
    labels, count = label(low, structure=np.ones((3, 3), dtype=int))
    if not count:
        return None
    sizes = np.bincount(labels.ravel())[1:]
    best = int(np.argmax(sizes)) + 1
    area_da = float(sizes[best - 1]) * pixel_m2 / 1000.0
    if area_da < min_da or float(sizes[best - 1]) < min_share * float(sizes.sum()):
        return None
    rows, cols = np.nonzero(labels == best)
    return Patch(float(rows.mean()), float(cols.mean()), area_da)


def external_support(rows: Sequence[tuple[str, str | None]]) -> dict[str, dict[str, Any]]:
    """`rows` = (tür grubu, ön yargı sonucu). Çiftçi doğrulamasından AYRI ikinci sayı: bağımsız kaynakların desteği. Kanıtsız olay «destekleniyor» sayılmaz."""
    out: dict[str, dict[str, Any]] = {}
    for tur in TUR_GRUPLARI:
        mine = [s for t, s in rows if t == tur and s is not None]
        if not mine:
            continue
        d, c, b, k = (sum(1 for s in mine if s == key) for key in ("destekleniyor", "celisiyor", "belirsiz", "kanit_yok"))
        out[tur] = {"dis_destekleniyor": d, "dis_celisiyor": c, "dis_belirsiz": b, "dis_kanit_yok": k, "dis_metin": f"dış kaynak: {d} destekleniyor, {c} çelişiyor, {b} belirsiz, {k} kanıt yok"}
    return out
