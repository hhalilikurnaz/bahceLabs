# 9H-S4 (dilim 2) · Sulama haritası simülatörü: ilkeler 1–11, ekran bazında

✓ = karşılanıyor · ◐ = kısmen · — = geçerli değil. Kaynak: [gorsellestirme-ilkeleri.md](gorsellestirme-ilkeleri.md). Ekranlar: [u9h4-d2-ekranlar.pdf](u9h4-d2-ekranlar.pdf), klasör `u9h4-d2-ekranlar/`, oynatma: `u9h4-d2-ekranlar/tb-oynatma.webm`. Testler: `e2e/sulama-harita.spec.ts`, `tests/sulamaHarita.test.ts`, `tests/geometri.test.ts`, `tests/sulamaGeo.test.ts`.

| İlke | Harita + durum kartı | 3 gösterge + lejant | Alt çubuk + sezon şeridi | Vana çizim aracı | Vana odağı (panel) | Not |
|---|---|---|---|---|---|---|
| 1 Tek soru, başlık cevap | ✓ «V2, V4 sulanıyor: kök bölgesi sulama eşiğine (%60) indi» | ✓ gösterge başına tek soru (toprak suyu · stres 7 g · fazla su 7 g) | ✓ «bu sezon ne zaman sulandı» | ✓ tek iş: vanaları bölmek | ✓ tek vana | |
| 2 Karar → sayı → kanıt → ayrıntı | ✓ cümle → saat/ET₀/yağış/ort. toprak suyu | ✓ renk → etiket → lejant | ✓ imleç → tarih → şerit | ✓ ipucu → liste → Kaydet | ✓ durum → Kc kaynağı → eylem | |
| 3 Normal bant tek tanım | ✓ durum bantları 50/70/97 katalogdan (`durum_*`) | ✓ aynı bantlar; stres/fazla su sınıfları gösterim sınıfı (ön değer) | ✓ sulama eşiği çizgisi = plan tetiği | — | — | fazla su sınıf eşikleri `sulamaHarita.ts` (2/8 mm) |
| 4 Dürüst ölçek | ✓ | ✓ | ✓ kova 0–100 % tek eksen; yağış çubuğu en yüksek yağışa göre | ✓ ölçek çubuğu gerçek metre | — | |
| 5 Renk anlamı sabit | ✓ stres kırmızı · yakın sarı · yeterli yeşil · dolu mavi, her yerde | ✓ | ✓ su/yağış mavi, stres uyarı, bugün kırmızı çizgi | ✓ | — | ham hex yok (`HARITA` + `tokens.test.ts`) |
| 6 Renk tek başına değil | ✓ etiket «yakın · sonraki 22 Tem» yazar | ✓ her sınıf yazılı (lejant + etiket), ışık simgesi yok | ✓ ▮ sulama, ■ stres, — kova açıklaması | ✓ ad + dekar etiketi | ✓ | karar B9 |
| 7 Belirsizlik görünür | ✓ «Tahmin», «Geçici veri: ERA5 henüz kesinleşmedi» | ✓ | ✓ gelecek günler «Tahmin» çipi | — | ✓ Kc kaynağı: piksel + bulut maskesi, bahçe değerine düşüş nedeni | ağaç sırası «dikim aralığından çizildi · varsayım»; şerit 1 m «varsayım» |
| 8 Yok / bayat / hata ayrı | ✓ profil yok → «Sulama bilgileri gerekli»; boru/pompa çizilmediyse «gösterilmiyor» (uydurma yok) | ✓ | ✓ | ✓ 300 m / ad / debi doğrulaması yazılı | ✓ «Bu vana sonraki programda yok» | dikim aralığı yoksa sıra çizilmez |
| 9 Doğrudan etiket, 12 px | ✓ vana etiketi dik (harita dönse de), ≥ 12 px | ✓ lejant yazılı | ✓ ay adları ve «bugün» şeritte | ✓ | — | `tokens.test.ts` 12 px |
| 10 Harita–grafik bağı | ✓ etiket metni = panel vana satırı (`vanaEtiketi`); durum kartı ↔ etiket halkası aynı küme (e2e) | ✓ | ✓ imleç günü = panel Vana programı günü | — | ✓ haritada vana → panel odağı | alt çubuk eski kaydırıcının yerine geçti |
| 11 Bir grafik bir mesaj; ≤ 150 ms | ✓ paint güncellemesi (React yok) | ✓ gösterge değişimi tek `setPaintProperty` turu | ✓ oynatma 65 fps, kare p95 17,5 ms (SwiftShader) | — | — | animasyon 150–250 ms; hareketi azalt: tümü kapalı, durum yazıyla |

**Performans (oynatma, 1440×900, başsız Chromium + yazılım WebGL):** 65,6 fps, kare p95 17,5 ms, 263 kare / 4 sn — sulama gününde gün içi ilerleme, boru akışı, şerit genişlemesi açıkken (`e2e/sulama-harita.spec.ts › performans`). Oynatırken cam bulanıklığı kapanır (aynı kural: `lib/cam.ts`). İlk ölçüm 11 fps idi (backdrop-filter her karede yeniden bulanıyordu); düzeltme sonrası 65 fps.

**Animasyon bütçesi:** yalnız sulama/yağış gününde: vana halkası (CSS), ıslanan şerit genişlemesi (200 ms), vana dolgu/taç rengi geçişi (200–250 ms), boru akışı (≈ 11 fps kesik çizgi), yağış damlaları (2B tuval, rAF). `prefers-reduced-motion`: oynatma düğmesi kapalı, halka/geçiş/yağış/akış yok; durum kartı ve etiket yazıyla söyler (e2e sınar).
