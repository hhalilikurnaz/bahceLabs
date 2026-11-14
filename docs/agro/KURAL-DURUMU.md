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
| Sistem programı (tetik, tek seferde miktar) | tetik: damla 0,8 · mini yağmurlama 0,9 · salma 1,0 × RAW (**alt sınır 0,8; altı katalog yüklemeyi reddeder**); azami net: 8 · 20 · 70 mm | kova RAW'a yaklaşmadan sulama önerilmez; sık-az damla yalnız tükenme eşiğine göre | doğrulanmadı |
| Kısıntılı sulama dönemleri | çiçeklenme–tutum ve hızlı meyve büyümesi **kilitli**; olgunlaşma onaylı, oran 0,75, verim riski düşük | ön değer; mühendis onayı olmadan genişletilmez | doğrulanmadı |
| Bildirim eşikleri | sulama günü 1 gün önce · sapma > 20 mm (14 gün) | ön değer | doğrulanmadı |
| Ağaç sayısı tutarlılığı | beyan ↔ alan/(sıra×ağaç) farkı > %15 uyarı | ön değer | doğrulanmadı |
| Vana başına taç örtüsü (Kc) — asgari temiz piksel | `kc_vana_min_piksel`: **20** piksel (10 m) | Vana çokgeninin Sentinel-2 NDVI ortalaması birkaç pikselle gürültülü olur; 20 piksel ≈ 0,2 ha. Mühendis gözden geçirmeli | ön değer · mühendis onayı bekliyor |
| Vana başına taç örtüsü (Kc) — asgari geçerli oran | `kc_vana_min_gecerli_oran`: **0,5** (çokgen piksellerinin en az yarısı bulutsuz/geçerli) | Bulut maskesi oranı > %50 olan sahne vana için kullanılmaz; sonraki eski sahne denenir (60 gün geri), yoksa bahçe değeri | ön değer · mühendis onayı bekliyor |
| Harita gösterimi — «fazla su» sınıfı (**hesaba girmez**) | `fazla_su_az_mm`: **2** mm · `fazla_su_cok_mm`: **8** mm (7 günde kökün altına sızan + sistem kaybı; < 2 yeşil, 2–8 sarı, ≥ 8 mavi) | Yalnız harita rengi/yazı sınıfı; plan ve kova hesabını etkilemez. Backend `panel.gosterim` ile ön yüze gelir | ön değer · mühendis onayı bekliyor |
| Harita gösterimi — ıslanan şerit ve taç çizim ölçüsü (**hesaba girmez**) | `gosterim_serit_genislik_m`: **1,0** m (damla) · `gosterim_tac_cap_m`: **3,0** m | Yalnız çizim büyüklüğü; ölçüm değildir, ekranda «varsayım» yazar. Islanan alan/ağaç hesabı yapılmaz | ön değer · mühendis onayı bekliyor |

## Adım 9I — uydudan ETa altyapısı, Landsat/SSEBop (`eta_ic` bloğu; hepsi «ön değer · mühendis onayı bekliyor», ADR 0028; KULLANICIYA AÇILMAZ)

| Kural | Değer (ön) | Kaynak notu | Durum |
|---|---|---|---|
| SSEBop sabitleri | rah 110 s/m · sıcak koşul albedosu 0,23 · cp 1013 J/kg/K · ETf üst sınırı 1,05 · G = 0 (günlük) | Senay ve ark. 2013 (SSEBop); Dilim 0 spike | ön değer · mühendis onayı bekliyor |
| Soğuk referans (c-faktörü tanılaması) | NDVI ≥ 0,7 · bahçeyle ±150 m rakım · bahçe dışı · en az 200 piksel · pencere 12×12 km | Dilim 0: sahne içi Tc kararsız → yalnız c tanısı olarak kullanılır | ön değer · mühendis onayı bekliyor |
| Uzun dönem c-faktörü | c = Tc/Ta; aynı mevsimde (±1 ay) en az 8 sahnenin MEDYANI; yayılım MAD×1,4826 belirsizliğe girer; yeterli sahne yoksa c uydurulmaz (sahne elenir) | SSEBop'un kalibre c yaklaşımı | ön değer · mühendis onayı bekliyor |
| Hava sıcaklığı düzeltmesi | ERA5 Tmax aylık sapması = Meteostat 17340 gözlemi − ERA5 (≥ 20 eşleşen gün; yoksa düzeltme yok) + rakım düzeltmesi 6,5 K/km | ERA5 hücresi kıyı/deniz karışımı (Dilim 0: Haziran Tmax 24,7 °C ↔ LST 37 °C) | ön değer · mühendis onayı bekliyor |
| İç tampon | −15 m (karışık/kenar pikselleri ayrı raporlanır) | 30 m yeniden örneklenmiş, fiziksel 100 m termal | ön değer · mühendis onayı bekliyor |
| Geçiş kalitesi | bahçe pikselinin ≥ %80'i QA-geçerli (bulut/gölge/kar/dolgu hariç) | QA_PIXEL bit 0–5 | ön değer · mühendis onayı bekliyor |
| **Tutarlılık kapısı** | kuru mevsim (Haz–Eyl), ≤ 10 gün arayla ardışık temiz geçişlerde, araya ≥ 5 mm yağış girmeyen çiftlerde **p90 \|ΔETf\| ≤ 0,15**; en az 8 çift. Geçmezse kapı KAPALI: ETa/ETf hiçbir kullanıcı ekranına taşınmaz | Dilim 0 kararı (sahne tutarsızlığı ±0,15 altına inmezse açılmaz) | ön değer · mühendis onayı bekliyor |
| Kullanıcıya açılma (İLERİDE; kapı kapalıyken uygulanmaz) | bahçe ≥ 40 da; «bahçe + çevresi» etiketi + belirsizlik aralığı | Dilim 0 §6 çözünürlük gerçeği (15 da → 0 tam 100 m piksel) | ön değer · mühendis onayı bekliyor |

