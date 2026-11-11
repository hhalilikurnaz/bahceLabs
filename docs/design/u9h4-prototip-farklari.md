# Prototip panosu ↔ Dilim 1: görsel karşılaştırma ve düzeltme listesi

Referans: `docs/design/prototip/sulama/` (6 PNG + 2 statik HTML; 1440×900). Karşılaştırılan: Dilim 1 jlnnlk ekranları (`u9h4-ekranlar-jlnnlk.pdf`). Durum: ✓ karşılandı · ◐ kısmen · ✗ yok. «→ D1» = Dilim 1 düzeltmesi, «→ D2» = Dilim 2'ye katıldı, «karar» = kullanıcı kararıyla kapsam dışı.

## A. Panel (sağ sütun)
| # | Prototip | Dilim 1 | Karar / iş |
|---|---|---|---|
| A1 | Başlıkta küçük «Su» + büyük «Sulama»; **Bugün \| Simülasyon** segmenti başlığın sağında; KPI'lar sekmenin altında | Başlık yok; «← Su» + «Sulama bilgileri» düğmesi; sekmeler KPI'lardan sonra | → D1 |
| A2 | 3 KPI kartı; «İhtiyaç karşılandı» ve «Sezon suyu» kartlarında ilerleme çubuğu; «Şimdi» durumu | Çubuk yok | → D1 (çubuk + «Şimdi») |
| A3 | Büyük karar cümlesi **KPI'ların altında**, Bugün sekmesinde; Simülasyon'da karar yok | Karar bloğu en üstte, iki sekmede de | → D1 |
| A4 | Tek cümle: «Vanalarda kök bölgesi %92–%100 dolu. Eşiğe yaklaşırsa bir gün önceden haber veririz.» | «En kuru vana bahçe %93…» (tek vanada anlamsız) | → D1: tek vanada «Kök bölgesi %93 dolu; 10 gün içinde eşiğe inmesi beklenmiyor.» |
| A5 | Uyarı kutusu yok | 3 ayrı «Not» kutusu panelin üstünü kaplıyor | → D1: tek satır «Eksik bilgi (3) · Tamamla →» |
| A6 | 7 gün şeridi: her gün için küçük **tüp** (doluluk), % ve yağış mm | Düz kutucuk, % ve yağış | → D1 (tüp göstergesi) |
| A7 | «Sonraki program» Gantt: saat ekseni 04:00–22:00, vana çubukları, «şu an» çizgisi, «Pompa çalışıyor · 7,5 kW · 10 m³/sa» | Tablo (saat · süre · m³) | → D2 (Gantt, canlı çizgi) |
| A8 | Yıl seçici 2019–2025, nokta ile kuru/normal/ıslak | Yıl düğmeleri yalnız 3 yılda etiketli | → D1: 2015–2025 boylu sütunlar (yağışa göre) |
| A9 | Plan \| Alışkanlığım ve Damla \| Mini \| Salma aynı satırda; **Kısıntı anahtarı** (toggle) + kilitli dönem açıklaması + kWh **−/+ adımlayıcı** | Segmentler iki satır; onay kutusu; serbest metin kutusu | → D1 (toggle + adımlayıcı) |
| A10 | 4 sayaç (Su, Elektrik TL·kWh, Stres, Boşa giden) | ✓ benzer | — |
| A11 | Toprak suyu grafiği: lejant (V1 %95 …), eksen %100/%65/%30, «tarla kapasitesi (dolu)», «sulama eşiği», «ideal aralık», «stres» | ◐ doğrudan etiket; eksen 0–100 | → D1: eksen %30–100 (altı kesik işaretiyle); band etiketleri sağda |
| A12 | Su dengesi: her gün etiketli, sulama koyu yeşil | ✓ benzer | — |
| A13 | Plan–alışkanlık karşılaştırması: çubuk çiftleri (+fark), tek cümle («455 TL daha pahalı, 821 m³ su boşa gider, ağaç 25 gün daha susuz kalır») | Tablo + cümle | → D1: çubuk çiftleri |
| A14 | Güven satırı | ✓ | — |
| A15 | Büyük sayılar tek kaynaktan: panel ↔ kart tutarlı | ✗ **Su kartı %100 (ERA5-Land) ↔ panel %93 (kova)** | → D1: büyük sayı kovadan; ERA5-Land küçük referans satırı; tutarlılık testine eklendi |
| A16 | Sezon suyu «%54 · tahmin 12.690» | «Plan 4.713 · planlanan» | → D1: kayıt yoksa «Plan X · uygulanan: kayıt yok», varsa «Uygulanan X · plan Y» |

