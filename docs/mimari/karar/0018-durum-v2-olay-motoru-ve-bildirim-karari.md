# 0018 — Durum v2, olay motoru, bildirim karar katmanı ve kesintisiz canlılık eğrisi (Adım 9F)

Durum: kabul edildi. Tarih: 2026-10-14.

## Bağlam
9C–9E ile bahçe için çok kaynaklı veri (Sentinel-2, Sentinel-1, Landsat, ERA5, SMAP/IMERG doğrulama) kuruldu. 9F bunları **karara** çevirir: tek kademe (Durum v2), tarihlenmiş olaylar (olay motoru), bildirim kararı ve bulutlu dönemde kesintisiz bir canlılık eğrisi. Tüm eşikler katalogda «ön değer · mühendis onayı bekliyor»; kodda tarım sabiti yoktur.

## Kararlar

### 0. Veri besleme (9F-0)
1. **ERA5 besleme işi:** bahçe eklenince (ya da sınırı değişince) arka planda ERA5 geçmişi 2015'ten, ardından toprak profili (SoilGrids) ve SMAP/IMERG doğrulama doldurması başlar (`jobs/feed.py`; `JOB_BACKEND=arq` ise Redis'e `feed_garden_water` olarak konur). Günlük artımlı işler (arq cron): `refresh_era5` 04:00 (hücre başına bir kez; son ERA5-Land gününden 10 gün geriden + model tahmini), `refresh_hls` 02:00, `refresh_validation` 05:00, `refresh_events` 06:00, `send_digest` her saat. Hepsi idempotent (upsert / eksik gün); hata günlüğe yazılır, ertesi gün yeniden denenir. Test ağsızlığı için `ERA5_CLIENT` / `HLS_CLIENT` yalnız `API_DEBUG=true` iken kabul edilir.
2. **Kök bölgesi doluluğu ağırlıkları** kalınlık yerine **kök dağılımı** (ön değer): 0–7 cm %15, 7–28 cm %35, 28–100 cm %50, 100–255 cm %0.

