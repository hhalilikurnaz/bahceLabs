# 9I · Dilim 0 — Uydudan gerçek su tüketimi (ETa): kaynak doğrulama

Tarih: 2026-11-12 · Bahçe: **jlnnlk** (Erdemli/Mersin, 15,15 da, 36,664 K · 34,380 D) · Kod yok: spike + belge. Hesaplayıcılar `bahcelab-backend/scripts/eta_dilim0_*.py` (yalnız okur), ham çıktılar `docs/agro/eta-dilim0/*.json`. **Hepsi gerçek veri; mock yok.** Her sayının kaynağı aşağıda yazılıdır.

## 0. Özet ve go / no-go (önce bunu oku)

| Soru | Cevap (kısa) |
|---|---|
| Landsat yeterince sık mı? | **Evet.** Son 24 ayda 173 ayrı geçiş tarihi; bahçenin 18 pikselinin **hepsi** bulutsuz olan **135 geçiş**, ardışık temiz geçişler arası medyan **7 gün**, en uzun boşluk **17 gün** (32 gün sınırını aşan boşluk yok). |
| Kaynaklarla bahçe düzeyinde ETa ölçülebilir mi? | **Hayır — çözünürlük engeli.** 15 dekarlık bahçede 100 m termal pikselin **tam içine düşen 0** piksel; bahçeyle kesişen ≈ 6 piksel ve bahçenin payı %26 (§6). 70 m ECOSTRESS: 0,03 tam piksel, %35 saflık. 300 m WaPOR: 0 tam piksel, %9. **Sayı bahçenin değil, bahçe + çevresinin ortalamasıdır.** |
| SSEBop Earth Engine'siz yapılır mı? | **Teknik olarak evet** (Landsat C2 L2 + ERA5 + Copernicus DEM, hepsi ücretsiz). **Ama** sahne içi soğuk referans seçimi sonucu ±0,2–0,5 ETf oynatıyor (§2.4): aynı bahçede 12 Haziran ETf 0,33, 14 Temmuz 0,90. Üretim kalitesi için uzun dönem c-faktörü kalibrasyonu ve doğrulama şart. |
| ECOSTRESS | **Ana kaynak olamaz:** 24 ayda jlnnlk karosu için yalnızca **8 (V002) / 5 (V003)** ET granülü; V003 yalnız Ekim 2025'ten itibaren; V002 işleme sorunu 15 Nisan 2026'dan beri **aktif** (§3). |
| WaPOR v3 | **L2 (100 m, ulusal): Türkiye'yi kapsamıyor** (Mersin/Adana/Antalya/İzmir/Konya'da %0 geçerli; Mısır/Fas/Ürdün kontrolleri %79–100). **L1 (300 m, küresel, dekadal): kapsıyor**, 72/72 dekad var, gecikme ≈ 2–3 hafta. Doğrulama/bağlam için uygun, bahçe için çok kaba. |
| **Öneri** | **KOŞULLU GO** — yalnız «bahçe + çevresi» (belirsizlik çubuklu, açıkça etiketli) göstergesi olarak; **jlnnlk (15 da) ve benzeri < ~40 da bahçelerde sayısal «ağaç tüketimi» vaadi NO-GO.** Ayrıntı ve koşullar §7. |

## 1. Landsat 8/9 C2 L2 (SR + ST) — sahne envanteri

- **Kaynak:** Microsoft Planetary Computer STAC (`landsat-c2-l2`, ücretsiz, anahtarsız arama; varlıklar SAS imzalı, `planetary_computer.sign`). Repoda zaten kullanılan sağlayıcı (`domain/imagery/landsat.py`, ADR 0017). *earth-search* seçilmedi: Landsat varlıkları USGS «requester pays» S3'te, anonim okunamıyor.
- **Pencere:** 2024-11-12 → 2026-11-12. STAC 259 öğe (üç WRS-2 karesi: 176/035 ×86, 176/034 ×87, 175/035 ×86); aynı gün birden çok kare birleştirilince **173 benzersiz geçiş tarihi**. Tüm öğelerde `lwir11` (ST_B10) var.
- **Bulutsuz tanımı:** `QA_PIXEL` bit 0–5 (dolgu, yayılmış bulut, sirrus, bulut, gölge, kar) **hiçbiri** işaretli değil. Bahçe 30 m'de **18 piksel** (iç −15 m tampon: **10 piksel**). Maske bahçede neredeyse hep ya hepsi geçerli ya hiçbiri (18 pikselde kısmi bulut yok denecek kadar az): ≥ %100 geçerli **135**, ≥ %80 geçerli 136, ≥ %50 geçerli 136.
- Ardışık temiz geçişler: medyan 7 gün, maks 17 gün.

