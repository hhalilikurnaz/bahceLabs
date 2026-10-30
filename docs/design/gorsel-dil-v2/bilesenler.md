# Grafik bileşen seti (görsel dil v2 · öneri)

> Her iki yön de **aynı bileşen seti ve aynı API'yi** kullanır; yönler yalnız token'larla (`tokens-a.css` / `tokens-b.css`) ve küçük stil değişkenleriyle ayrışır. Seçimden sonra uygulanır (`@/components/chart`).
> Ölçüt: [görselleştirme ilkeleri 1–11](../gorsellestirme-ilkeleri.md). Kütüphane kararı: [`adr-grafik-kutuphanesi.md`](adr-grafik-kutuphanesi.md).

## 1. Çatı bileşenleri

| Bileşen | Görev | Zorunlu girdi | İlke |
|---|---|---|---|
| `ChartFrame` | Kart: **başlık = mesaj cümlesi**, tek satır birim/kaynak, veri yaşı rozeti, «?» (ayrıntı/yöntem) | `mesaj`, `birim`, `kaynak`, `veriTarihi` | 1, 7, 9, 11 |
| `TimeDomain` (bağlam) | Sayfa başına TEK zaman alanı + senkron imleç; harita tarihiyle iki yönlü bağlı | `aralik`, `imlec`, `onImlec` | 10 |
| `TimeAxis` / `ValueAxis` | Eksenler. `ValueAxis`: 1-2-2,5-5 «yuvarlak» çentik (`niceTicks`), birim zorunlu, 12 px taban; `TimeAxis`: dar alanda her ikinci ay | `birim` | 4, 9 |
| `NormalBand` | Bahçenin kendi geçmişinden **tek tanımlı** normal bant: p25–p75 koyu, p10–p90 açık, ortanca ince kesikli. Veri `normal_bant` kuralından (katalog) | `bant`, `kaynakKural` | 3 |
| `Threshold` | Eşik çizgisi + doğrudan etiket (don 0 °C, normal bant sınırı, sulama eşiği) | `deger`, `etiket` | 4 |
| `Forecast` | Tahmin işaretçisi: **tarama** (alan) + **kesikli** (çizgi) + «7 gün tahmin» etiketi; gözlem dolu | `baslangic` | 7 |
| `DirectLabel` | Seri/nokta etiketi (halo'lu, çakışma kaçınmalı); **lejant paragrafı yok** | `x`, `metin` | 9 |
| `Annotation` | Grafikte kısa not (kartografik not'un grafik karşılığı) | `x`, `metin` | 2 |
| `ChartTooltip` | Tek tooltip: tarih + değer + kaynak + güven | – | 7 |
| `StaleBadge` | Veri yaşı: «Sentinel-2 · 20 gün önce»; ≥ eşik (ön değer) amber tonlu | `tarih`, `kaynak` | 7, 8 |
| `ChartState` | `yok` · `bayat` · `hata` ayrı görünüm (neden + ne zaman gelir); **hata asla boş durum olarak çizilmez** | `tur`, `neden` | 8 |

## 2. Grafik türleri (her tür tek yerde, tek kabul ölçütüyle)

| Tür | Kullanıldığı yer (maket) | Not |
|---|---|---|
| **Çizgi + normal bant** (`BandLine`) | Durum (kanıt), Geçmiş (sezon), Liste (mini çizgi) | Tek bileşen üç boyutta: tam / kompakt / `Sparkline`. Gözlem dolu nokta (Sentinel-2) ve boş nokta (HLS 30 m); tahmin taralı/kesikli |
| **Günlük çubuk, iki yönlü** (`DivergingBars`) | Su · panel 1 | Yağış ↑ mavi, ETc ↓ sıcak ton; 7 gün tahmin taramalı |
| **Birikimli çizgi** (`CumulativeLine`) | Su · panel 2 | **Ayrı panel, aynı zaman ekseni**; sıfır çizgisi; son değer doğrudan etiketli. Çift eksen yok |
| **Bullet** (`Bullet`) | (Durum bileşenleri, ayrıntı) | Bugün vs normal bant |
| **Dumbbell** (`Dumbbell`) | (Su ayrıntı: yüzey–hava) | Hava ve yüzey arasındaki fark; etiket sayısı azaltılır |
| **Şerit** (`Strip`) | (Hava: ilaçlama penceresi) | Renk + desen; mevcut örnek kalite |
| **Dağılım** (`Histogram`) | Harita lejantı | Mutlak skala + ortanca işareti |
| **Küçük-çoklu harita** (`SmallMultiples`) | Geçmiş · 12 yaz | ORTAK mutlak skala + mini lejant; uyumsuz yıl kesikli çerçeve; yetersiz yıl taramalı boş kutu |
| **Kademe şeridi** (`TierStrip`) | Durum | 4 parça + simge + ad; renk tek başına anlam taşımaz |
| **Harita rampası + lejant** (`MapLegend`) | Durum, Su, Liste | Tek satır: ad · ramp · ortanca. Gerilmiş skala etiketli rozet |

## 3. Haritaya özel bileşenler

| Bileşen | Görev |
|---|---|
| `MapRail` | **Tek kontrol rayı**: katman · tarih (‹ ›) · ⋯. Uzman kontrolleri (skala, eş-değer çizgisi, opaklık) ⋯ altında |
| `CartoNote` | Kartografik not: bulgu → haritada ilgili bölgeye **ince çizgiyle bağlı** kısa not; konum çok yıllı bölge geometrisinden |
| `MapLegend` | Mutlak skala lejantı (tek satır) |
| `ScaleBadge` | «gerilmiş skala · 0,56 °C aralık» ya da «gerilme kapalı · anlamlı fark yok» (U1'de uygulandı) |

## 4. Yönlere göre uygulama farkı (aynı bileşen, farklı dil)

| | **A · Defter** | **B · İstasyon** |
|---|---|---|
| Çizgi | 1 px ince eksen, 1,75 px seri, keskin uçlar | 1 px eksen, 2,25 px seri, yuvarlak uçlar |
| Normal bant | düz tonlu alan + ince kesikli ortanca | aynı, daha doygun yeşil-turkuaz ton |
| Tahmin | tarama (45°) + kesikli | aynı |
| Doğrudan etiket | Plex 13/700, halo kâğıt rengi | Inter Tight 13/700, halo beyaz |
| Not (CartoNote) | kâğıt kutu, serif metin, 1 px mürekkep çerçeve, sert gölge, ince çizgi | beyaz kart, 14 px köşe, yumuşak gölge, 2 px beyaz çizgi + nokta |
| Ray | haritanın üstünde tam genişlik ince cetvel şeridi | yüzen hap (pill) |
| Kart | cetvel çizgili düz yüzey, çift çizgi başlık ayracı | gölgeli yuvarlak kartlar |
| Sayı | serif 68/62 | sans 76/64, sıkı iz |
| Karar cümlesi | **serif** (Newsreader 30/34) | **sans** (Inter Tight 26/30, sıkı) |

## 5. Kabul ölçütleri (her grafik için)
1. Başlık tek cümle mesajdır; ikinci bir y ekseni yok.
2. En küçük yazı ≥ 12 px (SVG dahil), yarım piksel yok.
3. Çizgi/yüzey kontrastı ≥ 3:1; renk dışı kodlama (desen/simge/etiket) var.
4. Veri yaşı rozeti ve (varsa) güven belirtilmiş; tahmin gözlemden ayrılıyor.
5. Eksen çentikleri yuvarlak, birimli; lejant paragrafı yok.
6. Boş/bayat/hata durumları `ChartState` ile ayrı.
7. Katman değişimi ≤ 150 ms (harita), grafik ilk boyama ≤ 100 ms (≤ 500 nokta).
