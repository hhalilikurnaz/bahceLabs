"""Küçük resim üretimi: tam boyutlu renkli PNG'den, saydam kenarları kırpılmış küçük görüntü."""

from __future__ import annotations

import io

from PIL import Image


def make_thumbnail(png: bytes, max_px: int) -> bytes:
    """Saydam olmayan alana kırpar ve en uzun kenar `max_px` olacak şekilde küçültür (oran korunur)."""
    with Image.open(io.BytesIO(png)) as source:
        image = source.convert("RGBA")
    bbox = image.getchannel("A").getbbox()
    if bbox is not None:
        image = image.crop(bbox)
    image.thumbnail((max_px, max_px), Image.Resampling.LANCZOS)
    out = io.BytesIO()
    image.save(out, format="PNG", optimize=True)
    return out.getvalue()
