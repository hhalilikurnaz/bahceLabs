"""Basit kayan pencere hız sınırı (süreç içi, bağımlılıksız).

Çok işçili dağıtımda her süreç kendi sayacını tutar: gerçek sınır işçi sayısıyla çarpılır. Bu, herkese açık tek bir form uç noktası için
kötüye kullanımı (otomatik doldurma) yavaşlatmak içindir; kimlik doğrulama koruması değildir.
"""

import math
import time
from collections import deque
from collections.abc import Callable

_MAKS_ANAHTAR = 10_000  # bellek tavanı: aşılınca süresi dolanlar atılır, hâlâ aşılıyorsa en eski anahtarlar düşer


class SlidingWindowLimiter:
    def __init__(self, limit: int, window_s: float, now: Callable[[], float] = time.monotonic) -> None:
        self.limit = limit
        self.window_s = window_s
        self._now = now
        self._hits: dict[str, deque[float]] = {}

    def allow(self, key: str) -> bool:
        """İstek sınır içindeyse True ve sayaca yazar; sınır aşıldıysa False (sayaç artmaz)."""
        now = self._now()
        hits = self._hits.setdefault(key, deque())
        while hits and now - hits[0] >= self.window_s:
            hits.popleft()
        if len(hits) >= self.limit:
            return False
        hits.append(now)
        if len(self._hits) > _MAKS_ANAHTAR:
            self._temizle(now)
        return True

    def retry_after(self, key: str) -> int:
        """Sınır doluysa en eski isteğin pencereden çıkmasına kalan tam saniye (en az 1)."""
        hits = self._hits.get(key)
        if not hits or len(hits) < self.limit:
            return 0
        return max(1, math.ceil(self.window_s - (self._now() - hits[0])))

    def reset(self) -> None:
        self._hits.clear()

    def _temizle(self, now: float) -> None:
        for key in [k for k, h in self._hits.items() if not h or now - h[-1] >= self.window_s]:
            del self._hits[key]
        while len(self._hits) > _MAKS_ANAHTAR:
            del self._hits[next(iter(self._hits))]