| EPDK tarımsal sulama tarifesi | **fiyat ve geçerlilik tarihi boş** (doğrulanamadı) | kaynak: epdk.gov.tr tarife tabloları; doğrulanınca fiyat + tarih + kaynak ile doldurulur | **doğrulanamadı** |
| Kısıntıda verim riski yükselmesi | kısıntının eklediği stres günü ≥ 10 → en az «orta»; ≥ 30 → «yüksek» | ön değer; dönem riski tabanda kalır | doğrulanmadı |
| Güven etiketi eşikleri | uydu ≤ 14 gün · hava ≤ 3 gün · 5 koşuldan ≥ 3 orta, 5 yüksek | ön değer (ADR 0024) | doğrulanmadı |
| Durum bantları / ihtiyaç renkleri | stres < %50 · yakın 50–70 · yeterli 70–97 · dolu ≥ 97; ihtiyaç ≥ %95 yeşil, 85–95 sarı | ön değer | doğrulanmadı |
| Yağış serisi | `era5_daily` (IMERG yalnız sistematik farkta); Hava sekmesi dahil TEK seri | ADR 0025; `docs/agro/yagis-kaynak-karsilastirma.md` | karar verildi (istasyon referansı zayıf: 26 km) |
| Bahçe yağış ölçeri düzeltme önerisi | ayda ≥ 5 eşleşen gün · seri toplamı ≥ 10 mm · |ölçüm/seri − 1| ≥ 0,20 · çarpan [0,5; 2,0]; **otomatik uygulanmaz** | ADR 0026 | doğrulanmadı |

## Adım 9I-1B — vana bazında «sulama sistemi kontrol» işareti (`sistem_kontrol` bloğu; hepsi «ön değer · mühendis onayı bekliyor», ADR 0029; KULLANICIYA GÖSTERİLİR)

| Kural | Değer (ön) | Kaynak notu | Durum |
|---|---|---|---|
| Tetik | kova «yeterli/dolu» (Ks = 1) iken NDMI z-skoru **≤ −1,5** ve **art arda 2 bulutsuz sahne** (aralarında ≤ 21 gün) | NDMI (B8A/B11) yaprak suyu göstergesi; Sentinel-2 L2A, SCL bulut/gölge/kar maskeli | ön değer · mühendis onayı bekliyor |
| Taban | AYNI fenolojik evrede, YALNIZ önceki sezonlar; en az **2 farklı sezon** ve **6 sahne**; yoksa işaret üretilmez, nedeni yazılır; std alt sınırı 0,02 | bahçenin (vananın) kendi geçmişi | ön değer · mühendis onayı bekliyor |
| Veri kalitesi | vana pikselinin ≥ %80'i temiz, en az 4 temiz piksel | Sentinel-2 SWIR 20 m yeniden örnekli | ön değer · mühendis onayı bekliyor |
| Vanalar arası karşılaştırma | yalnız bu vana düşüyorsa (diğerleri z > −1,0) güven YÜKSEK; vanaların ≥ %50'si birlikte düşüyorsa (hava/fenoloji) işaret ÜRETİLMEZ; karşılaştırılacak vana yoksa güven ORTA | aynı tarihli z karşılaştırması | ön değer · mühendis onayı bekliyor |
| Kova eşik altındaysa | işaret değil; normal stres mesajı geçerli | plan kovası (Ks) | ön değer · mühendis onayı bekliyor |
| Bildirim | güven yüksek → anında (kritik), orta → günlük özet; aynı vana için yeniden bildirim ≥ 14 gün | ADR 0018 öncelikler | ön değer · mühendis onayı bekliyor |
| Doğruluk ölçümü | kullanıcı yanıtları (`sorun_yok` / `damlatici_tikali` / `baska_sorun`) Saha Defteri'ne «gozlem» kaydı olarak düşer (`sk_yanit`) | kural doğruluğu bununla ölçülür | — |
| **Komşu halka referansı** (tek sektör: ZORUNLU; «vanaların hepsi birlikte düşüyor»: ek kontrol; çok vanalı bahçede güveni yükseltir) | bahçe sınırından **100–300 m** halka; yalnız ağaçlık pikseller (SCL geçerli + **NDVI ≥ 0,5**; bahçenin kendisi, yollar, çıplak toprak, su dışarıda); **en az 30 geçerli ağaçlık piksel** (yoksa işaret üretilmez, nedeni yazılır); halka z (halkanın KENDİ önceki-sezon tabanına göre, aynı evre) **> −0,5** → «düşmüyor». Bahçe/vana z ≤ −1,5 (2 ardışık sahne, kova yeterli) + halka normal → işaret, güven **orta-yüksek**; halka da düşüyorsa ya da referans yoksa işaret yok | ADR 0029 eki; halka ölçümü `sk_halka` (günlük iş `refresh_sk_halka`, panel ağ kullanmaz) | ön değer · mühendis onayı bekliyor |

