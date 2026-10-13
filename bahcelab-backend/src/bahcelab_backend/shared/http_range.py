"""Uzak dosyadan yalnız gereken bölümleri okuyan (HTTP Range) dosya benzeri nesne: büyük HDF5/NetCDF granüllerinden (SMAP ~680 MB) küçük dilim almak için.

Yönlendirme bir kez çözülür (NSIDC: imzalı S3 adresi; GES DISC: çerez oturumu) ve sonraki blok istekleri doğrudan o adrese gider.
Blok önbelleği küçük tutulur; oturum `earthaccess` ile alınır (Earthdata belirteci ortamdan; bu modül belirteci görmez).
"""

from __future__ import annotations

import io
from typing import Any


class RangeFile(io.RawIOBase):
    def __init__(self, url: str, session: Any, block: int = 256 * 1024) -> None:
        self.session, self.block, self.pos = session, block, 0
        self.cache: dict[int, bytes] = {}
        self.requests = 0
        first = session.get(url, headers={"Range": "bytes=0-0"}, timeout=90, allow_redirects=True)
        first.raise_for_status()
        self.url = first.url  # yönlendirme sonrası adres
        content_range = first.headers.get("Content-Range")
        if not content_range:
            raise OSError("Sunucu bayt aralığı isteklerini desteklemiyor.")
        self.size = int(content_range.split("/")[1])

    def readable(self) -> bool:
        return True

    def seekable(self) -> bool:
        return True

    def tell(self) -> int:
        return self.pos

    def seek(self, offset: int, whence: int = 0) -> int:
        self.pos = offset if whence == 0 else self.pos + offset if whence == 1 else self.size + offset
        return self.pos

    def _block(self, index: int) -> bytes:
        if index not in self.cache:
            start = index * self.block
            end = min(self.size, start + self.block) - 1
            response = self.session.get(self.url, headers={"Range": f"bytes={start}-{end}"}, timeout=120)
            response.raise_for_status()
            if len(self.cache) > 64:
                self.cache.clear()
            self.cache[index] = response.content
            self.requests += 1
        return self.cache[index]

    def readinto(self, buffer: Any) -> int:
        want = len(buffer)
        out = bytearray()
        while len(out) < want and self.pos < self.size:
            index, offset = divmod(self.pos, self.block)
            chunk = self._block(index)[offset : offset + want - len(out)]
            out += chunk
            self.pos += len(chunk)
        buffer[: len(out)] = out
        return len(out)


def open_remote(url: str, session: Any, block: int = 256 * 1024) -> io.BufferedReader:
    return io.BufferedReader(RangeFile(url, session, block))
