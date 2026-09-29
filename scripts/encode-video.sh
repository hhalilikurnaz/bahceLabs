#!/usr/bin/env bash
# "video" modu (otomatik oynayan döngü) için web'e uygun dosyalar üretir.
# Kullanım: ./scripts/encode-video.sh drone.mp4
set -euo pipefail
IN="${1:?Girdi video dosyasını verin}"
OUT="public/media"
mkdir -p "$OUT"
# H.264 MP4 (her tarayıcı), sessiz, hızlı başlama için faststart
ffmpeg -loglevel error -y -i "$IN" -an -vf "scale=1920:-2:flags=lanczos" -c:v libx264 -preset slow -crf 26 -pix_fmt yuv420p -movflags +faststart "$OUT/hero.mp4"
# VP9 WebM (daha küçük)
ffmpeg -loglevel error -y -i "$IN" -an -vf "scale=1920:-2:flags=lanczos" -c:v libvpx-vp9 -crf 36 -b:v 0 -row-mt 1 "$OUT/hero.webm"
# Mobil 720p
ffmpeg -loglevel error -y -i "$IN" -an -vf "scale=1280:-2:flags=lanczos" -c:v libx264 -preset slow -crf 28 -pix_fmt yuv420p -movflags +faststart "$OUT/hero-720.mp4"
# Poster (ilk kare)
ffmpeg -loglevel error -y -i "$IN" -vframes 1 -vf "scale=1920:-2" -q:v 4 "$OUT/hero-poster.jpg"
ls -lh "$OUT"/hero*
