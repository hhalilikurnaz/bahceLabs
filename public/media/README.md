# Medya dosyaları

| Dosya | Mod | Özellik |
|---|---|---|
| `hero-frames/desktop/0001.webp …` | sequence | 1920 px genişlik, 140–180 kare, toplam ≤ 12 MB |
| `hero-frames/mobile/0001.webp …` | sequence | 960 px genişlik, 90–110 kare, toplam ≤ 5 MB |
| `hero.mp4`, `hero.webm`, `hero-720.mp4`, `hero-poster.jpg` | video | 8–12 sn döngü, sessiz |

Kareleri `scripts/extract-frames.sh`, videoları `scripts/encode-video.sh` üretir.
Kare sayısını değiştirirseniz `src/lib/site.ts` içindeki `count` değerlerini de güncelleyin.
