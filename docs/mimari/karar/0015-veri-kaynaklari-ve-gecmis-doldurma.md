# 0015 — Veri kaynakları, geçmiş doldurma ve depolama (Adım 9C)

Durum: kabul edildi. Tarih: 2026-10-12.

## Bağlam
Durum, Analiz ve normal bantlar bahçenin kendi geçmişine dayanır. Şu ana kadar yalnız yakın dönem sahneleri ve yılda en çok 12 sahneli bir yaz kompoziti vardı. Sentinel-2 L2A arşivi 13 Ağu 2015'te başlar; ay bazında normal bant için her ay, her yıl temsil edilmelidir.

## Kararlar
1. **Kaynak kaydı.** `data_sources` tablosu (Sentinel-2 L2A etkin; Sentinel-1, Landsat LST, ERA5-Land «planlı»: 9D/9E) ve `acquisitions` tablosu (bahçe × kaynak × sahne: tarih, bulut %, durum net/bulutlu/hata, gecikme, işleme sürümü, formül sürümü, dosya yolu ve boyutu). Mevcut `scene_observations` / `index_observations` yakın dönem arayüzü için korunur; arşiv ve normal bantlar yeni tablolardan beslenir.
2. **Sahne bütçesi: ay başına en iyi 2 net sahne, aralarında en az 10 gün** (yılda en çok ~24). Gerekçe: aylık normal bant için her ayın temsil edilmesi gerekir; 5 günlük tekrar süresinde 2 sahne mevsimsel değişimi yakalar, bulutlu ayda 0–1 sahne olabilir ve **o ay bant hesabında eksik sayılır, değer uydurulmaz**. Yılda 12 sahne yalnız yaz kompozitine yeterdi.
3. **Depolama: ham bant saklanmaz.** Bahçeye kırpılmış, kanonik 10 m UTM ızgarasında **hesaplanmış gösterge ızgaraları (float16, sıkıştırılmış .npz)** ve piksel istatistikleri (ortalama, medyan, p10/p25/p75/p90, min, maks, geçerli piksel) saklanır. Gerekçe: boyut (bahçe başına yüzlerce sahne × 5 gösterge) ve tekrar hesaplama ihtiyacı.
4. **Yeniden hesaplanabilirlik.** Her kayıt `scene_id`, `isleme_surumu` (processing baseline) ve `formul_surumu` taşır. Formül değişirse (`FORMULA_VERSION`) eski sürümlü kayıtlar **arşivden yeniden okunup** hesaplanır; ham bant saklanmadığı için kaynak her zaman Planetary Computer'dır. Radyometri ürün meta verisinden (ADR 0012) okunur.
5. **Beş gösterge:** NDVI, NDMI, NDRE, MSAVI ve **LAI**; LAI ham bantlardan gerektiği için çekim sırasında hesaplanıp 5. gösterge olarak saklanır (sonradan eklemek tüm arşivi yeniden okumak demek olurdu).
6. **Geçmiş doldurma:** bahçe eklenince (ve sınır değişince) 2015'ten bugüne ay ay çalışır; ay başına bir görev: idempotent (`claim`), kaldığı yerden devam eder, ilerleme tablodan hesaplanır ve API'de verilir. Günlük artımlı çekim yalnız yeni sahneleri alır (aynı seçim kuralı).
7. **Normal bantlar** (gösterge × ay × bahçe): p10/p25/ortanca/p75/p90, 2015–2025. Yetersiz veri ve uyumsuz/hariç yıllar banda girmez. Eşikler katalogda ön değer: **p25–p75 için en az 5 yıl, p10–p90 için en az 8 yıl**; altında «yetersiz geçmiş».

## LAI kaynağı, doğrulama ve lisansı
- **Algoritma belgesi:** ESA'nın yayımladığı *S2 ToolBox Level 2 products: LAI, FAPAR, FCOVER*, ATBD **v1.1** (Weiss & Baret, INRA, 02.05.2016): <http://step.esa.int/docs/extra/ATBD_S2ToolBox_L2B_V1.1.pdf> (SHA-256 `51a3a90e…ad1d`, 53 sayfa). Belgeden doğrulananlar (testlerle kilitli, `tests/test_biophys_lai.py`): 11 girdili (8 bant + cos(görüş zeniti), cos(güneş zeniti), cos(göreli azimut)) 5 nöronlu tek gizli katman + doğrusal çıkış (§3.4.2), tansig aktivasyon = tanh (§4.2), girdi normalizasyonu X* = 2(X−Xmin)/(Xmax−Xmin)−1 ve çıktı denormalizasyonu (Denklem 6, §4.2), tanım alanı: 8 bant için sınır kutusu (Tablo 8) ve 10 sınıflı ızgara yaklaşımı (§3.5.1), uç değer toleransı.
- **Sayısal katsayılar:** ATBD'nin PDF'inde değil, algoritmayla birlikte dağıtılan parametre tablolarında (`Algo_S2_V2.1_SL2T_LAI.xlsx`) bulunur. Kullandığımız v2.1 katsayıları SNAP/S2TBX'in `auxdata/2_1/LAI` dizininden alınmış **veri dosyalarıdır** (kod değil; Java kodu kullanılmadı, algoritma ATBD'den yeniden yazıldı). Tanım alanı sınır kutusu v2.1'de ATBD v1.1 Tablo 8'den birkaç yüzde farklıdır (v1.1 yuvarlak ve eski; test aralığı ±0,03).
- **Bağımsız doğrulama:** port, SNAP'in kendi 100 referans vakasını (`LAI_TestCases`) 100/100 geçerli ve en büyük sapma 2,4·10⁻⁴ ile yeniden üretir.
- **Lisans (AÇIK MADDE — ticari yayından önce hukuki kontrol):** katsayı dosyalarının dağıtıldığı S2TBX deposu GPL-3.0'dır. Algoritma yayımlanmış bir bilimsel belgedir ve kodumuz S2TBX kodundan türetilmemiştir; ancak katsayı dosyalarının kaynağı ve yeniden dağıtım koşulları ticari yayından önce hukuken doğrulanmalıdır (gerekirse INRAE'den doğrudan izin / katsayıları ATBD ekinden alma).
- **Durum:** LAI arayüzde «deneysel» etiketlidir ve Durum skoruna girmez.
- **Açı verisi:** güneş açıları STAC kaydından (`s2:mean_solar_*`; granül meta verisiyle fark 0). STAC'ta görüş açısı yoktur. Aynı karo ve göreli yörüngede görüş açıları pratikte sabittir (zenit 6,1–6,2°, azimut 283–285°); 12 gerçek sahnede STAC güneş açısı + (karo, yörünge) başına tek kez okunan görüş açısıyla LAI, sahne başına granül açılarına göre **en çok 0,001** farklıdır (eşik 0,05). Bu yüzden sahne başına granül indirmesi (~0,5 MB) kaldırıldı; karo/yörünge başına bir kez okunur. (Tüm olası görüş açıları taransa fark 0,12'ye çıkar; sabit bir ulusal ortalama kullanılmadı.)

## Sonuçlar
- Normal bant, Durum eğrisi ve çubukları bu verilerden beslenir (9C-B/D).
- Veri kaynakları tablosu 9D (Sentinel-1) ve 9E (Landsat, ERA5-Land) için yer açar.
- Bahçe başına depolama boyutu `acquisitions.izgara_boyut_bayt` toplamıyla raporlanır.
