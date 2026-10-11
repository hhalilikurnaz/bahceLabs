# ADR 0001 — MapLibre + Mapbox altlık (MapTiler yedek)

**Durum:** kabul (Adım 7A)

**Bağlam.** MapTiler uydu görüntüsü Erdemli'de z17 üstünde bulanıktı. Esri World Imagery'nin ücretsiz kullanımı ticari değil. Mapbox Satellite aynı bölgede gerçek ayrıntıyı z19'a kadar verdi (ölçüm: bir önceki seviyenin büyütülmüşüne fark z19'da ≈6, z20'de <1; MapTiler z18'de doygun).

**Karar.** Harita kütüphanesi MapLibre kalır (Mapbox GL'ye geçilmez). Ana altlık Mapbox raster karoları (`@2x`, tileSize 512, source `maxzoom` 19, ötesi yumuşak büyütme); yedek MapTiler; anahtar yoksa OSM. Sağlayıcı soyut (`buildStyle`); token yoksa/401'de MapTiler'a düşülür ve konsola tek satır uyarı yazılır. Token yalnızca `.env.local`. Atıflar ve Mapbox wordmark logosu sol altta görünür (`MapAttribution`); karolar toplu indirilmez/uzun saklanmaz.

**Sonuçlar.** Ticari kullanımda Mapbox kullanım koşulları/fiyatlandırması izlenmeli (Adım 20). Mapbox'ın resmi wordmark SVG'si Mapbox'ın herkese açık CSS'inden alınmıştır.
