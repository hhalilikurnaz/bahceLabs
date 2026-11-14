# 0031 — Topografya profili ve gece don riski (ADIM 10 · Dilim 1)

Durum: kabul edildi (Dilim 1 motoru; arayüz ve bildirim Dilim 2 onayına bağlı). Tarih: 2026-11-14. İlgili: ADR 0018 (olay motoru), ADR 0021 (olay ön doğrulaması), ADR 0030 (izleme), `docs/agro/don-dogrulama.md` (kanıt), `docs/agro/KURAL-DURUMU.md` (ADIM 10).

## Karar
Bahçe için (a) betimleyici **topografya profili** (°C vermez), (b) **olasılıksal gece don riski** (3 gece, saatlik), (c) kural performansına bağlanan **geri bildirim**, (d) olay motorundaki don olaylarının **yeniden değerlendirmesi** (silmeden, işaretle) eklenir. **Arazi tabanlı mutlak sıcaklık düzeltmesi YOKTUR.**

## 1) Tahmin kaynağı: «en soğuk model», sapma düzeltmesi yok
Open-Meteo tahmin API'si, `ecmwf_ifs025`, `icon_seamless`, `gfs_seamless` saatlik; bir gecenin minimumu = sabah günü takvim gününün saatlik minimumu (doğrulamayla AYNI tanım), üç modelin **en düşüğü** esas alınır. Gerekçe (don-dogrulama.md §6): kıyıda yanlılık −0,01 K, RMSE 2,33 K, 1–3 gün önceden bozulma yok, kaçırmayan tarafta.
**Sapma düzeltmesi yapılmaz.** Kural: «benzer rakım ve denize uzaklıktaki ≥ 3 istasyon aynı yönde ve tutarlı» → sağlanmadı (alçak kıyı istasyonlarında IFS yanlılığı −3,05 … +4,81 K, ICON hep pozitif ama 6 K aralık). Tek kıyı/şehir istasyonuna (Mersin 17340) göre ısıtma/soğutma temsil sorunu doğurur ve Şubat 2025 don zararı dış olay kataloğunda kayıtlıdır; bu yüzden ham model + geniş σ (2,4 K).

## 2) İki kademeli bildirim kuralı ve seçimi
- **İzle** (yalnız uygulama içi, bildirim yok): en soğuk model ≤ kritik + 3 K — kaçırmama bunun işi.
- **Uyarı** (18:00 bildirimi, bahçenin yerel saati): aday kurallar aynı 68 istasyon × 2 kış verisiyle sınandı (`docs/agro/don-dilim0/kural-secimi.json`; kıyı 39, tüm istasyonlar 3 520 gözlenen ≤ 0 °C gecesi):

| Kural | Kıyı POD / FAR (alarm) | Tüm istasyonlar POD / FAR |
|---|---|---|
| **A** en soğuk ≤ kritik + 2 K | **0,846 (33/39) / 0,64 (92)** | 0,949 / 0,364 |
| B: A ve ≥ 2 model ≤ kritik + 3 K | 0,79 / 0,59 (76) | 0,91 / 0,33 |
| B (4 K uzlaşı) | 0,82 / 0,64 (88) | 0,94 / 0,35 |
| C: B ve bulut < %40, rüzgâr < 3 m/s | 0,51 / 0,65 (57) | 0,45 / 0,25 |
| C (bulut < %60, rüzgâr < 4 m/s) | 0,69 / 0,61 (70) | 0,59 / 0,27 |
| C (bulut < %100, rüzgâr < 4 m/s) | 0,74 / 0,61 (75) | 0,88 / 0,34 |

**Seçim: A.** Ölçüt «kıyıda POD ≥ 0,85, en düşük FAR»: A'nın kıyı POD'u 33/39 = **0,846** (çıtanın 0,004 altında; kıyıda 39 gecelik örneklemde 1 gece farkıdır), B ve C ise 0,50–0,82'ye düşürür ve FAR'ı yalnız 0,64 → 0,59–0,61'e indirir (−3…−5 puan). C'de tahmin bulutu/rüzgârı don gecelerini ayırt etmedi (tüm istasyonlarda POD 0,45): açık-sakin eşikleri gevşetildikçe POD ancak kapısız B'ye yaklaşır; eşikler veriye göre ayarlanabilir ama kazanım yok → seçilmedi. Kışlar ayrı: tüm istasyonlarda 2023-24 POD 0,914 / FAR 0,45, 2024-25 0,957 / 0,34 (tutarlı); kıyıda 2023-24'te yalnız 4 don gecesi var (POD 0,50), 2024-25'te 35 gece (POD 0,886 / FAR 0,635) → kıyı kış-bazlı doğrulaması istatistiksel güç taşımaz. **Bilinen bedel:** kıyıda uyarıların ≈ %64'ü yanlış çıkar. Bahçe bazında yanlış alarm oranı geri bildirimle (§4) ileride ayarlanır.

