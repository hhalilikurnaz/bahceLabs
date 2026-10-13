# 0017 — Su ve sıcaklık kaynakları, doğrulama yöntemi ve sınırlar (Adım 9E)

Durum: kabul edildi. Tarih: 2026-10-13.

## Bağlam
9C/9D ile kurulan veri temeli (ADR 0015, 0016) üzerine su ve sıcaklık dilimi ekleniyor: **yeni hat açılmaz**; `data_sources`, `acquisitions`, `backfill_months` kullanılır. Arayüzde yalnız karar cümlesi ve dört kanıt grafiği (toprak nem profili, su dengesi, bulut altında görüş, yüzey–hava sıcaklığı) ve «Yüzey sıcaklığı (Landsat)» katmanı görünür. SMAP, IMERG ve CHIRPS yalnızca **doğrulama** içindir; arayüzde yalnız «Nasıl hesaplandı?» içinde anılır.

## Kararlar

### Kaynaklar
1. **ERA5-Land (Open-Meteo arşivi, `models=era5_land`)** — 4 katman toprak nemi (0–7, 7–28, 28–100, 100–255 cm) ve 2 m sıcaklık, saatlik; günlük özet `era5_daily`'ye yazılır (hava hücresi başına, 0,05° ızgaraya oturtulmuş; aynı hücredeki bahçeler paylaşır; 2015-01-01 → bugün + 7 gün; yazım danışma kilitli, idempotent).
2. **ERA5 (`models=era5`, 31 km)** — yağış ve ET0. Open-Meteo ERA5-Land arşivi yağış/ET0 vermez; bu iki değişken ERA5'ten alınır ve kayıtta `hava_kaynak` ile işaretlenir.
3. **Model tahmini (Open-Meteo forecast)** — ERA5'in henüz yetişmediği son günler ve 7 günlük ileri tahmin. Model toprak katmanları (0–1, 1–3, 3–9, 9–27, 27–81 cm) ERA5-Land katmanlarına **derinlik ağırlıklı örtüşmeyle** eşlenir (asgari kapsama %70; 100–255 cm model tarafından kapsanmaz, «yok» kalır).
4. **Landsat 8/9 yüzey sıcaklığı (Planetary Computer `landsat-c2-l2`)** — `lwir11` DN × 0,00341802 + 149 K → °C. QA_PIXEL bit 0–5 geçersiz (doldurma, seyrek bulut, bulut, gölge, kar, bulut gölgesi); pencere bahçe + 300 m; kanonik 10 m ızgaraya en yakın komşuyla taşınır (30 m = 3×3 blok). Bahçe (poligon maskeli) ve 300 m tampon halkası istatistikleri ayrı saklanır. **Fiziksel çözünürlük 100 m**; 30 m ürün yeniden örneklenmiştir. Arayüz bunu lejantta söyler: «100 m fiziksel çözünürlük · bahçe içi ayrıntı vermez».
5. **SoilGrids 2.0 (ISRIC REST)** — kum/kil/silt/organik karbon; **bahçe merkezinden** (hücre merkezinden değil; kıyı hücresinde null dönüyordu) alınır, `soil_profiles`'e yazılır. Bahçeye özel toprak analizi gelince onun yerine geçer (Adım 14).

### Doğrulama kaynakları (arayüzde yok)
6. **SMAP L3 (SPL3SMP_E, 9 km)** — NASA Earthdata (`earthaccess`), HTTP Range okumasıyla (`shared/http_range.RangeFile`; yalnız gerekli bloklar). Bahçenin EASE2 hücresi ve 5×5 komşuluk; kıyı hücresi sık geçersiz olduğundan `deger_kaynagi` (nokta | komşu) kayda yazılır. Her 3 günde bir, 2022'den bugüne arka planda.
7. **GPM IMERG Late günlük (GPM_3IMERGDL V07)** — 2022'den bugüne; GES DISC EULA kabul edildi. Yağış karşılaştırması ve yağış kaynağı kararı için (aşağıda).
8. **CHIRPS — devre dışı.** Dağıtım sunucusu bu ağdan 403 (IP engeli) döndürür. `data_sources.durum = 'devre_disi'`, açıklama «devre dışı · IP engeli» (migration 027). Elde 47 günlük (Ocak–Şubat 2022) kısmi okuma var; hiçbir karara girmez.
9. **Gizli anahtar:** `EARTHDATA_TOKEN` yalnız `bahcelab-backend/.env.local`'da (`Settings.earthdata_token`, `repr=False`); `.env.example`'da boş satırdır; kod, günlük, test ve commit'e girmez.

### Model–ERA5 geçiş düzeltmesi
10. Son günlerde ERA5-Land henüz yoksa model verisi kullanılır. Model ile ERA5-Land arasında sistematik katman farkı vardır; geçişte basamak oluşmaması için model satırlarına **son 7 örtüşen gündeki (≥ 3 gün) ortalama fark (ERA5-Land − model)** her katman için eklenir. Düzeltilen satırlar `toprak_kaynak = 'model'` işaretlidir, ofset `saatlik.model_ofset`'te saklanır; arayüzde grafikte içi boş nokta ve kaynak çipinde geçiş günü olarak görünür. Düzeltme düzeltilmemiş modelden daha iyidir ama **ERA5-Land'in kendisi değildir**; yaklaşıktır.

