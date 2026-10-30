# Agro kuralları — doğrulama durumu

Kaynak dosya: `bahcelab-backend/src/bahcelab_backend/domain/agro/rules/katalog.yaml` (sürüm 2).
Bir kural mühendis tarafından onaylanınca ilgili bloğun `durum` alanı `muhendis_onayli`, `onaylayan` ve `onay_tarihi` doldurulur (doğrulayıcı olmadan yüklemeyi reddeder).

## Adım 8A — doğrulanmamış kurallar (tümü "ön değer – ziraat mühendisi onayı bekleniyor")

| Kural | Kapsam | Değer (ön) | Kaynak notu | Durum |
|---|---|---|---|---|
| Fenoloji evreleri | limon, portakal, mandalina, greyfurt (tüm çeşitler ürün değerini miras alır) | Kış dinlenmesi 15 Ara–15 Şub · Tomurcuklanma 16 Şub–14 Mar · Çiçeklenme 15 Mar–30 Nis · Meyve tutumu 1 May–15 Haz · Meyve büyümesi 16 Haz–30 Eyl · Olgunlaşma ve hasat 1 Eki–14 Ara | Akdeniz kuşağı narenciye fenolojisinin genel yaklaşık takvimi; bölge/yıl/çeşide göre ±3 hafta | doğrulanmadı |
| Kc (evre bazlı) | aynı ürünler | 0,65 (kış, tomurcuklanma, büyüme, olgunlaşma) · 0,70 (çiçeklenme, meyve tutumu) | FAO-56 Tablo 12 narenciye (başlangıç 0,70 · orta 0,65 · son 0,70) değerlerinden evrelere dağıtım | doğrulanmadı |
| GDD tabanı | aynı ürünler | 12,5 °C | Narenciyede yayınlarda 10–13 °C arası taban kullanılır; 12,5 ön değer | doğrulanmadı |
| Narenciye dışı ürün ("diger") | — | kural tanımlı değil | Arayüz "veri yetersiz / kural yok" der | — |

Çeşit düzeyinde ayrı değer girilmemiştir (Enterdonat, Kütdiken, Lamas, Meyer, Yediveren, Washington Navel, Valencia, Satsuma, Klemantin, Star Ruby): hepsi ürün değerini kullanır; yapı çeşit bazlı değer (`fenoloji`/`kc`/`gdd`) eklemeye hazırdır. Yediveren için "yıl boyu çiçek verebilir" notu vardır.

## Skor parametreleri (kural değil, ürün ayarı — `config.py`)
Ağırlıklar canlılık %40 · yaprak suyu %20 · uyarılar %20 · hava %20; etiket eşikleri İyi ≥ 75, İzle ≥ 50; tolerans: aralığın %5'i, sıfır puan: %30'u. Bunlar tarımsal eşik değil istatistiksel sezgidir; mühendis onayı gerektirmez ama yayın öncesi gözden geçirilmelidir.

## Adım 8B — doğrulanmamış kurallar (hepsi "ön değer – ziraat mühendisi onayı bekleniyor")

Dosyalar: `rules/sulama.yaml`, `rules/riskler.yaml`.

