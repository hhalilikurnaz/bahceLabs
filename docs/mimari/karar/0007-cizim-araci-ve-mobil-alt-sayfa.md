# ADR 0007 — Çizim aracı, canlı form ve mobil alt sayfa

**Durum:** kabul (Adım 7C)

**Bağlam.** 7B-2 sonrası bahçe ekleme akışında form, çizim bittikten sonra sol panelde açılıyordu; kenar uzunlukları, daire, yinele, köşe yapışması yoktu; dar ekranda panel haritayı tamamen örtüyordu.

**Karar.**
1. **Çizim** (terra-draw, tembel yüklenir): çokgen ve daire modları; daire, köşeleri taşınabilen seyrek çokgene çevrilir (`lib/measure.ts: decimateRing`). Köşe/çizgi yapışması terra-draw'ın `snapping` seçeneğiyle, başka bahçelerin köşelerine yapışma `toCustom` + `nearestVertex` ile yapılır. Her kenarın uzunluğu (m) kenar ortasında DOM etiketiyle (`EdgeLabels`), canlı alan araç çubuğunda ve formda gösterilir. Çizim sonrası "Sınır tamam"a kadar düzenleme (köşe ekle/sil/taşı, geri al/yinele) açık kalır. Tutamaçlar dokunmatikte büyüktür (`DRAW.handleCoarsePx`).
2. **Canlı form** sağ panelde (`GardenForm`): çizim sürerken açıktır, alan canlı güncellenir; alan doğrulamaları `lib/gardenFields.ts` (sunucu kurallarının aynısı) ile alanın başında gösterilir; kayıtta sunucu yeniden doğrular. Kayıttan sonra `ProcessingWatcher` işi izler ve bitince bildirim (toast) verir. Sınır düzenlemede kayıttan önce "yeniden işlenecek" uyarısı ve onay vardır.
3. **Bahçe bilgileri:** `agac_sayisi` alanı (migration 010) ve PATCH ile "Bilgileri tamamla".
4. **Yerleşim eşiği 1180 px:** üç bölgeli yerleşim bunun üstünde; altında (telefon ve tablet 768 px) bahçe paneli alttan açılan sayfadır (kapalı/yarım/tam; sürüklenir, ↑ ↓ ile ayarlanır, `lib/layout.ts: sheetHeightPx`). Harita denetimleri sayfanın üstünde konumlanır (`--sheet-h`), yarım/tam açıkken gizlenir.
5. **Erişilebilirlik:** kontrol kenarlıkları ≥ 3:1 (`--color-app-border-strong`), kontrast token testi (`tests/contrast.test.ts`), Playwright ile ad/odak/dokunma hedefi taraması.

**Sonuçlar.** Çizim ve form tek akışta; mobilde harita her zaman üstte görünür. Çizim aracı ağır olduğundan ilk açılışta yüklenir (ADR 0005 ile uyumlu).

**Geri dönüş.** Form yerleşimi `DetailPanel` içindedir; eski sol-panel formuna dönmek yalnızca bu yönlendirmeyi değiştirir.
