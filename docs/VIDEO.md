# Hero videosu: yapay zekâ ile gerçekçi limon bahçesi

Hero'da gerçek görüntüden dijital ikize geçiş var. Kaydırdıkça önce drone bahçeye gelir, sonra tam tepeden bakar. Ardından sarı tarama çizgisi yukarıdan aşağı inerek görüntüyü sitenin çizdiği dijital haritaya çevirir.

Bu geçişin kusursuz görünmesi için **videonun son karesi tam tepeden (90°) çekilmiş, sıraları yatay giden bir limon bahçesi olmalı**. Dijital harita da tam olarak böyle çiziliyor.

## Çekim planı (tek sürekli plan, kesme yok)

| Süre | Kamera | Ne görünür |
|---|---|---|
| 0–3 sn | ~60 m yükseklik, 30° eğik bakış, ileri uçuş | Sıra sıra limon bahçesi, arkada Toros dağları, uzakta Akdeniz, altın saat ışığı |
| 3–7 sn | Uçuş devam ederken kamera yavaşça aşağı döner | Sıralar yaklaşır |
| 7–10 sn | Tam tepeden (nadir) bakış, yavaş alçalma | Yuvarlak limon ağacı tepeleri, sarı limonlar seçiliyor, sıralar ekranda yatay |

Sabit hız, sarsıntı yok, kesme yok, üzerinde yazı ya da logo yok.

## Önerilen iş akışı

1. **İki anahtar kare üret** (Midjourney, Imagen, Flux veya ChatGPT görsel):
   - Başlangıç karesi: eğik açılı, yüksekten bahçe manzarası.
   - Bitiş karesi: tam tepeden, sıraları yatay bahçe.
2. **İlk ve son kareyle video üret**. İlk/son kare destekleyen araçlar: Google Veo, Kling, Runway Gen-4, Luma. 8–10 sn, 1080p veya üstü, 24–30 fps.
3. En temiz sonucu seç. Gerekirse iki klibi (uçuş + iniş) bir video düzenleyicide birleştir.
4. `./scripts/extract-frames.sh bahce.mp4` komutunu çalıştır, ardından `.env.local` içine `NEXT_PUBLIC_HERO_MODE=sequence` yaz.

## Promptlar (İngilizce daha iyi sonuç verir)

### Başlangıç karesi (görsel)

```
Aerial drone photograph of a vast Mediterranean lemon orchard in Mersin, Turkey, at golden hour.
Camera 60 meters high, tilted 30 degrees down, looking along long straight rows of round lemon trees
with dark glossy green canopies dotted with ripe yellow lemons. Reddish-brown soil paths between rows,
drip irrigation lines visible. Taurus mountains softly in the background haze, a thin line of the
Mediterranean Sea on the horizon. Warm low sunlight, long soft shadows, photorealistic, shot on
DJI Mavic 3 style camera, 16:9, ultra detailed, natural colors, no people, no text, no watermark.
```

### Bitiş karesi (görsel)

```
Top-down nadir aerial photograph, camera pointing straight down (90 degrees) at a lemon orchard.
Evenly spaced round lemon tree canopies arranged in perfectly horizontal rows across the frame,
about 4–5 meters apart, dense dark green leaves with visible ripe yellow lemons, brown soil and dry
grass between the trees, soft morning light, crisp detail, photorealistic, 16:9, no people, no text,
no watermark, no vehicles.
```

### Video (ilk + son kare ile)

```
Smooth cinematic drone flight over a lemon orchard. The camera flies forward along the tree rows at
constant speed, then slowly tilts down until it looks straight down at the canopies, and gently
descends. Continuous single shot, no cuts, stable gimbal, no shake, realistic motion parallax,
leaves slightly moving in a light breeze, golden hour light. Photorealistic, 16:9, 24 fps.
```

**Negatif prompt** (destekleyen araçlarda):

```
text, watermark, logo, people, cars, buildings in foreground, fisheye distortion, camera shake,
morphing trees, flickering, cartoon, oversaturated, fast motion, cuts
```

### Drone'un da görünmesini istersen (alternatif)

```
Chase-camera shot following a small white quadcopter drone (no logos) flying low over a lemon orchard
at golden hour. After 3 seconds the camera rises above the drone and tilts straight down to a top-down
view of the round lemon tree canopies in horizontal rows. Single continuous shot, stable, photorealistic,
16:9.
```

Not: Drone'lu plan yapay zekâda daha sık bozuk çıkıyor (pervaneler, gövde şekli). Önce kameranın drone gözü olduğu plan önerilir; tarama çizgisi ve "Drone bahçenin üzerinden geçer" yazısı bu hissi zaten veriyor.

## Kalite kontrol listesi

- [ ] Son 1–2 saniye tam tepeden ve sıralar yatay
- [ ] Ağaçlar kare kare şekil değiştirmiyor (morphing yok)
- [ ] Ani ışık değişimi ya da titreme yok
- [ ] Limonlar sarı ve seçilebiliyor, yapraklar koyu parlak yeşil
- [ ] Yazı, logo, insan, araç yok

## Sonra: gerçek çekim

Drone alındığında aynı planı Tömük bahçesinde gerçek olarak çek; güvenilirlik açısından en iyisi budur:

- 60 m'den başla, 25 m'ye alçal
- Gimbal açısını −30°'den −90°'ye getir
- Hız 4–5 m/s
- 4K, 30 fps
- Rüzgârsız, sabah ya da akşamüstü

Kareleri aynı betikle üretip dosyaları değiştirmen yeterli, kod aynı kalır.