## B. Harita (hepsi Dilim 2)
| # | Prototip | Dilim 1 | Karar / iş |
|---|---|---|---|
| B1 | Parsel dışı karartma/blur; bearing parsel uzun eksenine döner | Yok | ✓ **D2 yapıldı**: kb-dim %50 + `backdrop-filter` blur (hareket sırasında kapanır), bearing 250 ms, çıkışta 0 |
| B2 | Sektör dolgusu rengi (3 gösterge) + dik etiket «V3 · %86 / sulanıyor · %58» | Yok | ✓ **D2 yapıldı** —  (dolgu rengi + etiket birlikte; ayrı ışık simgesi **yok**, karar) |
| B3 | Ağaç sıraları, damla hatları, ıslanan şerit, ana boru, vana halkaları (V1–V3), pompa | Yok | ✓ **D2 yapıldı** (pompa/boru yalnız çizildiyse) — : sıralar dikim aralığı + sıra yönünden («dikim aralığından çizildi · varsayım»); pompa ve ana boru **yalnız çizilmişse** (karar) |
| B4 | Cam kartlar: sol üst durum, sağ üst gösterge+lejant+katmanlar, sağ alt ölçek+kuzey, sol alt not | Yok | ✓ **D2 yapıldı** |
| B5 | Alt çubuk: ▶/❚❚, 1×/3×/8×, önceki/sonraki sulama, Bugün, sezon şeridi | Yok | ✓ **D2 yapıldı**: `AltCubuk.tsx` (tıkla-git, ← → Shift Boşluk, mobil kompakt) |
| B6 | Animasyon: vana halkası, hat/boru akışı, ıslanan şerit, yağmur, sararan taç | Yok | ✓ **D2 yapıldı** (hareketi azalt: kapalı) —  (reduced-motion'da kapalı) |
| B7 | Haritadan aksiyon | Yok | ✓ **D2 yapıldı** — : sektöre tıkla → panel o vanaya odaklanır; [Bu vanaya kayıt işle] [Bu vanayı programa ekle] |
| B8 | «Doldur» bandı (CropX) | — | **karar:** gerekmez, sulama eşiği çizgisi yeterli |
| B9 | Trafik ışığı simgesi (IriWatch) | — | **karar:** dolgu rengi + etiket metni yeterli, ışık simgesi yok |

## C. Dilim 2'ye eklenen (prototipte olmayan, istenen)
Vana çizim aracı (bölme çizgileri, ad, debi, isteğe bağlı pompa noktası ve ana boru); vana başına Sentinel-2 taç örtüsü → Kc (10 m piksel ortalaması, piksel sayısı ve bulut maskesi oranı panelde); mobil yerleşim (harita %45, sabit alt çubuk).

**Not:** prototipte «Kısıntı olgunlaşmada %75 · çiçek/tutumda kilitli» ve tek sayı yerine «tasarruf + stres + risk» ilkesi (Dilim 1 düzeltmesi) birlikte korunur: kısıntı açıkken su farkı hiçbir yerde stres günü farkı ve verim riski olmadan gösterilmez.


**D2 durumu (2026-11-11):** B1–B7 yapıldı; B8/B9 karar gereği yok. Ekranlar ve ilke tablosu: [u9h4-d2-ekranlar.pdf](u9h4-d2-ekranlar.pdf), [u9h4-d2-ilkeler-tablosu.md](u9h4-d2-ilkeler-tablosu.md).