## 3) Kritik sıcaklık ve fenoloji
`don.kritik_c` (katalog): çiçek −2,8 °C; yeni meyve −0,8; yeşil meyve −1,4; olgun meyve −0,8 — UC ANR 8100 Tablo 2 ve FAO Tablo 4.10'un iki kaynağından uyarı için **daha temkinli (yüksek)** uç. **Yaprak ve odun modelden çıkarıldı** (limona özgü sayısal kaynak yok; KURAL-DURUMU'nda «mühendis girdisi bekleniyor»). Evre → organ eşlemesi katalogda (`evre_organ`; en hassas organ). **Süre:** iki kaynak çelişir (UC: nem/süre etkili; FAO: 2–24 sa için süreden bağımsız) → uyarı için kısa süre yeter; eşik altı saat sayısı **bilgi** olarak saklanır, seviyeyi kısıtlamaz.

## 4) Dil, geri bildirim, kural performansı
Kullanıcıya **olasılık sözcüğü**: düşük (yok) / orta (izle) / yüksek (uyarı); «Bu gece don olasılığı: yüksek»; sayısal olasılık yalnız iç denetimdedir. Her yanıtta «Uyarılarımız bilerek temkinlidir» notu ve «nasıl hesaplandı» metni. Uyarı gecesinin ertesi sabahı (08:00 yerel) **«Don oldu mu? (oldu / olmadı / bilmiyorum)»**; yanıt `don_geri_bildirim`'e yazılır ve 9J kural performansında yeni kural **`don_uyari`** olur (üretilen = uyarı geceleri; yanıt; isabet = oldu/(oldu+olmadı); olmadı = yanlış alarm; yanıt eşiğin altındaysa «ölçülemiyor»). **Bildirim ve soru `don.bildirim_acik` ile kapalı** gelir (eski «hava_don» bildirimiyle çift uyarı olmasın); açma kararı Dilim 2'dedir.

## 5) Topografya profili (`bahce_topografya`)
Copernicus DEM GLO-30 (30 m, AWS açık veri), 5 km pencere, bir kez (geometri/sürüm hash'i değişince yenilenir): yükseklik, eğim, bakı, TPI 300 m ve 1 km, D8 akış birikimi, çanak derinliği, gökyüzü görüş faktörü. **Bahçe içi göreli soğuk nokta** yalnız bahçe içi rölyef ≥ 10 m **ve** ortalama eğim ≥ 3° ise üretilir (göreli sıralama 0–1, °C değil; varsayım: soğuk hava alçak kısımda birikir); değilse **neden yazılır** (jlnnlk: rölyef 8 m, eğim 2,1°).

## 6) Olay motoru yeniden değerlendirmesi
Olaylar **silinmez ve değiştirilmez**; sonuç `olay_yeniden_degerlendirme`'ye «yeniden değerlendirildi» işaretiyle yazılır ve olay API'sinde `yeniden_degerlendirme` olarak görünür. **Kullanıcı doğrulamalı olaylara (Saha Defteri yanıtı) dokunulmaz.** Kural `don-yd-1`: sapma düzeltmesi yok; modelin olay en düşüğü ile ölçüm kaynaklı bağımsız istasyon gözlemi (≤ 80 km, ≤ 3) karşılaştırılır: `istasyon_destekliyor` (≤ 0 °C), `dis_kayit_destekliyor` (istasyon > 0 °C ama kamu kaydı don bildiriyor: olay KORUNUR; tek kıyı/şehir istasyonuna güvenilmez), `model_sapmasi_olasi` (istasyon > 0 °C, kamu kaydı yok ve model istasyondan ≥ σ soğuk: kanıtlanmış değil, olası), `belirsiz`, `kanit_yok`. Değişen olaylar: `docs/agro/don-dilim0/olay-yeniden-degerlendirme.md`.

## 7) Sınırlar
Tahmin başarımı kışlık 2 yıl ve kıyıda 39 don gecesi üzerinden; sınama ≤ 0 °C'de, çiçek eşiği −2,8 °C ve meyve eşiklerinin kendisi için gözlenen gece çok az (0 °C vekil). İstasyonlar şehir/havalimanı; bahçede gerçek sıcaklık bilinmiyor. Eşikler ön değer · mühendis onayı bekliyor.