## Adım 9J — veri ve model kalitesi izleme (`izleme` bloğu; hepsi «ön değer · mühendis onayı bekliyor», ADR 0030)

| Kural | Değer (ön) | Kaynak notu | Durum |
|---|---|---|---|
| Akış tazeliği (beklenen sıklık / kabul gecikme / kopuk, gün) | ERA5 1/7/14 · Open-Meteo tahmin 1/2/5 · IMERG 1/7/14 · Meteostat 30/270/400 · Sentinel-2 5/14/30 · Sentinel-1 6/14/30 · Landsat 8/20/45 · SMAP 2/7/14 · WaPOR L1 10/30/60 · ECOSTRESS 30/90/180 · tarife 90/120/240 | kaynakların yayın takvimi (ERA5-Land ≈ 5–6 gün, Meteostat bulk ≈ 8 ay gecikmeli) | ön değer · mühendis onayı bekliyor |
| İç uyarı | KOPUK → hemen; GECİKMELİ → 2 ardışık gün (INTERNAL_EMAILS) | ADR 0030 | ön değer · mühendis onayı bekliyor |
| Veri kontrolü aralıkları | yağış 0–300 mm/gün (sıçrama 150) · ET₀ 0–12 (8) · Tmax −30..55 (20) · Tmin −40..40 (20) · toprak nemi 0–0,8 (0,3) · NDVI/NDMI −1..1 (0,5) | fiziksel sınırlar; SERT (aralık dışı) bayraklı yağış/ET₀ kovaya GİRMEZ, YUMUŞAK (sıçrama/eksik gün) girer | ön değer · mühendis onayı bekliyor |
| Kaynak uyumu (drift) eşikleri | ERA5↔Meteostat Tmax 1,0 °C (1A tabanına göre) · ERA5↔IMERG aylık oran %35 · ölçer↔ERA5 %35 · model ETc↔WaPOR L1 %40 · en az 20 gün | haftalık iş; yetersiz veride «yetersiz» | ön değer · mühendis onayı bekliyor |
| Güven servisi | ≥ %85 yüksek · ≥ %55 orta · altı düşük (sağlanan/ölçülebilen koşul); geçici gün ≤ 8 (30 günde); uydu ≤ 14 gün; hava ≤ 3 gün | tek servis; ölçülemeyen koşul paydada yok | ön değer · mühendis onayı bekliyor |
| Kural performansı | yanıtlı örnek < 5 → «ölçülemiyor» (isabet uydurulmaz) | aylık seri | ön değer · mühendis onayı bekliyor |

## ADIM 10 — topografya ve gece don riski (`don` bloğu; hepsi «ön değer · mühendis onayı bekliyor», ADR 0031)

| Kural | Durum | Not |
|---|---|---|
| Kritik sıcaklık: çiçek −2,8 · yeni meyve −0,8 · yeşil meyve −1,4 · olgun meyve −0,8 °C | ön değer · mühendis onayı bekliyor | UC ANR 8100 Tablo 2 + FAO Tablo 4.10; meyvede iki kaynağın temkinli (yüksek) ucu |
| **Yaprak ve odun kritik sıcaklığı** | **mühendis girdisi bekleniyor** | limona özgü sayısal kaynak bulunamadı; modelde YOK (uydurulmadı) |
| Süre | ön değer | iki kaynak çelişir (UC / FAO); uyarı için kısa süre yeter, süre eşiği değiştirmez |
| Tahmin: en soğuk model (IFS, ICON, GFS), sapma düzeltmesi YOK | ön değer | benzer kıyı istasyonlarında tutarlı yön yok (don-dogrulama.md §6) |
| İzle (≤ kritik + 3 K, uygulama içi) / Uyarı A (≤ kritik + 2 K, 18:00) | ön değer | kıyı POD 0,846 (33/39) · FAR 0,64; B ve C seçilmedi (ADR 0031 §2) |
| σ = 2,4 K (olasılık) | ön değer | Akdeniz kıyısı en-soğuk-model RMSE |
| Bahçe içi göreli soğuk nokta: rölyef ≥ 10 m ve eğim ≥ 3° | ön değer | DEM dikey hatası birkaç metre; jlnnlk'te üretilmez (8 m, 2,1°) |
| Olay yeniden değerlendirme `don-yd-1` | ön değer | silmez; kullanıcı doğrulamalı olaylara dokunmaz |
| Bildirim (18:00) ve ertesi sabah «Don oldu mu?» | **kapalı** (`bildirim_acik: false`) | Dilim 2 onayına kadar |

