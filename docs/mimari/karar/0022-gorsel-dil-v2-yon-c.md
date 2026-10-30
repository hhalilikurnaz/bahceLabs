# 0022 — Görsel dil v2 (Yön C «Saha»), grafik kütüphanesi (visx), cam ve hareket

Durum: kabul edildi. Tarih: 2026-10-30. Gerekçe: `docs/design/ux-denetimi.md`, `docs/design/gorsellestirme-ilkeleri.md`, maketler `docs/design/gorsel-dil-v2/`.

## Kararlar
1. **Tek dil, tek token dosyası:** `src/styles/tokens.css` (Yön C). `@theme`, `.app-shell`, `.notebook` (Saha Defteri), ölü `planning-*` paleti ve `features/planning-simulation`, `features/tasarim` kaldırıldı. Bileşenlerde ham hex yasak (`tests/tokens.test.ts`); izinli yerler yalnız veri rampaları ve harita renk dosyası (`map/haritaRenkleri.ts`).
2. **Yazı:** Source Sans 3, self-host (`src/assets/fonts`); Google Fonts isteği yok. Tanıtım sayfası başlıkları Fraunces (self-host), uygulama kabuğunda kullanılmaz. Mono yalnız koordinat/saat. 12 px taban, yarım piksel yok (test).
3. **Biçim:** köşe 6 px (çip 4 px), kartta gölge yok (1 px çizgi); gölge yalnız yüzen öğede. Büyük harfli harf aralıklı etiket yok. Gradyan yalnız veri rampasında.
4. **Cam («liquid glass»):** yalnız haritadaki yüzen öğeler (ray, lejant, ölçek/yakınlaştırma, not kutuları, nokta inceleme, alt sayfa tutamağı, kaydırınca yapışkan panel başlığı). `backdrop-filter: blur(20px) saturate(160%)`, ~%70 beyaz (koyu temada %78), 1 px iç ışık, köşe 10 px; `@supports` yoksa ya da `prefers-reduced-transparency` açıksa opak yedek. Metin kontrastı en kötü arka planda AA (`tests/glass.test.ts`). Paneller, kartlar, tablolar düz beyaz.
5. **Hareket:** süre 150–250 ms, ease-out (token); reduced-motion'da kapalı. Sekme geçişi 250 ms (8 px), katman çapraz geçişi 200 ms (çift tuval yuvası), kademe göstergesi kayar, grafik ilk görünüşte bir kez çizilir (600 ms), büyük sayı ilk açılışta 400 ms sayar, nota tıklayınca 600 ms flyTo + bölge vurgusu, alt sayfa üç duraklı. Yasak: zıplama, parıltı, paralaks, dönen yükleme süsü.
6. **Grafik kütüphanesi: visx** (kabul; taslak: `docs/design/gorsel-dil-v2/adr-grafik-kutuphanesi.md`). Kullanılan alt paketler: scale, shape, group, event, pattern. Ölü `d3-scale/shape/array` doğrudan bağımlılıkları kaldırıldı; `d3-contour` kaldı. Bileşen seti `src/components/chart`: ChartFrame, TimeDomain (+ senkron imleç), ValueAxis/TimeAxis (niceTicks), BandLine (NormalBand), Threshold, Forecast, DirectLabel, Annotation, ChartTooltip, StaleBadge, ChartState, Sparkline, SuDengesiPaneller.
7. **Sağ panel:** 500 px (1024'te 420), 420–640 px sürüklenebilir ayraç (tercih saklanır); ≤ 899 px üç duraklı alt sayfa. Her sekme: karar cümlesi → tek büyük sayı → tek kanıt → Yapılacaklar (açık) → ikincil kartlar → ayrıntı akordeonu. Sekme haritanın katmanını değiştirir.
8. **Karar cümleleri** `lib/karar.ts` içinde saf işlevler (test: kısa, tek cümle, noktalı virgül ve jargon yok).

## Sonuçlar ve riskler
- `tokens.css` tek kaynak: yeni renk eklemek token + test gerektirir.
- Cam performansı: `backdrop-filter` yalnız küçük yüzen öğelerde; büyük alanda yok. Düşük güçlü cihazlarda `prefers-reduced-transparency` ve opak yedek.
- visx bakımı: ince bileşen katmanı sayesinde d3 çekirdeğe düşmek mümkün.

## Ek (performans)
Blur yalnız harita DURGUNKEN uygulanır (`src/lib/cam.ts`): hareket/katman değişimi sırasında bulanıksız yedek. Ölçüm ve gerekçe: `docs/design/u4-performans-ab.md` (katman değişimi medyan 163 → 77 ms, harita sürükleme 26 → 90 fps).
