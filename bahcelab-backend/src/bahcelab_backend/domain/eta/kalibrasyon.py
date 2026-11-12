"""Uzun dönem c-faktörü ve çok sahneli TUTARLILIK kapısı (saf; birim testli). ADR 0028.

c-faktörü: her sahnenin soğuk referansından c_i = Tc_i / Ta_düz,i; aynı mevsimde (± ay) en az `c_min_sahne` sahnenin MEDYANI uzun dönem c'dir,
yayılım = MAD×1,4826 (belirsizliğe girer). Böylece Tc = c·Ta sahne içi referansa bağımlı kalmaz (Dilim 0 bulgusu: sahne içi Tc ETf'yi ±0,2–0,5 oynatıyordu).

Tutarlılık: kuru mevsimde (yağışsız), ≤ N gün arayla ARDIŞIK temiz geçişlerde |ΔETf|; metrik p90. p90 ≤ eşik değilse kapı KAPALI (kullanıcıya açılmaz).
"""

from __future__ import annotations

import statistics
from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class CSonuc:
    deger: float
    yayilim: float
    n: int


def _mad(v: list[float], med: float) -> float:
    return 1.4826 * statistics.median(abs(x - med) for x in v)


def uzun_donem_c(c_sahne: dict[date, float], ay: int, pencere_ay: int, min_sahne: int) -> CSonuc | None:
    """`ay` ± `pencere_ay` içindeki sahnelerin c medyanı; yeterli sahne yoksa None (varsayılan c UYDURULMAZ)."""
    uygun = [c for t, c in c_sahne.items() if min(abs(t.month - ay), 12 - abs(t.month - ay)) <= pencere_ay]
    if len(uygun) < min_sahne:
        return None
    med = statistics.median(uygun)
    return CSonuc(med, _mad(uygun, med), len(uygun))


@dataclass(frozen=True)
class Tutarlilik:
    cift: int
    p90: float | None
    medyan: float | None
    kapi_acik: bool
    neden: str


def tutarlilik(etf: dict[date, float], yagis_mm: dict[date, float], *, esik: float, max_gun: int, min_cift: int, yagis_esik_mm: float, aylar: list[int]) -> Tutarlilik:
    """Kuru mevsim ardışık çiftleri: iki geçiş de `aylar` içinde, aralık ≤ max_gun, aralıkta (iki uç hariç/dahil) toplam yağış < yagis_esik_mm."""
    gunler = sorted(etf)
    farklar: list[float] = []
    for a, b in zip(gunler, gunler[1:], strict=False):
        if (b - a).days > max_gun or a.month not in aylar or b.month not in aylar:
            continue
        yag = sum(v for t, v in yagis_mm.items() if a <= t <= b)
        if yag >= yagis_esik_mm:
            continue
        farklar.append(abs(etf[b] - etf[a]))
    if len(farklar) < min_cift:
        return Tutarlilik(len(farklar), None, None, False, f"yetersiz çift: {len(farklar)} < {min_cift} (kuru mevsim, ≤ {max_gun} gün arayla, yağışsız)")
    s = sorted(farklar)
    p90 = s[min(len(s) - 1, int(0.9 * len(s) + 0.9999) - 1)]
    med = statistics.median(s)
    ok = p90 <= esik
    return Tutarlilik(len(farklar), p90, med, ok, f"p90 |ΔETf| = {p90:.3f} {'≤' if ok else '>'} eşik {esik} ({len(farklar)} çift)")
