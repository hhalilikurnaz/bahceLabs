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

## LAI kaynağı ve lisansı
SNAP/S2TBX biyofizik işlemcisi v2.1 (Weiss & Baret 2016, INRAE ATBD) ağırlıkları `s2tbx-biophysical/.../auxdata/2_1/LAI/` dizininden alındı ve Python'a port edildi (`imagery/biophys.py`). **Doğrulama:** SNAP'in kendi 100 referans vakası (`LAI_TestCases`): 100/100 geçerli, en büyük sapma 2,4e-4. **Lisans notu:** S2TBX deposu GPL-3.0'dır; alınanlar sayısal katsayılar ve algoritmanın yayımlanmış ATBD verisidir, ancak ticari dağıtımdan önce hukuki değerlendirme gerekir (ürün sahibine sorulacak açık madde). LAI arayüzde «deneysel» etiketlidir ve Durum skoruna girmez.

## Sonuçlar
- Normal bant, Durum eğrisi ve çubukları bu verilerden beslenir (9C-B/D).
- Veri kaynakları tablosu 9D (Sentinel-1) ve 9E (Landsat, ERA5-Land) için yer açar.
- Bahçe başına depolama boyutu `acquisitions.izgara_boyut_bayt` toplamıyla raporlanır.