| Ay | Geçiş tarihi (benzersiz) | Bulutsuz (18/18 piksel) | Bulutsuz (iç −15 m, 10/10) |
|---|---:|---:|---:|
| 2024-11 | 6 | 3 | 3 |
| 2024-12 | 4 | 2 | 2 |
| 2025-01 | 7 | 7 | 7 |
| 2025-02 | 8 | 7 | 7 |
| 2025-03 | 8 | 7 | 7 |
| 2025-04 | 7 | 4 | 4 |
| 2025-05 | 7 | 6 | 6 |
| 2025-06 | 8 | 8 | 8 |
| 2025-07 | 8 | 8 | 8 |
| 2025-08 | 8 | 8 | 8 |
| 2025-09 | 7 | 7 | 7 |
| 2025-10 | 6 | 5 | 5 |
| 2025-11 | 7 | 4 | 4 |
| 2025-12 | 7 | 5 | 5 |
| 2026-01 | 8 | 3 | 3 |
| 2026-02 | 7 | 5 | 5 |
| 2026-03 | 7 | 5 | 5 |
| 2026-04 | 8 | 5 | 5 |
| 2026-05 | 7 | 3 | 3 |
| 2026-06 | 7 | 6 | 6 |
| 2026-07 | 8 | 8 | 8 |
| 2026-08 | 7 | 6 | 6 |
| 2026-09 | 7 | 7 | 7 |
| 2026-10 | 8 | 5 | 5 |
| 2026-11 | 1 | 1 | 1 |

*Not:* ST ürünü 30 m'ye yeniden örneklenmiş; **fiziksel termal çözünürlük 100 m** (TIRS). Yukarıdaki «18 piksel» 30 m ızgara sayısıdır, bağımsız termal gözlem sayısı değil (§6). `ST_QA` (sıcaklık belirsizliği) bandı bu spike'ta okunmadı; Dilim 1'de okunacak.

## 2. SSEBop (FANO / openet-ssebop mantığı) — Earth Engine'siz uygulanabilirlik

