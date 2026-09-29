#!/usr/bin/env bash
# Kaydırmaya bağlı hero için videodan kare dizisi üretir.
#
# Kullanım:
#   ./scripts/extract-frames.sh drone.mp4            # 160 masaüstü + 100 mobil kare
#   ./scripts/extract-frames.sh drone.mp4 200 120    # kare sayılarını değiştir
#
# Gerekenler: ffmpeg (libwebp ile). macOS: brew install ffmpeg
# Sonra .env.local içine NEXT_PUBLIC_HERO_MODE=sequence yazın ve
# src/lib/site.ts içindeki count değerlerini buradaki sayılarla eşitleyin.
set -euo pipefail

IN="${1:?Girdi video dosyasını verin}"
ND="${2:-160}"
NM="${3:-100}"
OUT="public/media/hero-frames"

DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$IN")
FPSD=$(awk -v n="$ND" -v d="$DUR" 'BEGIN{printf "%.4f", n/d}')
FPSM=$(awk -v n="$NM" -v d="$DUR" 'BEGIN{printf "%.4f", n/d}')

mkdir -p "$OUT/desktop" "$OUT/mobile"
rm -f "$OUT"/desktop/*.webp "$OUT"/mobile/*.webp

echo "▶ Masaüstü kareleri (1920 px, $ND kare)"
ffmpeg -loglevel error -y -i "$IN" \
  -vf "fps=$FPSD,scale=1920:-2:flags=lanczos" -frames:v "$ND" \
  -c:v libwebp -quality 72 -compression_level 6 "$OUT/desktop/%04d.webp"

echo "▶ Mobil kareleri (960 px, $NM kare)"
ffmpeg -loglevel error -y -i "$IN" \
  -vf "fps=$FPSM,scale=960:-2:flags=lanczos" -frames:v "$NM" \
  -c:v libwebp -quality 68 -compression_level 6 "$OUT/mobile/%04d.webp"

echo "✔ Masaüstü: $(ls "$OUT/desktop" | wc -l | tr -d ' ') kare, $(du -sh "$OUT/desktop" | cut -f1)"
echo "✔ Mobil:    $(ls "$OUT/mobile" | wc -l | tr -d ' ') kare, $(du -sh "$OUT/mobile" | cut -f1)"
echo "Hedef: masaüstü toplam ≤ 12 MB, mobil ≤ 5 MB. Aşarsa kare sayısını veya -quality değerini düşürün."