### A. Durum v2
3. Sonuç **kademe**dir (İyi · İzle · Dikkat · Sorun); iç puan arayüze ve API'ye çıkmaz. Beş bileşen, her biri bahçenin **kendi dönem normuna** göre (aynı takvim ayı, diğer yılların sahneleri; ortanca/MAD sapması, **yalnız aşağı yön ceza**): Ağaç gücü %35 (NDVI) · Su %25 (NDMI + dönem normuna göre kök bölgesi doluluğu; radar girmez) · Beslenme %20 (NDRE) · Ani değişim %10 (S2 düşüşü + yüksek güvenli radar adayı) · Isı %10 (Landsat yüzey–hava farkı, aynı ay bandı, karışık piksel değilse).
4. **Su birleştirme:** NDMI ve doluluk cezasının ortalaması; ikisi de normalin altındaysa ikisinin **kötüsü**.
5. **Tek etiket kuralı (her bileşende aynı):** p25–p75 normal · p10–p25 / p75–p90 «normalin altı/üstü» · <p10 / >p90 «belirgin». Etiket bileşenin kendi dağılımından gelir (indeksler: aynı ay geçmişi; Su: NDMI ve doluluk etiketleri; doluluk için dönem dağılımı p10/p25/p75/p90; Isı: aynı ay yüzey–hava farkı). Su etiketi puanla tutarlıdır: ikisi de düşükse kötüsü, yalnız biri düşükse en çok «normalin altı». **Ani değişim** dağılım değil olay sayımıdır (olay yok = normal; yalnız radar = normalin altı; optik düşüş = belirgin). Isıda yukarı yön kötüdür; diğerlerinde yukarı etiketler gösterim içindir, ceza yoktur.
6. **Risk tavanı:** orta risk → en fazla İzle; yüksek risk → en fazla Dikkat; kırmızı hava uyarısı en az Dikkat (v1'den miras). Daha kötü kademe yükseltilmez.
7. **Güven:** S2 > 15 gün ya da Landsat > 30 gün bayat bileşenin ağırlığı kalanlara dağıtılır, güven düşer; kullanılabilir ağırlık < %40 ise kademe «veri yok» (risk varsa riskten).
8. **Tek kademe:** Durum sekmesi (`/durum`) hesaplar ve `garden_status_snapshots`'a yazar; bahçe listesi ve kademe düşüşü bildirimi aynı kaydı okur (liste = Durum sekmesi). v1 kodu (`score.assess`) API'den çıkarıldı, modül 9G'de silinecek.
9. «Nasıl hesaplandı?»: en çok 3 cümle — kademeyi en çok düşüren 1–2 bileşen · veri tarihleri · güven. Sayı yok.

### B. Olay motoru
10. Tablolar `events` + `event_sources`. **Olay kaynak kayıtlarını kopyalamaz**: `event_sources` `change_events.id`, `acquisitions.id` ve `era5_daily` (hücre:tarih) kayıtlarına kimlikle referans verir; yanıttaki radar alanı gösterimde kaynaktan okunur. Olay kimliği `tur:başlangıç` sabittir (bildirim dedupe'u buna bağlanır).
11. **Kaynaklar ve eşikler (katalog `olay`):** don ≤ 0 °C (≤ −2 °C şiddetli, ERA5-Land/tahmin saatlik 2 m); aşırı yağış 24 saatte ≥ 50 mm (yuvarlanan pencere); kuvvetli rüzgâr hamle ≥ 60 km/s; radar yalnız **güven ≥ orta** adaylar (ıslaklık notlu «düşük» olay değildir; 9D'deki «normal» adı «orta» yapıldı).
12. **S2 ani düşüş (mevsimden arındırılmış):** piksel Δ ≤ −0,08 **ve** değeri pikselin DİĞER yılların aynı ±15 günündeki kendi p10'unun altında (Δ tek başına yetmez; en az 8 örnek); en büyük bitişik yama ≥ min(%25, 5 da); iki net görüntü ≤ 30 gün arayla. **Kalıcılık:** sonraki net görüntüde yama piksellerinin ≥ %50'si hâlâ p10 altında olmalı; aksi (ya da sonraki görüntü yoksa) **atmosfer şüphesi** olarak ayrı kaydedilir, olay değildir. **Tüm bahçe:** bahçenin > %90'ı düşüyorsa ±5 gün içinde hava olayı ya da radar yoksa şüphe. Şüpheler birleşmez, bildirilmez, güveni düşüktür; `events.durum = 'suphe'`. **En son sahnedeki düşüş** (sonraki net görüntü henüz yok, ≤ 30 gün) **şüphe değil «doğrulama bekliyor»dur** (`durum = 'bekliyor'`): olay listesinde kendi rozetiyle görünür, önemli düzeyde (özette) bildirilir; sonraki net görüntü doğrularsa aynı olay kimliğiyle olaya yükselir (bildirim tekrarlanmaz), doğrulamazsa bildirim «atmosfer» notuyla kapanır. 30 günden uzun süredir sonraki görüntü yoksa şüphe (teyit edilemedi).
12b. **Don → S2 bağlama (asimetrik pencere, `don_hasar_gun` = 21):** S2 düşüşünün *başlayabileceği* aralık [önceki görüntü + 1 gün, düşüşü gören görüntü] don bitişinden sonraki 0..+21 günle kesişiyorsa düşüş o dona bağlanır: **«don + optik hasar izi»**, güven yüksek (hava + uydu). Don öncesi başlayan ya da 21 günden sonra başlayan düşüş ayrı olaydır. Bahçenin > %90'ı düşen bir olay için önceki 21 gündeki don da «destek»tir.
13. **Birleştirme:** ±5 gün içindeki sinyaller tek olay olur (en çok 10 gün yayılır); baskın tür don > yağış > rüzgâr > S2 > radar. **Güven:** kaynak ailesi başına en iyi sinyal (orta = 2, düşük = 1) toplanır; ≥ 4 yüksek, ≥ 2 orta. **Geçmiş rüzgâr güven = düşük** (ERA5 31 km hamleyi olduğundan düşük gösterir); ileriye dönük rüzgâr uyarısı Open-Meteo tahmin hamlesinden gelir (güven orta).
14. Geçmiş olaylar 2015'ten hesaplanır (`scripts/compute_events.py`; dry-run varsayılan, kapsam zorunlu, yedek). Çiftçi doğrulama listesi: `docs/agro/olay-dogrulama.md` (`scripts/export_event_validation.py`).

### C. Bildirim karar katmanı
15. **Önem:** kritik (don, şiddetli ya da çok kaynaklı yüksek güvenli olay, yüksek risk) · önemli (kademe düşüşü, orta risk, olay) · bilgi. Eski «uyarı» adı «önemli» oldu.
16. **Teslim:** kritik **anında** (kanallara iletilir; sessiz saatte de); önemli ve bilgi **günlük tek özette** (07:00 yerel; özet sessiz saatte 22:00–07:00 üretilmez; geç kalan iş özeti yine o gün üretir). Özet maddeleri `teslim = ozet` kayıtlarıdır, listede görünmez; özet kartı kapsadığı maddeleri taşır.
17. **Tekrar yok:** olay `olay:<bahçe>:<anahtar>`, kademe `kademe:<bahçe>:<eski>><yeni>:<gün>`, risk `risk:<bahçe>:<kod>` anahtarlarıyla tekildir. Orta risk özette bekler; yüksek olursa kritik olur ve anında listeye çıkar. Taze olay (bitişi ≤ 3 gün) bildirilir; düşük güvenli olay bildirilmez; tahmin donu mevcut hava uyarısı yolundan gelir (çift bildirim yok).
18. **Kanal soyutlaması:** uygulama içi şimdilik; `channels.registry` aynı şablon metnini taşır (WhatsApp/SMS Adım 18'de takılacak). Metinler **şablon + veri**dir (`templates.py`); serbest metin üretimi yoktur. Kullanıcı tercihleri (tür bazında aç/kapat) geçerlidir; yeni türler: olay, kademe düşüşü, günlük özet.

### D. Kesintisiz canlılık eğrisi
19. **Gözlemler:** Sentinel-2 (10 m, bahçe NDVI ortancası × geçerli piksel oranı) + **HLS v2.0** (Planetary Computer `hls2-s30`/`hls2-l30`, 30 m; Fmask ile bulut/gölge/kar/yüksek aerosol maskelenir; ağırlık 0,6 × geçerli oran). **Kaynak yoklaması:** PC arşivi **2020-01-01'den** başlar; öncesi için LP DAAC (earthaccess) gerekir — 2020 öncesinde eğri yalnız Sentinel-2'ye dayanır (daha seyrek gözlem, daha geniş bant). HLS satırı sahne başına bir kez saklanır (ızgara yok); bulutlu sahne boş NDVI ile kaydedilir (yeniden okunmaz).
20. **Yumuşatma:** ağırlıklı Whittaker (ikinci fark, λ = 300); gözlemsiz günler ağırlık 0. **Belirsizlik bandı:** artık dağılımından (1,4826·MAD) %90 yaklaşık bant, en yakın gözleme uzaklıkla √(1 + (d/10)²) genişler — **sezgiseldir, istatistiksel güven aralığı değildir.** Gözlemden > 6 gün uzak günler «tahmini» (üç günde bir gözlem olan dönemde çizim kesikliklerle dolmasın); son gözlemden sonra en çok 30 gün uzatılır.
21. **Radar NDVI üretmez:** optik gözlemin > 12 gün olmadığı boşluklarda radar geçişi için yalnız «değişim var / yok» işareti çizilir.
22. **Gösterim:** dolu nokta = gerçek gözlem; kesikli çizgi + soluk bant + «tahmini» etiketi = tahmin. **Kademe eğriye değil yalnız gerçek gözleme dayanır.** Durum'daki sezon eğrisi (canlılık) ve Geçmiş (9G) bu seriyi kullanır.

## Sonuçlar (jlnnlk, 2015–2026)
- Olaylar (yeniden yazılmış S2 kuralı + don bağlama): don 8 (biri «don + optik hasar izi») · aşırı yağış 7 · rüzgâr 10 (hepsi güven düşük) · S2 ani düşüş 2 · radar 4 · atmosfer şüphesi 7 (doğrulama bekleyen düşüş şu an yok). Eski kural (mevsimden arındırmasız) 30 S2 «olay» üretiyordu; 18'i Oca–Nis'teydi (mevsimsel örtü değişimi).
- Tek yüksek güvenli olay: 7–13 Ocak 2020 (aşırı yağış + radar).
- HLS: 944 sahne (2020→), 577'sinde geçerli NDVI.

## Sınırlar (dürüstçe)
- **Don/yağış/rüzgâr 9–31 km ERA5 ızgarasından gelir;** bahçeye birebir ölçüm değildir. Hamle ERA5'te düşük çıkar (geçmiş rüzgâr olay sayısı eksiktir). İki bahçe aynı hava hücresini paylaşır.
- Dönem normu için bahçenin en az 8 (piksel) / 12 (bileşen) geçmiş örneği gerekir; 2015–2016 yıllarında olay üretilemeyebilir.
- S2 düşüşü kalıcılık için sonraki net görüntüyü bekler; en güncel düşüş «teyit bekliyor» şüphesidir.
- Eşikler ve ağırlıklar ön değerdir; çiftçi doğrulaması (`olay-dogrulama.md`) sonrası ayarlanacaktır.
- Whittaker bandı sezgiseldir; gözlem seyrekken (özellikle 2020 öncesi) tahmin güvenilmezdir ve bu yüzden kesikli çizilir.
