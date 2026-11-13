# 0030 — Veri ve model kalitesi izleme (9J Dilim 1)

Durum: kabul edildi. Tarih: 2026-11-13. İlgili: ADR 0024 (güven etiketi), ADR 0026 (geçici günler), ADR 0028 (ETa iç kalite), ADR 0029 (sistem kontrol), `docs/agro/KURAL-DURUMU.md` (Adım 9J).

## Karar
Veri akışlarının ve kuralların sağlığı **koda bağlanır**: akış tazeliği, her yazımda veri kontrolü, kaynaklar arası kayan sapma, kural performansı, tek güven servisi ve «altın bahçe» snapshot testi. Eşikler **katalogda** (`izleme`, ön değer · mühendis onayı bekliyor). Dilim 1 backend'dir; arayüz Dilim 2.

## 1) Akış tazeliği (`domain/izleme/akis.py`)
Her kaynak için **beklenen sıklık, kabul edilebilir gecikme, kopuk eşiği** katalogda (ERA5, Open-Meteo tahmin, IMERG, Meteostat, Sentinel-2, Sentinel-1, Landsat, SMAP, WaPOR L1, ECOSTRESS, EPDK tarife/fiyat akışı). Son veri günü gerçek tablolardan (`era5_daily` kesin gün, `dogrulama_gozlem`, `station_daily`, `acquisitions`, `eta_*`, katalog); gecikme ≤ kabul → **taze**, ≤ kopuk → **gecikmeli**, aksi **kopuk**, hiç veri yok → **boş**. Günlük seriler için pencere içi **boşluk günü** sayısı; `feed_runs`'tan son başarı zamanı. Günlük iş anlık görüntüyü `izleme_akis`'e yazar. **İç uyarı:** KOPUK hemen; GECİKMELİ `uyari_ardisik_gun` (2) ardışık günse → `INTERNAL_EMAILS`'teki kullanıcıların çalışma alanına işletme bildirimi (anında; tekil anahtar). Fiyat akışı: katalogda tarife birim fiyatı/tarihi boşsa **boş** (sayı uydurulmaz).

## 2) Veri kontrolleri (`veri_kontrol.py`) ve KOVA KURALI
Aralık (ör. yağış 0–300 mm/gün, ET₀ 0–12, NDVI −1..1, Tmax −30..55 °C), ani sıçrama, eksik gün, birim ipucu (Kelvin) denetlenir; **değer silinmez**, `veri_bayrak`'a yazılır (idempotent). Tarama günlük iş olarak (son 3 gün) ve istendiğinde koşar.
- **SERT (imkânsız, aralık dışı) bayraklı yağış ve ET₀ KOVAYA GİRMEZ**: `rain_series.gecmis_hava` o günü *veri eksik* sayar (400 mm yağış planı çarpıtmaz). Ham değer veritabanında kalır.
- **YUMUŞAK (şüpheli: sıçrama, eksik gün) bayraklı değer kovaya GİRER**; bayrak güven servisinde görünür.
Gerekçe: imkânsız değer fiziksel olarak yanlıştır, şüpheli değer gerçek olabilir (ani fırtına); gerçeği silmek de çarpıtmaktır.

## 3) Kaynaklar arası tutarlılık (haftalık, `uyum.py`)
Kayan sapma (drift) serileri (`izleme_uyum`): **ERA5↔Meteostat Tmax** (son 90 gözlem günü ↔ 1A'daki taban sapma; +4–5 °C düzeltmesi kayıyor mu; eşik 1,0 °C), **ERA5↔IMERG aylık yağış oranı** (son 3 ay ↔ önceki 12 ay medyanı; göreli eşik %35), **yağmur ölçeri↔ERA5** (kayıt varsa), **model ETc↔WaPOR L1 dekad oranı** (göreli eşik %40). Yeterli veri yoksa durum **yetersiz** (drift uydurulmaz). Drift → iç uyarı (haftalık tekil anahtar).

## 4) Kural performansı (`kural_performans.py`)
Aylık seri: üretilen, yanıt, yanıt oranı, yanıtı olanlarda isabet. Kurallar: sulama önerisi, sistem kontrol işareti, don (uyarı + olay), hastalık/zararlı riski, olay ön doğrulaması (9G-E). **Yanıt mekanizması olmayan ya da yanıt sayısı `kural_min_yanit` (5) altındaki kural «ölçülemiyor» görünür; isabet uydurulmaz (None).** Sulama önerisinde yanıt = ±2 gün içinde uygulanan sulama kaydı (uygulama oranı); isabet yer gerçeği olmadığından ölçülemiyor.

## 5) Tek güven servisi (`guven.py`)
Sulama paneli ve Durum paneli **aynı hesabı** ve **aynı «Güven nasıl hesaplandı?» metnini** kullanır. Koşullar: uydu görüntüsü taze · hava verisi güncel · bu bahçeyi besleyen akışlar kopuk değil · geçici gün sayısı az (≤ 8/30 gün) · beyan/profil eksiksiz · kaynaklar uyumlu (drift yok) · şüpheli (sert) ölçüm yok · kural geri bildirimi olumlu. Her koşul sağlandı / sağlanmadı / **ölçülemiyor (paydadan çıkar)**. Etiket = sağlanan/ölçülebilen: ≥ %85 yüksek, ≥ %55 orta, aksi düşük. Not: «Güven: orta (3/5)» ifadesi artık (n/m) ölçülebilen koşul sayısıdır; eski 5 koşul bu kümenin parçasıdır. Durum paneline ek koşul olarak «durum bileşenlerinin verisi yeterli» girer.

## 6) Altın bahçe testi (`tests/test_altin_bahce.py`)
jlnnlk'in **donmuş girdileri** (`tests/golden/jlnnlk_girdi.json`: ERA5 2015→2026-10-09, toprak, Sentinel-2 NDVI, NDMI serisi, halka serisi, IMERG; sabit BUGÜN 2026-10-09; sulama profili sabit örnek) test veritabanına yüklenir; kova/plan, kuru Kc, KPI, sistem kontrol işareti ve güven çıktıları `tests/golden/jlnnlk_beklenen.json` ile karşılaştırılır (yüzdeler ±0,6, diğer sayılar ±%2 ya da 0,02, metinler birebir). Fark eşiği aşarsa **CI kırmızı**. Bilinçli değişiklikte `ALTIN_GUNCELLE=1` ile snapshot yenilenir ve **gerekçeli commit** (`golden: …`) atılır.

## Sınırlar
- Eşikler ön değerdir; ilk haftalık koşular gerçek sapmaları gösterecek, eşikler bu veriyle gözden geçirilir.
- Akış tazeliği tablo tabanlıdır (kaynağın kendi sağlık denetimi değil); ECOSTRESS/WaPOR/Meteostat gibi seyrek kaynaklarda «kopuk» eşikleri geniştir.
- Altın bahçe jlnnlk'in toprak ve geçmiş verisine bağlıdır; veri kaynağı (örn. ERA5 sürümü) değişirse girdi dosyası bilinçli yenilenir.