| Kural | Değer (ön) | Kaynak notu | Durum |
|---|---|---|---|
| Etkili yağış | günlük yağış < 2 mm sayılmaz; eşiği aşanın %80'i etkili; günlük üst sınır 40 mm | Genel yaklaşım; toprak tipi/eğime göre uyarlanmadı | doğrulanmadı |
| Sulama sistemi verimliliği | damla 0,90 · yağmurlama 0,75 · salma 0,60 · sistem yok: verimlilik uygulanmaz | Yaygın literatür aralıkları | doğrulanmadı |
| Sulama hesabı | ETc = ET₀ × Kc − etkili yağış; son 7 gün açığı; önümüzdeki 7 gün ihtiyacı; 1 mm = 1 ton/dekar; ihtiyaç eşiği 5 mm | Kc: katalog (FAO-56 tabanlı ön değer) | doğrulanmadı |
| Akdeniz meyve sineği | Kuşak/döngü bazlı GDD (taban 10 °C, 1 Mart'tan; 400 GDD'de sayaç sıfırlanır, sonraki kuşak sayılır); seviye = son 10 günün aktivitesi (günlerin ≥ %70'i 16–32 °C) × meyvenin duyarlı evresi (büyüme/olgunlaşma) → «orta – tuzak kontrolü önerilir»; «yüksek» YALNIZ tuzak verisi eşiği aşınca (orta ≥ 2, yüksek ≥ 5 adet/tuzak/hafta; Adım 12 bağlar) | GDD'ye dayalı genel bölgesel yaklaşım; eşikler ön değer | doğrulanmadı |
| Kırmızı örümcek | sıcak gün: Tmax ≥ 30 °C; kuru gün: yağış < 1 mm (ve bilinen tahmin günlerinde nem ≤ %50); art arda ≥ 4 gün orta, ≥ 7 gün yüksek | Sıcak-kuru gün serisinin popülasyonu hızlandırdığı yönünde genel gözlem | doğrulanmadı |
| Kuruma hastalığı (mal secco) — yalnız limon | orta: yağış ≥ 5 mm ve rüzgâr ≥ 20 km/s; yüksek: ≥ 10 mm ve ≥ 30 km/s; ortalama sıcaklık 14–28 °C; risk penceresi koşuldan sonra 3 gün | Yağmur + rüzgâr + ılık sıcaklıkta enfeksiyon olasılığı artar (genel bilgi) | doğrulanmadı |
| Tuzak sayımı | arayüz hazır, değer yok (Adım 12) | — | — |

Bu çıktılar teşhis ya da ilaçlama/sulama reçetesi değildir; arayüzde "risk tahmini" / "yaklaşık öneri" dilindedir.


## Yıl boyu simülasyon (8B düzeltmesi)
`scripts/simulate_risks.py` ve `tests/test_agro_risks.py::test_year_simulation…`: Open-Meteo arşivinden alınmış gerçek 2025 günlük verisiyle (`tests/fixtures/weather_2025_mersin.json`) her gün «o gün bugün olsaydı» çalıştırılır; hiçbir kural yılın %30'undan fazlasında «yüksek» olamaz (testle zorunlu).

## Adım 9A — çok yıllık analiz penceresi (doğrulanmadı)
| Kural | Değer (ön) | Kaynak notu | Durum |
|---|---|---|---|
| Yıllık kompozit penceresi (narenciye) | Haziran–Eylül, NDVI, net sahnelerin piksel medyanı | Herdem yeşil narenciyede yazın sıra arası otlar kuruduğundan ağaç tacı sinyali baskın; Akdeniz'de bulutlu sahne az. Dosya: `rules/katalog.yaml` → `analiz_penceresi` | doğrulanmadı |

Bölgeleme eşikleri (yıl uyum korelasyonu 0,5; homojenlik %8; en küçük bölge 500 m²; yumuşatma 1,5 piksel; istikrar yüksek ≥ %75 / orta ≥ %50) tarımsal kural değil istatistiksel ayardır (`config.py`, `multiyear_*`).

## Adım 9H — sulama planı (`sulama_plani` bloğu; hepsi «ön değer · mühendis onayı bekliyor», ADR 0023)

| Kural | Değer (ön) | Kaynak notu | Durum |
|---|---|---|---|
| Kc tablosu (narenciye, yer örtüsüz) | taç örtüsü %20: 0,50-0,45-0,55 · %50: 0,65-0,60-0,65 · %70: 0,70-0,65-0,70 (başlangıç-orta-son) | FAO-56 Tablo 12; mühendis kaynaktan teyit etmeli | doğrulanmadı |
| Aylık evre ağırlıkları | Oca-Şub başlangıç · Mar-May gelişme · Haz-Eyl orta · Eki-Ara son | FAO-56 Tablo 11 alt tropik evre sırası; yerel fenolojiyle uyarlanmadı | doğrulanmadı |
| Taç örtüsü ← NDVI | 0,30 → 0,85, üs 1 | Carlson & Ripley (1997) ilişkisinin doğrusal hâli | doğrulanmadı |
| Kök derinliği, tükenme oranı p | 80 cm · 0,5 | FAO-56 Tablo 22 aralığı; Su sekmesiyle aynı | doğrulanmadı |
| Etkili yağış | günlük < 2 mm sayılmaz; üstünün %80'i | basit eşik yöntemi; USDA-SCS henüz yok | doğrulanmadı |
| Sistem verimi | damla 0,90 · mini yağmurlama 0,80 · salma 0,55 | literatür ortalamaları | doğrulanmadı |
| Kısıntılı sulama dönemleri | çiçeklenme–tutum ve hızlı meyve büyümesi **kilitli**; olgunlaşma onaylı, oran 0,75, verim riski düşük | ön değer; mühendis onayı olmadan genişletilmez | doğrulanmadı |
| Bildirim eşikleri | sulama günü 1 gün önce · sapma > 20 mm (14 gün) | ön değer | doğrulanmadı |
| Ağaç sayısı tutarlılığı | beyan ↔ alan/(sıra×ağaç) farkı > %15 uyarı | ön değer | doğrulanmadı |
| EPDK tarımsal sulama tarifesi | **fiyat ve geçerlilik tarihi boş** (doğrulanamadı) | kaynak: epdk.gov.tr tarife tabloları; doğrulanınca fiyat + tarih + kaynak ile doldurulur | **doğrulanamadı** |