### Toprak nemi yöntemi
11. **Normale göre doluluk.** Her katmanda ERA5-Land'in kendi 2015–2025 dağılımı (hücre ve katman başına tüm günler; mevsim penceresi yok) kullanılır: p2 = %0, p98 = %100. Bu **ERA5-Land'in mutlak hacimsel nemini saha kapasitesine bağlamaz**; «bu hücrenin normaline göre ne kadar dolu» der. SoilGrids tarla kapasitesi/solma noktası ERA5 mutlak değerlerine **uygulanmaz** (ERA5-Land ile SoilGrids farklı ölçek/bias taşır).
12. **Kök bölgesi dolulukları** ağırlıkları (7, 21, 72) cm (kök derinliği 80 cm'ye kadar katman kalınlığı) ile birleşir. Sınıflar: ≥ %60 nemli, ≤ %35 kuru (ön değer).
13. **Profil grafiği çizgileri = «bu bahçenin normal aralığı»** (p10–p90, 2015–2025, tüm günler; kış–yaz salınımını da kapsadığı için bant geniştir). Bugün mavi, 30 gün önce kesikli.
14. **Su dengesi kovası (mm)**: kullanılabilir su = (tarla kapasitesi − solma noktası) × kök derinliği; tarla kapasitesi/solma noktası **Saxton & Rawls (2006)** pedotransfer fonksiyonlarıyla SoilGrids kum/kil/organik maddeden; tükenme oranı 0,5 (stres eşiği). ETc = Kc × ET0; **Kc NDVI'dan doğrusal** (NDVI 0,30→0,80 aralığında Kc 0,45→0,75). 30 gün geçmiş + 7 gün tahmin, birikimli; **sulama kaydı yoktur** (9H). Tüm katsayılar katalogda «ön değer · mühendis onayı bekliyor».

### Yağış kaynağı kararı (IMERG ile karşılaştırma)
15. 2022'den bugüne aylık ERA5 yağışı IMERG ile karşılaştırılır. **Karar kuralı:** en az 6 ay (her ay ≥ 25 ortak gün) ve ERA5 ≥ IMERG × 1,25 ise (sistematik fazla) geçmiş yağış için IMERG, ileri günler için Open-Meteo tahmini kullanılır; aksi hâlde ERA5 korunur. Kod: `balance.choose_rain_source`. Sonuç **Sonuçlar** bölümündedir.

### Yüzey–hava sıcaklığı
16. Hava sıcaklığı: ERA5-Land t2m, Landsat geçiş saatine en yakın saat (yerel 11:00). Fark = yüzey − hava. **Stres işareti:** fark ≥ +5 °C (ön değer). **Karışık piksel uyarısı:** bahçe ortalaması ile 300 m tampon ortalaması farkı ≥ 1,5 °C (100 m piksel bahçe dışını da içerir). Son 6 net Landsat geçişi gösterilir.

## Doğrulama ve bilinen sınırlar
- **SMAP–ERA5 düzey farkı:** ERA5-Land yüzey nemi (≈ 0,25–0,28 m³/m³) SMAP'ten (≈ 0,07–0,11 m³/m³) sistematik **yüksek**; ERA5-Land'in toprak parametrizasyonu ve Akdeniz kıyısı kuru toprak bandı farklıdır. Bu yüzden SMAP **mutlak değer olarak kullanılmaz**; yalnız ilişki (korelasyon) denetlenir. Kıyı hücresi (bahçe merkezi deniz–kara karışımı) SMAP'te sık geçersiz; geçerli örneklerde ilişki yaz kuru dönemde zayıftır (2026 Haziran–Ekim, 5×5 komşuluk, r ≈ 0,2–0,3, n ≈ 25/geçiş). **Bu, ERA5-Land profilinin saha gerçeği olduğu anlamına gelmez** ve karar cümlesi «ön değer · mühendis onayı bekliyor» etiketini taşır.
- **ERA5 31 km yağış** konvektif/yerel yağışı yumuşatır; küçük bahçe için günlük yağış belirsizdir (aylık toplamlarda daha güvenilir).
- **Landsat 100 m:** 15 da'lık bahçe birkaç ham pikseldir; bahçe içi desen yorumlanmaz (lejant söyler). Tampon halkası karışık pikseli işaretlemek içindir.
- **Kc NDVI'dan** basit doğrusal bir ilişkidir; tür/çeşit/sulama yöntemi gelince (Adım 14, 9H) değişecek.
- **Ağaçlı bahçede radar** mutlak toprak nemi vermez (ADR 0016); «Bulut altında görüş» grafiği yalnız görüş sürekliliğini gösterir.
- **Model toprak katmanları** 100–255 cm'yi kapsamaz; o derinlik ERA5 gecikmesi boyunca «yok» görünür.

## Sonuçlar
- Test bahçeleri (jlnnlk, soğuk hava) 4311 günlük ERA5 serisi (2015-01-01 → +7 gün), Landsat 539 net/186 bulutlu geçiş (jlnnlk); bahçe–tampon farkı ortalama +0,44 °C (p95 1,27; 83 sahnede > 1 °C → karışık uyarısı sık çıkar).
- Yağış kaynağı kararı ve SMAP/IMERG kapsamı için `docs/` raporuna ve son bölüm güncellemesine bakın (aşağıda «Güncel karşılaştırma»).

## Güncel karşılaştırma
_(veri tamamlandıkça doldurulur)_
