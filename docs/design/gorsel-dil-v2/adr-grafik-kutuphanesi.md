# ADR (TASLAK) · Grafik kütüphanesi: visx

> **Durum:** taslak · numara seçimden sonra verilir (sonraki boş ADR). Karar sahibi: ürün sahibi + frontend.
> **Bağlam:** `docs/design/ux-denetimi.md` §d. Grafikler elle yazılmış SVG; ortak bileşen yok (15 grafik, 4 farklı zaman aralığı, 20 farklı çizgi kalınlığı, `niceTicks` yalnız 1 yerde). `package.json`'daki `d3-scale`, `d3-shape`, `d3-array` bağımlılıkları kodda **hiç import edilmiyor**; `d3-contour` yalnız eş-değer çizgisinde kullanılıyor.

## Karar (öneri)
**visx** (Airbnb; `@visx/scale`, `@visx/shape`, `@visx/axis`, `@visx/group`, `@visx/event`, `@visx/responsive`, `@visx/pattern`) ile **ortak grafik bileşen seti** (`@/components/chart`, bkz. `bilesenler.md`) kurulur.

### Neden visx
- **Düşük düzeyli, stil dayatmaz:** iki farklı görsel yön (A/B) ya da gelecekteki ayarlar yalnız token'larla değişir; çizim SVG'dir, mevcut `var(--…)` token'larıyla uyumludur.
- **Mevcut kodla uyum:** bugünkü grafikler zaten SVG + d3 ölçekleri; visx d3'nin ince bir React sarmalıdır (`d3-scale`/`d3-shape` zaten bağımlılık). Geçiş artımlıdır: grafik grafik taşınır.
- **Erişilebilirlik ve doğruluk bizde:** eksenler, çentikler (`niceTicks`), halo'lu etiket, tarama/kesikli tahmin, doğrudan etiketleme ve senkron imleç bizim `chart` katmanımızda tek tanımlanır; kütüphane yalnız ölçek/şekil/eksen hesabını verir.
- **Paket boyutu:** yalnız kullanılan alt paketler (tree-shake); MapLibre'nin yanında ihmal edilebilir (≈ 30–50 KB gzip beklenir; ölçülecek).
- **Haritaya bağ:** zaman alanı ve imleç `TimeDomain` bağlamında; harita katmanı/tarihi aynı store'dan beslenir (ilke 10).

### Değerlendirilen seçenekler
| Seçenek | Artı | Eksi | Sonuç |
|---|---|---|---|
| **Elle SVG (bugünkü)** | bağımlılık yok | 15 grafikte tutarsızlık, kopya kod, yanlış okunabilir ölçek (U-02) | bırakılır |
| **visx** | düşük düzey, stil serbest, d3 uyumlu, React 19 | kendi bileşen setimizi yazmak gerekir | **önerilen** |
| **Recharts** | hızlı | kapalı stil, doğrudan etiket/tahmin/band için kısıt, bundle büyük | elendi |
| **ECharts / Plotly** | zengin | büyük bundle, görünümü token'lara bağlamak zor, jenerik görünüm | elendi |
| **uPlot** | çok hızlı | düşük düzey canvas, React/erişilebilirlik zayıf, anotasyon zor | büyük zaman serileri gerekirse ayrı ADR |
| **Observable Plot** | kısa kod | imperatif DOM, React uyumu ve etkileşim zayıf | elendi |

## Sonuçlar
- **Ölü d3 bağımlılıkları:** `d3-scale`, `d3-shape`, `d3-array` visx'in alt bağımlılığı olarak **kullanılır hâle gelir** (visx bunlara dayanır); doğrudan bağımlılık olarak yalnız gerçekten import edilenler kalır, `@types/*` eşlenir. `d3-contour` eş-değer çizgisi için kalır. Geçiş bitince kullanılmayan doğrudan bağımlılık kalmaz (CI'da `knip`/`depcheck` ile doğrulanır).
- **Ölçüm:** bundle farkı ve ilk boyama süresi PR'da raporlanır; katman değişimi eşiği (≤ 150 ms medyan) `e2e/performans.spec.ts` ile korunur.
- **Geçiş sırası:** `ChartFrame`, `ValueAxis`, `TimeDomain` → Su dengesi (iki panel) → sezon eğrisi (`BandLine`) → mini çizgi (`Sparkline`, liste) → 12 yaz (`SmallMultiples`) → kalanlar.
- **Test:** her grafik türü için birim test (ölçek/çentik/tahmin bölme), Playwright + axe (12 px taban, kontrast, `role="img"` + özet metin), görsel regresyon (maket ekran görüntüleri).
- **Risk:** visx bakım temposu; azaltma: bileşen katmanımız ince, d3 çekirdeğe düşebilir.
