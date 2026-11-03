# 0026 — Geçici (kesinleşmemiş) günler, bahçe yağış ölçeri, kesinleşen veriyle plan değişikliği

Durum: kabul edildi. Tarih: 2026-11-03. İlgili: ADR 0025 (tek seri), ADR 0017 (ERA5 besleme), ADR 0019 (Saha Defteri).

## 1. Geçici günler: hangi üründen doldurulur
`era5_daily` satırı iki kaynaktan oluşur (`water/era5_sync.merge_day`):
- **Kesin:** Open-Meteo **arşiv** API'si — yağış ve ET₀ `models=era5` (ERA5 yeniden analizi), toprak nemi ve sıcaklık `models=era5_land`. ~5 gün gecikmelidir (`ERA5_LAG_DAYS = 6`). Satırda `hava_kaynak = 'era5_land'`.
- **Geçici:** arşivde henüz olmayan son günler (ve ileri günler) için Open-Meteo **tahmin** API'si (`/v1/forecast`, `past_days=10`, `forecast_days=8`; bugünkü varsayılan model karışımı: «best match») — yağış ve ET₀ doğrudan modelden, toprak nemi katman eşlemesiyle ve ERA5-Land'e göre ofsetle düzeltilmiş. Satırda `hava_kaynak = 'model'`. Bu bir yeniden analiz değil, **tahmin modelinin kısa vadeli analiz/tahmin değeridir**; ERA5 değeriyle gün bazında önemli sapabilir (örnek: 29 Ekim 2026, model 52,6 mm; Hava sekmesinin eski arşiv serisi 89,8 mm).
- Ayrım **gün başına** tutulur ve kovaya taşınır: `DayIn/DayOut.gecici` (bugün dahil, `hava_kaynak <> 'era5_land'` ve `tarih ≤ bugün`).

## 2. Arayüz
Geçici günler **hiçbir yerde kesin gibi** gösterilmez: Su kartı, Bugün sekmesi ve toprak suyu grafiği «Son N gün geçici: ERA5 henüz kesinleşmedi, kesinleşince plan yeniden hesaplanır» notunu taşır; toprak suyu ve su dengesi grafiklerinde geçici günler **taralı** (Forecast deseni, «geçici» etiketi). Kaynak satırı sayıyı ve ürünü söyler.

## 3. Kesinleşince yeniden hesap ve bildirim
Kova isteğe bağlı hesaplandığı için kesin veri yazılınca (ERA5 besleme: `feed_cell`, hem bahçe beslemesinde `feed_runs` «era5» aşaması olarak izlenen yolda hem günlük `refresh_era5`) bir sonraki okumada kendiliğinden yeniden hesaplanır. Ek olarak besleme **öncesi** ve **sonrası** hücredeki sulama profilli bahçelerin kararı (`Imza`: durum + önümüzdeki 7 günün sulama günleri) karşılaştırılır; **en az bir geçici gün kesinleştiyse ve karar değiştiyse** bahçe başına «Sulama planı kesinleşen veriyle değişti» bildirimi (önem: önemli, tür `sulama_revize`, tekil anahtar: bahçe + gün + yeni sulama günleri) üretilir. Tahmin günlerinin her gün değişmesi bildirim üretmez (yalnız kesinleşme).

## 4. Bahçe yağış ölçeri (Saha Defteri «Yağış ölçümü (mm)», tür `yagis`)
- **Kayıt:** `ayrinti.mm` zorunlu, 0 ≤ mm ≤ 500 (aksi 422). Aynı güne birden çok kayıt varsa **en son girilen** sayılır (toplamak yinelenen ölçümü çift sayardı).
- **Kullanım:** o gün için kova **ölçümü seriden önce** kullanır (`rain_series.gecmis_hava`): kova, plan, Su kartı, Bugün, Hava sekmesi (7/30 gün/sezon toplamı, geçmiş) aynı değeri okur. Ekranda «bahçede ölçüldü» işareti; kaynak satırında «N gün bahçede ölçüldü».
- **Yanlılık birikimi (otomatik UYGULANMAZ):** ölçüm ve seri farkı **aylık** biriktirilir. Öneri çıkması için (katalog `sulama_plani`, ön değer): ayda en az **5** eşleşen gün, serinin o günlerdeki toplamı en az **10 mm**, |ölçüm/seri − 1| ≥ **0,20**. Önerilen aylık çarpan = ölçüm/seri, **[0,5; 2,0]** aralığına kırpılır. Panel «Serinin ×1,35 düzeltilmesi ÖNERİLİR. Otomatik uygulanmaz.» der. Düzeltmeyi uygulamak ayrı, bilinçli bir kullanıcı eylemidir (şimdilik yok; öneri yalnız bilgi).
- **Neden otomatik değil:** tek bir ölçer yağışın mekânsal değişkenliğini (bahçe içinde bile) temsil edemez; düzeltme sistematik yanlılığı kanıtlayan yeterli eşleşmeden sonra kullanıcı kararıdır.

## Sonuçlar
- ERA5T benzeri «ön-nihai» bir ürün kullanmıyoruz; geçici günler tahmin modelidir. Open-Meteo arşivi son günler için ERA5T sunuyorsa ileride «geçici» ikiye ayrılabilir (model ↔ ERA5T).
- Yağış ölçeri verisi sınırlıdır: ölçüm girilmeyen günlerde seri geçerlidir; ölçüm var diye komşu günlere yayılmaz.