### 2.1 Yöntem (uygulanan)
```
ETf = (Th − Ts) / dT ,   Th = Tc + dT          (sınır 0 … 1,05)
dT  = (Rn − G) · rah / (ρ · cp)                  rah = 110 s/m, cp = 1013 J/kg/K, G = 0 (günlük), albedo 0,23 (kuru çıplak «sıcak» koşul)
ETa = ETf × ET0                                  ET0 = ERA5 FAO-56 çim referansı (Open-Meteo ERA5 arşivi; Su kartıyla aynı seri)
```
- **Ts:** Landsat `ST_B10` (K); QA_PIXEL ile maskeli. **NDVI:** SR_B5/SR_B4 (ölçek 2,75e-5, ofset −0,2).
- **dT'nin ERA5'ten hesabı (Earth Engine'siz):** günlük `shortwave_radiation_sum` (Rs, MJ/m²/gün), `temperature_2m_max/min/mean`, `dew_point_2m_mean`. Ra (FAO-56 Denk. 21) → Rso = (0,75 + 2·10⁻⁵ z)·Ra → Rnl (Denk. 39; Rs/Rso ∈ [0,3; 1]) → **Rn_sıcak = Rs·(1 − 0,23) − Rnl** → W/m² (÷ 0,0864) → ρ (FAO-56: P/(1,01·T·0,287), P yüksekliğe göre) → **dT**. Yükseklik: Copernicus DEM 30 m (PC `cop-dem-glo-30`), bahçe ortalaması 45 m.
- **Tc (soğuk referans):** orijinal SSEBop `Tc = c · Ta` (c uzun dönem kalibre). Burada **sahne başına** hesaplandı: bahçeyi merkez alan 12×12 km pencerede, **NDVI ≥ 0,7**, bahçeyle **±150 m rakım** içinde, bahçe dışı ve QA-geçerli piksellerin LST **medyanı** (duyarlılık: %25 ve %10 yüzdelikleri). Bu bir **yaklaşımdır**; kalibre c-faktörü DEĞİLDİR.
- **Bilinen sapmalar (kasıtlı basitleştirme):** OpenET ETr (yonca) ile ölçekler, burada ET0 (çim) kullanıldı (istenen tanım); ETf'nin `1,05` üst sınırı; ERA5 9 km hücresi kıyı/deniz içerdiğinden Tmax/Ta düşük yanlı olabilir (12 Haziran ERA5 Tmax 24,7 °C iken bahçe LST 37 °C); Tc'de Ta rakım düzeltmesi yok (rakım filtresiyle geçiştirildi).

### 2.2 Üç örnek sahnede elle hesap (her adım yeniden hesaplanabilir)

| Adım | 2026-02-04 (kış) | 2026-06-12 (yaz başı) | 2026-07-14 (yaz) |
|---|---:|---:|---:|
| Sahne | LC09 176/035 | LC09 176/035 | LC09 176/035 |
| ERA5 Rs (MJ/m²/gün) | 13,10 | 22,44 | 25,47 |
| Ra / Rso (MJ/m²/gün) | 20,06 / 15,07 | 41,66 / 31,28 | 40,89 / 30,70 |
| Rs/Rso | 0,87 | 0,72 | 0,83 |
| Rnl (MJ/m²/gün) | 5,82 | 3,04 | 3,49 |
| Rn_sıcak = 0,77·Rs − Rnl (MJ) → W/m² | 4,27 → **49** | 14,24 → **165** | 16,12 → **187** |
| ρ (kg/m³) | 1,226 | 1,177 | 1,164 |
| **dT = Rn·110/(ρ·1013) (K)** | **4,37** | **15,20** | **17,41** |
| Tc (K) — soğuk ref. medyanı | 290,02 | 300,08 | 309,85 |
| Th = Tc + dT (K) | 294,39 | 315,28 | 327,26 |
| Ts (K) — bahçe ortalaması (QA-geçerli 18 px) | 290,06 | 310,26 | 311,67 |
| **ETf = (Th − Ts)/dT** | **0,99** | **0,33** | **0,90** |
| ET0 (mm/gün, ERA5) | 2,01 | 3,96 | 4,82 |
| **ETa = ETf × ET0 (mm/gün)** | **1,99** | **1,31** | **4,32** |

Örnek (12 Haziran): dT = 165 × 110 / (1,177 × 1013) = 15,20 K → Th = 300,08 + 15,20 = 315,28 K → ETf = (315,28 − 310,26)/15,20 = 0,33 → ETa = 0,33 × 3,96 = 1,31 mm/gün. (Betik çıktısı ile elle hesap aynı.)

### 2.3 Tüm örnek sahneler (7) — girdiler ve sonuç
Ham değerler: `docs/agro/eta-dilim0/ssebop.json` (LST, Tc, dT, NDVI, soğuk piksel sayısı, bölge ETf~NDVI profili dahil). Soğuk referans piksel sayısı 3 510 – 47 867 (hepsi ≥ 200 eşiğinin çok üstünde).

### 2.4 Yöntemin kararlılığı (dürüst bulgu)
- **Tc seçimine duyarlılık:** medyan → %10 yüzdelik arası ETf farkı çoğu sahnede 0,02–0,14 iken **16 Eylül'de 0,88 → 0,37** (soğuk piksel dağılımı iki kümeli: sulanan alan ↔ deniz kenarı/orman). Yani sahne içi referans **tek başına güvenilir değil**.
- **Aynı bahçe, bir ay arayla:** ETf 12 Haziran 0,33 ↔ 14 Temmuz 0,90; ETa 1,31 ↔ 4,32 mm/gün. Haziran'da bahçe LST'si soğuk referanstan 10 K sıcak (Ts 310,3 K, Tc 300,1 K), Temmuz'da yalnız 1,8 K. Bu fark bahçe yönetiminden değil **Tc ve dT'nin ERA5/sahne bağımlılığından** geliyor olabilir; elimizde bahçe-içi yer gerçeği (akı kulesi, damla sayacı) yok, bu yüzden hangisinin doğru olduğu **doğrulanamadı**.
- Bölge profili (NDVI sınıfı başına ETf, medyan Tc): çıplak/seyrek bitki (NDVI < 0,2) 12 Haziran'da ETf 0,95 çıkıyor — fiziksel olarak mantıksız (kuru toprak ≈ 0 olmalı); bu da Tc'nin o sahnede soğuk-yanlı kaldığını gösterir.
- **Sonuç:** yöntem Python/ücretsiz veriyle çalışıyor, ama **bu spike'taki sahne içi Tc ile sayılar kullanıcıya sayı olarak gösterilemez.** Dilim 1 için gerekenler: uzun dönem c-faktörü (Ta tabanlı Tc), DEM'li Ta rakım düzeltmesi, ST_QA belirsizliği, ETf için çok sahneli tutarlılık testi ve (varsa) yer verisi.

## 3. ECOSTRESS L3 ET (70 m) — Earthdata

- **Ürünler:** `ECO_L3T_JET` **V002** («Tiled ET Instantaneous and Daytime L3 Global 70 m V002») ve **V003** (PT-JPL + STIC-JPL + BESS-JPL + PM-JPL toplulu; `ETdaily` mm/gün, `ETuncertainty`). Karo 36SXF. Arama: `earthaccess` (CMR), indirme: `EARTHDATA_TOKEN` ile gerçek granüller indirildi.
- **Granül sayısı (24 ay, jlnnlk kutusu):** **V002: 8**, **V003: 5** (yalnız 2026-02-04'ten sonra). Karşılaştırma: aynı karoda `ECO_L2T_LSTE` (LST, ET değil) V002 **173**, V003 **165** granül — ISS geçişi çok, ET granülü çok az; nedeni bu belgede **doğrulanmadı**.
- **Bugünkü durum (NASA sayfaları 2026-11-12'de okundu; «Site last updated Nov. 6, 2026»):**
  - **ECOSTRESS Data Processing Issue** (ecostress-data-processing-issue): yayın 15 Nisan 2026, son güncelleme 4 Mayıs 2026, **Active Outage**, Resolved: TBD. **V002**, ET dahil (L3G/L3T JET, ESI, WUE) ~30 ürün; orbit 43451–43519, 43636–43737, 43985–44017 **yanlış orbit bilgisiyle** işlenmiş; teslim durduruldu, etkilenen veri arşivden kaldırılıp yeniden işlenecek. Yeniden işleme tarihi yok.
  - **Tiled LSTE Data Processing Issue:** 23 Haziran 2026, **Active Outage**, V002 LSTE, 16 Aralık 2025–10 Haziran 2026 arası `lst_err` eksik; yeniden teslim tarihi yok.
  - **V3 higher-level release:** 26 Mayıs 2026 (L3T JET, ETAUX, L4T ESI, WUE); **ilk teslim 1 Ekim 2025 → bugün**, tarihsel işleme «ileri bir tarihe». Katalog sayfası zamansal kapsamı «2018-07-09 – bugün» diyor; duyuruyla çelişiyor, doğrulanamadı.
  - Bilinen kısıt: ISS güneş paneli engeli (`FieldOfViewObstruction` Ekim 2024+ güvenilir), 2018–2023 kalıcı veri boşlukları.
  - Kaynaklar: https://www.earthdata.nasa.gov/data/alerts-outages/ecostress-data-processing-issue · …/ecostress-tiled-land-surface-temperature-emissivity-data-processing-issue · …/ecostress-version-3-higher-level-data-products-released · https://www.earthdata.nasa.gov/data/catalog/lpcloud-eco-l3t-jet-003
  - **«Nisan 2026 işleme sorunu»nun bugünkü durumu: çözülmemiş (aktif), V002 için.**
- **Bahçe üzerindeki değerler** (`ETdaily`, mm/gün; poligon içi piksel merkezi 2, bahçeye değen 9 piksel; 70 m):

| Sürüm | Geçiş (UTC) | Piksel (merkez / dokunan) | Geçerli (merkez) | ETdaily ort. (mm/gün) |
|---|---|---|---:|---|
| 002 | 2025-02-04 07:18 | 2 / 9 | 2 | 0.99 |
| 002 | 2025-03-02 04:13 | 2 / 9 | 0 | bulutlu/maskeli |
| 002 | 2025-07-14 16:00 | 2 / 9 | 0 | bulutlu/maskeli |
| 002 | 2025-08-10 05:26 | 2 / 9 | 0 | bulutlu/maskeli |
| 002 | 2026-02-04 06:48 | 2 / 9 | 2 | 0.88 |
| 003 | 2026-02-04 06:48 | 2 / 9 | 2 | 1.11 |
| 003 | 2026-05-02 03:48 | 2 / 9 | 0 | bulutlu/maskeli |
| 002 | 2026-06-11 04:46 | 2 / 9 | 2 | 3.24 |
| 003 | 2026-06-11 04:46 | 2 / 9 | 2 | 3.42 |
| 002 | 2026-07-12 16:16 | 2 / 9 | 2 | 0.17 |
| 003 | 2026-07-12 16:16 | 2 / 9 | 2 | 0.00 |
| 002 | 2026-09-13 15:14 | 2 / 9 | 0 | bulutlu/maskeli |
| 003 | 2026-09-13 15:14 | 2 / 9 | 0 | bulutlu/maskeli |

  8 V002 + 5 V003 = 13 granülden **6'sında** bahçe pikselleri boş (bulut maskesi ya da geçersiz değer), **7'sinde** değer var. 12 Temmuz 2026 (16:16 UTC, yerel akşam) `ETdaily` 0,17 (V002) / 0,00 (V003) mm/gün — yaz ortası sulanan narenciye için **inandırıcı değil**; ürün bu karşılaştırmada **doğrulama referansı olarak güvenilmedi**.

## 4. WaPOR v3

- **API:** `https://data.apps.fao.org/gismgr/api/v2/catalog/workspaces/WAPOR-3` (anahtarsız). Dosyalar herkese açık Google Storage COG'ları; `rasterio` ile **küçük pencere** (`/vsicurl`) okundu — tam dosya indirmeye gerek yok.
- **L1-AETI-D (küresel, dekadal, 300 m, mm/gün, ölçek 0,1):** jlnnlk penceresinde **72/72 dekad** (2024-11-01 → 2026-10-21) geçerli. **Son dekad 2026-10-21→31; 2026-11-01 dekadı 12 Kasım'da henüz yok → gecikme ≈ 2–3 hafta.** Piksel ≈ 262 m; bahçenin içine düşen piksel merkezi **0**, değen **2**.
  - *Not:* katalog liste uç noktası sayfalamada eksik döndürüyor (218 raster); tüm dekadlar kod kalıbıyla (`WAPOR-3.L1-AETI-D.YYYY-MM-D1|D2|D3`) doğrudan erişilince var.
- **L2-AETI-D (ulusal, dekadal, 100 m): Türkiye/Mersin'i KAPSAMIYOR.** Aynı küresel COG içinde (±60°) 2025-07-D2 dekadında 1°×1° pencere geçerli piksel yüzdesi: **jlnnlk 0, Adana ovası 0, Antalya 0, İzmir 0, Konya 0**; kontrol: Nil deltası 100, Ürdün 100, Fas-Sous 79. 74 dekadın hepsinde jlnnlk **0 geçerli**.

## 5. Karşılaştırma — aynı tarihler, ETa / model ETc (mm/gün)

Model ETc = **bizim planın katalog Kc'si** (`kc_monthly(ay, örtü)`, örtü ← Landsat NDVI) × ERA5 ET0 — jlnnlk'in gerçek sulama profili/kovası yok (örnek profil bu belge için kullanılmadı). SSEBop sütunu: medyan Tc (aralık: %10 yüzdelik Tc → medyan). ECOSTRESS: en yakın geçiş (V002 / V003), tarih öneki gösterilir. WaPOR L1: o tarihin içinde bulunduğu **dekadın günlük ortalaması** (10 günlük ortalama ↔ anlık sahne farkı var).

| Landsat tarihi | Plt | ET0 | Model ETc | Landsat-SSEBop ETa (ETf) | SSEBop aralığı | ECOSTRESS (V002 / V003) | WaPOR L1 (dekad) |
|---|---|---:|---|---|---|---|---:|
| 2025-02-02 | 8 | 1.82 | 1.27 (Kc 0.70) | 1.42 (ETf 0.78) | 1.17 – 1.42 | 02-04: 0.99 / — | 0.80 |
| 2025-07-12 | 8 | 5.77 | 3.50 (Kc 0.61) | 2.48 (ETf 0.43) | 2.30 – 2.48 | 07-14: — / — | 2.35 |
| 2026-02-04 | 9 | 2.01 | 1.41 (Kc 0.70) | 1.99 (ETf 0.99) | 1.78 – 1.99 | 02-04: 0.88 / 1.11 | 0.80 |
| 2026-06-12 | 9 | 3.96 | 2.48 (Kc 0.63) | 1.31 (ETf 0.33) | 1.24 – 1.31 | 06-11: 3.24 / 3.42 | 2.90 |
| 2026-07-14 | 9 | 4.82 | 3.06 (Kc 0.63) | 4.32 (ETf 0.90) | 3.87 – 4.32 | 07-12: 0.17 / 0.00 | 2.50 |
| 2026-09-16 | 9 | 3.76 | 2.41 (Kc 0.64) | 3.31 (ETf 0.88) | 1.38 – 3.31 | — | 3.10 |
| 2026-10-18 | 9 | 2.42 | 1.63 (Kc 0.68) | 2.40 (ETf 0.99) | 2.16 – 2.40 | — | 2.60 |

Okuma: yönler **tutarsız** — kış/sonbahar sahnelerinde SSEBop ≈ ET0 (ETf ≈ 1, narenciye için fazla yüksek), 12 Haziran'da modelin ve WaPOR'un çok altında, 14 Temmuz'da ikisinin de çok üstünde. WaPOR L1 (2,3–3,1 mm/gün yazın) ile model ETc (2,4–3,5) aynı aralıkta; ECOSTRESS 12 Haziran'da 3,2–3,4 ile onlarla uyumlu, 12 Temmuz'da değil. **Hiçbir kaynak bahçe içi yer gerçeğiyle sınanmadı**; hangisi «doğru» sorusu bu spike'tan cevaplanamaz.

## 6. Çözünürlük gerçeği — bahçe kaç termal piksel?

Yöntem (`eta_dilim0_cozunurluk.py`): jlnnlk poligonu metreye (UTM 36N) çevrilir; rastgele konum ve yönde kare ızgara (800–400 deneme) bindirilir. **Tam içeride** = pikselin tamamı bahçe içinde; **kesişen** = bahçeye değen piksel; **saflık** = bahçe alanı ÷ kesişen piksellerin toplam alanı (düşükse sinyalin çoğu bahçe dışından gelir). 5/40/100 dekar örnekleri jlnnlk şeklinin ölçeklenmiş hâlidir.

| Bahçe | Piksel | Tam içeride (ort.) | P(≥ 1 tam piksel) | Kesişen (ort., aralık) | Saflık (ort.) |
|---|---|---:|---:|---|---|
| jlnnlk (gerçek) (15.1 da) | 30 m | 7.18 | %100 | 29.2 (21–33) | %58 (p10 %54 – p90 %62) |
| jlnnlk (gerçek) (15.1 da) | 70 m | 0.03 | %3 | 8.9 (6–12) | %35 (p10 %31 – p90 %44) |
| jlnnlk (gerçek) (15.1 da) | 100 m | 0.00 | %0 | 5.9 (3–8) | %26 (p10 %22 – p90 %30) |
| jlnnlk (gerçek) (15.1 da) | 300 m | 0.00 | %0 | 2.3 (1–4) | %9 (p10 %4 – p90 %17) |
| 5 dekar (örnek) (5.0 da) | 30 m | 0.77 | %57 | 13.0 (8–17) | %43 (p10 %37 – p90 %51) |
| 5 dekar (örnek) (5.0 da) | 70 m | 0.00 | %0 | 4.8 (2–7) | %22 (p10 %17 – p90 %26) |
| 5 dekar (örnek) (5.0 da) | 100 m | 0.00 | %0 | 3.5 (2–6) | %16 (p10 %12 – p90 %25) |
| 5 dekar (örnek) (5.0 da) | 300 m | 0.00 | %0 | 1.7 (1–4) | %4 (p10 %2 – p90 %6) |
| 40 dekar (örnek) (40.0 da) | 30 m | 27.70 | %100 | 63.8 (53–72) | %70 (p10 %67 – p90 %73) |
| 40 dekar (örnek) (40.0 da) | 70 m | 1.97 | %97 | 17.0 (13–21) | %48 (p10 %43 – p90 %54) |
| 40 dekar (örnek) (40.0 da) | 100 m | 0.19 | %15 | 10.5 (7–14) | %39 (p10 %33 – p90 %44) |
| 40 dekar (örnek) (40.0 da) | 300 m | 0.00 | %0 | 3.3 (2–5) | %15 (p10 %11 – p90 %22) |
| 100 dekar (örnek) (100.0 da) | 30 m | 83.74 | %100 | 141.1 (131–149) | %79 (p10 %77 – p90 %81) |
| 100 dekar (örnek) (100.0 da) | 70 m | 9.57 | %100 | 33.9 (29–40) | %60 (p10 %57 – p90 %64) |
| 100 dekar (örnek) (100.0 da) | 100 m | 2.92 | %100 | 19.7 (15–23) | %51 (p10 %48 – p90 %56) |
| 100 dekar (örnek) (100.0 da) | 300 m | 0.00 | %0 | 4.9 (2–7) | %24 (p10 %19 – p90 %28) |

- **jlnnlk (15 da):** Landsat termali (100 m): **0** tam piksel, ≈ 6 kesişen; ECOSTRESS (70 m): 0,03 tam, ≈ 9 kesişen; WaPOR L1 (300 m): 0 tam, ≈ 2 kesişen, %9 saflık. Gerçek ECOSTRESS ızgarasında doğrulandı: 2 piksel merkezi içeride, 9 piksel değiyor; WaPOR L1: 0 merkez, 2 değen.
- **40 da:** 100 m'de ≈ 0,2 tam piksel; ancak **100 da** ve üstünde 100 m'de ≈ 3 tam piksel.
- **−15 m iç tampon:** 30 m ızgarada 10/18 piksel kalır; **fiziksel 100 m'yi iyileştirmez** (30 m yeniden örnekleme enterpolasyondur).

## 7. Öneri ve go / no-go

| Rol | Kaynak | Gecikme | Sıklık (jlnnlk) | Belirsizlik / sınır |
|---|---|---|---|---|
| **Ana** | Landsat 8/9 C2 L2 + SSEBop (ERA5 dT, DEM) | geçişten sonra genelde birkaç gün (PC; ölçülmedi) | bulutsuz medyan 7 gün, maks 17 gün | Termal 100 m; ETf Tc'ye ±0,2–0,5 duyarlı (§2.4); ERA5 Ta yanlılığı; sayısal doğrulama yok |
| **Yedek / bağlam** | WaPOR v3 **L1** (300 m, dekadal) | ≈ 2–3 hafta | her dekad (72/72) | 300 m: bahçe için %9 saflık; yalnız bölgesel doğrulama |
| **Doğrulama (kısmi)** | ECOSTRESS L3T JET V003 | gün–hafta (aktif V002 sorunu) | 24 ayda 5–8 geçiş | Seyrek, bulutlu, akşam geçişleri; V002 yanlış orbit sorunu çözülmedi |
| Kullanılmayacak | WaPOR v3 L2 | — | — | **Türkiye kapsam dışı** |

**Karar önerisi: KOŞULLU GO.**
1. **Ürün sözü:** «ağaç ihtiyacın %X'ini tüketti» gibi **bahçe-düzeyi sayı vaadi** jlnnlk gibi < ~40 da bahçelerde verilmemeli. Gösterilecekse: «bahçe + çevresi ortalaması», tek sayı yerine **aralık (Tc duyarlılığı)**, her noktada piksel sayısı ve karışık piksel payı, ilk sürümde bahçe büyüklüğü eşiği (öneri ≥ 40 da, tartışılabilir).
2. **Teknik önkoşullar (Dilim 1 kapsamına girer):** uzun dönem **c-faktörü** kalibrasyonu (sahne içi medyan Tc yerine), Ta rakım düzeltmesi, `ST_QA` belirsizliği, çok sahneli tutarlılık testi (aynı bahçe ardışık geçişlerde makul ETf farkı), WaPOR L1 ile dekad ortalama kontrolü.
3. **ECOSTRESS** ana akışa alınmamalı; V003'te veri biriktikçe isteğe bağlı ikinci kaynak olarak yeniden değerlendirilmeli.
4. **Risk:** Dilim 1 sonunda sahne sonuçları hâlâ bu spike'taki gibi tutarsızsa (12 Haziran ↔ 14 Temmuz), arayüz dilimi (Dilim 2) **durdurulmalı**; «uydudan gerçek tüketim» etiketi güven aşındırır.

**No-go koşulları:** (a) Dilim 1'de ardışık temiz geçişlerde ETf tutarsızlığı kalibrasyonla ±0,15'in altına inmezse; (b) ürün, bahçe-düzeyi kesin sayı vaadi şartıyla istenirse (çözünürlük gerçeği §6).

## 8. Dürüstlük notları
- SSEBop bu belgede **spike uygulamasıdır**, OpenET ile birebir doğrulanmadı; formüller literatürden (Senay ve ark. 2013, FAO-56), parametreler (rah = 110 s/m, albedo 0,23, NDVI ≥ 0,7 soğuk referans) burada **ön değerdir**, katalogda «ön değer · mühendis onayı bekliyor» olarak yazılmalıdır (Dilim 1).
- Tüm sayılar tek bahçe (jlnnlk), 7 Landsat sahnesi, 5–8 ECOSTRESS geçişi üzerinden; istatistiksel genelleme yoktur.
- Yer gerçeği (akı kulesi, damla sayacı, Saha Defteri sulama kaydı) olmadığından «hangi kaynak doğru» **söylenemez**; yalnızca kaynakların birbiriyle tutarlılığı ve kapsamı raporlanmıştır.
- WaPOR L1 liste uç noktasının eksik sayfalaması ve ECOSTRESS katalog tarih çelişkisi kaynak tarafı sorunlarıdır.

## 9. Yeniden üretme
```
PYTHONPATH=src .venv/bin/python scripts/eta_dilim0_landsat.py  <çıktı.json> [geojson]     # §1
PYTHONPATH=src .venv/bin/python scripts/eta_dilim0_ssebop.py   <çıktı.json> <tarih>...     # §2 (ERA5: Open-Meteo, DEM: PC)
set -a; . ./.env.local; set +a
PYTHONPATH=src .venv/bin/python scripts/eta_dilim0_ecostress.py <klasör>                     # §3 (EARTHDATA_TOKEN)
PYTHONPATH=src .venv/bin/python scripts/eta_dilim0_wapor.py     <çıktı.json>                 # §4 (liste /tmp/wapor-l*-list.json: kod kalıbından)
PYTHONPATH=src .venv/bin/python scripts/eta_dilim0_cozunurluk.py <çıktı.json>                # §6
```
Girdi poligonu `/tmp/jl-geom.txt` = `SELECT ST_AsGeoJSON(geom)||'|'||alan_dekar FROM gardens WHERE ad='jlnnlk'`.
