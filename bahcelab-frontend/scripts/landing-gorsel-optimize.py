#!/usr/bin/env python3
"""Landing görsellerini optimize WebP'ye çevirir (Pillow gerekir).

Kullanım (bahcelab-frontend/ içinden):
  python3 scripts/landing-gorsel-optimize.py hero <kaynak.webp>   # hero fotoğrafı → public/media/hero/ (masaüstü + mobil)

Bütçe (docs/design/landing-l1-rapor.md): hero toplamı ≤ 1,5 MB (mobil ≤ 800 KB).
"""
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]

def yaz(img: Image.Image, hedef: Path, genislik: int, kalite: int) -> None:
    if img.width > genislik:
        img = img.resize((genislik, round(img.height * genislik / img.width)), Image.LANCZOS)
    hedef.parent.mkdir(parents=True, exist_ok=True)
    img.convert("RGB").save(hedef, "WEBP", quality=kalite, method=6)
    print(f"{hedef.relative_to(ROOT)}  {img.width}x{img.height}  {hedef.stat().st_size / 1024:.0f} KB")


def hero(kaynak: Path) -> None:
    img = Image.open(kaynak)
    yaz(img, ROOT / "public/media/hero/hero-1920.webp", 1920, 60)
    yaz(img, ROOT / "public/media/hero/hero-1000.webp", 1000, 52)


if __name__ == "__main__":
    if len(sys.argv) != 3 or sys.argv[1] != "hero":
        sys.exit(__doc__)
    hero(Path(sys.argv[2]))
