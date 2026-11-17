# ADIM 10B · Dilim 0 — Sebep ayrıştırma (araştırma + spike)

Soru: bir bahçede/bölgede canlılık düştüğünde **olası sebep** ne? Aday sebepler: don, su, besin, hastalık/zararlı, mekanik/yönetim, görüntü kaynaklı.
Kapsam: Ar-Ge. Ürün kodu yok; spike betiği `bahcelab-backend/scripts/sebep_dilim0/spike.py`. Tüm ağırlıklar **ön değer · mühendis onayı bekliyor**.

## 1. Literatür: sebep → uydu + hava imzası

Kanıt derecesi: **A** = narenciyeye özgü, uydu tabanlı; **B** = başka ürün ya da dolaylı; **C** = yalnız mekanizma/saha bilgisi.

| Sebep | Beklenen imza | Zaman / mekân deseni | Derece | Kaynak |
|---|---|---|---|---|
| Don | Hasar donla birlikte değil, **1–3 hafta gecikmeyle** NDVI düşüşü; hava gecesi ≤ eşik | Bahçe geneli ya da çukur/alçak kesim; kalıcı | A/B | UF/IFAS HS1275, CH004 (hasarın görünme zamanı); NOAA-7 Florida 1982 don haritalama (cartogis Auto-Carto 5); Valencia Meteosat don eşiği çalışması |
| Su stresi | NDMI/NDWI düşüşü NDVI'den önce/birlikte; düşük toprak nemi, az yağış | Yaz; bahçe geneli ya da sulama/toprak sınırına uyan kümeler | B | Fas ve Sicilya narenciye NDMI/NDWI çalışmaları |
| Besin | NDRE / kırmızı-kenar göstergeleri NDVI'den önce tepki verir; **kademeli**, mevsimsel | Yavaş, bahçe geneli ya da parsel bazlı | B | Hefer Valley İHA+S2 azot çalışması; kinnow kırmızı-kenar konumu; elma/mango NDRE; UF/IFAS PP328 (belirti simetrisi) |
| Hastalık/zararlı | Yayılan, kümeli yama; hava (nem+ılık) önkoşul | Kenardan ya da odaktan genişleyen küme; aylar | B/C | Xunwu HLB uydu çalışması; Tabasco misket limonu S2; mal secco epidemiyolojisi (C) |
| Mekanik/yönetim | **Keskin kenarlı**, ani, kalıcı yama; hava/su açıklaması yok | Budama/söküm/hasat mevsimi; düzgün geometri | B/C | SITS clear-cut tespiti; Soutinho BFAST; badem budama zamanı; INRAE bahçe karıştırıcıları |
| Görüntü | Tek sahnede düşüş, sonrakinde **toparlanma**; tüm bahçe birden | Bulut/gölge/sis; mevsim fark etmez | A | Main-Knorn vd.: SCL bulut gölgesini %55,6 oranında kaçırır; MDPI Remote Sens. 13(2):300 |

**Boşluklar (dürüstçe):** besin, hastalık ve mekanik için narenciyeye özgü, doğrulanmış uydu ayrıştırma çalışması bulunamadı; bu üçü B/C derecesindedir. Kaynak bağlantıları kaynakça aşamasında tek tek yeniden açılıp doğrulanacak; doğrulanamayan satır tablodan çıkarılır.

## 2. Kanıt modeli önerisi (kural tabanlı, açıklanabilir)

- Her sebep için **lehte/aleyhte kanıt** satırları; her satırın ağırlığı katalogda «ön değer · mühendis onayı bekliyor».
- Puan **göreli sıra** içindir, olasılık değildir; ekranda yüzde gösterilmez.
- **Çekimserlik:** en iyi puan < 1,5 ya da ilk ikinin farkı < 0,5 ise sebep seçilmez («belirsiz»).
- **Fiziksel dışlama:** pencerede hava hep > +2 °C ise don −3 alır.
- Don penceresi: önceki sahne − 21 gün (katalog `olay.don_hasar_gun`) → düşüşü gören sahne.
- ML yok. Saha Defteri etiketi ve «sebep buydu» yanıtı biriktikçe ağırlıklar bu etiketlerle kalibre edilecek biçimde tasarlandı (her kanıt satırı ayrı kaydedilir).
- Kullanılan girdiler: olay deltası ve kalıcılık, düşen pay, NDMI/NDRE deltası, ERA5-Land t_min, 30 günlük toprak nemi z-skoru (aynı gün-pencerenin diğer yılları), sahne bulutu, mevsim.

## 3. Geriye dönük sınama (dev veritabanı, 2015–2026)

Veri: jlnnlk ve soğuk hava bahçeleri, 21 S2 düşüş olayı (12 + 9). İki bahçe ~100 m arayla, **aynı ERA5 hücresinde**; bağımsız örnek sayısı yaklaşık 13 tarih.

| Bahçe | Tarih | Olay | Δ NDVI | Hava min (°C) | Seçim | Kararlılık* | Bağımsız etiket |
|---|---|---|---|---|---|---|---|
| jlnnlk | 2015-09-12 | şüphe | −0,23 | 20,3 | belirsiz | 1,00 | yok |
| jlnnlk | 2016-02-09 | don | −0,22 | −1,5 | don | 0,80 | yok |
| jlnnlk | 2016-04-29 | şüphe | −0,13 | 7,4 | görüntü | 0,91 | yok |
| jlnnlk | 2017-09-26 | düşüş | −0,16 | 19,4 | su | 0,92 | yok |
| jlnnlk | 2020-03-19 | don | −0,12 | −2,6 | don | 1,00 | yok |
| jlnnlk | 2020-03-29 | düşüş | −0,12 | 2,8 | mekanik | 0,92 | yok |
| jlnnlk | 2021-02-12 | şüphe | −0,11 | 2,7 | görüntü | 0,47 | yok |
| jlnnlk | 2021-12-24 | şüphe | −0,10 | 2,4 | görüntü | 1,00 | yok |
| jlnnlk | 2022-04-13 | don | −0,13 | −2,0 | don | 1,00 | yok |
| jlnnlk | 2023-05-18 | şüphe | −0,12 | 4,2 | görüntü | 1,00 | yok |
| jlnnlk | 2024-05-22 | şüphe | −0,14 | 10,8 | belirsiz | 1,00 | yok |
| jlnnlk | 2025-03-13 | don | −0,10 | −4,9 | **don** | 1,00 | **Evet: dış katalog, Şubat 2025 don** |
| soğuk hava | 2015-09-12 | şüphe | −0,13 | 20,3 | belirsiz | 1,00 | yok |
| soğuk hava | 2019-04-04 | şüphe | −0,14 | 4,6 | görüntü | 0,52 | yok |
| soğuk hava | 2019-08-27 | şüphe | −0,14 | 20,0 | belirsiz | 0,67 | yok |
| soğuk hava | 2020-04-13 | şüphe | −0,15 | 2,8 | belirsiz | 1,00 | yok |
| soğuk hava | 2021-08-21 | şüphe | −0,10 | 21,1 | belirsiz | 0,64 | yok |
| soğuk hava | 2022-04-13 | don | −0,31 | −2,0 | don | 1,00 | yok |
| soğuk hava | 2023-05-18 | şüphe | −0,11 | 4,2 | görüntü | 0,96 | yok |
| soğuk hava | 2024-05-22 | şüphe | −0,11 | 10,8 | görüntü | 1,00 | yok |
| soğuk hava | 2025-02-01 | düşüş | −0,11 | 3,8 | mekanik | 0,51 | Kısmen: don **olmadı** (düşüş 22 Şubat donundan önce) |

\* 500 denemede sebep başına ağırlık ×U(0,7; 1,3) oynatıldığında seçimin değişmeme oranı.

**Okuma (iddia sınırı):**
- **Doğru sebebi üst sıraya koyuyor mu?** Bağımsız etiketli tek olay var (jlnnlk, Şubat 2025 don): model don seçti, kararlılık 1,00. Bir olay doğruluk ölçmez; yalnızca tutarlılık denetimidir.
- **Soğuk hava, 1 Şubat 2025:** düşüş donun 3 hafta öncesine denk geliyor. Model don'u doğru biçimde eledi (hava > +2 °C), ama seçtiği «mekanik» yalnız **diğer açıklamaların yokluğundan** geliyor (puan 2,0 vs su 1,5, kararlılık 0,51). Bu, modelin zayıf noktası: mekanik/hastalık/besin **dışlama ile** öne çıkıyor, doğrudan kanıtla değil.
- **Dairesellik:** «görüntü» seçimleri büyük ölçüde olayın «toparlandı» etiketine dayanıyor; bu etiket olay motorunun kendi çıktısı. «Don» seçimleri de olay motorunun don bağlantısıyla aynı ERA5 sıcaklığını kullanıyor. İki durumda da sonuç bağımsız doğrulama değildir.
- **Ocak 2020 sağanak (dış katalog):** bu tarihte S2 düşüşü olayı yok; sebep ayrıştırma çalışacak bir düşüş olmadığından sınanamadı. Aşırı yağışın canlılık etkisi bu veride görünmüyor.
- **Besin, hastalık, mekanik, su:** hiçbir olayda saha etiketi yok. Bu sebepler için doğruluk **ölçülemedi**.
- **Çekimserlik:** 21 olayın 7'sinde model sebep seçmedi; bunların çoğu yaz dönemi ve tüm-bahçe düşüşleri, yani en az açıklanabilir olanlar.

## 4. Ekran dili önerisi

Bahçe/vana canlılık düşüşü kartında, **«Olası sebepler (kesin değil)»** başlığı:
1. Sıralı en çok 3 sebep; yüzde yok, yalnız «daha olası / olası / düşük olasılık» sözcükleri. Seçim yoksa: «Veriler tek bir sebebi ayırt etmeye yetmiyor».
2. Her sebep için açılır **kanıt satırları**: «lehte: 14 Şubat gecesi hava −2,0 °C (ERA5-Land)», «aleyhte: NDMI düşmedi». Her satırda kaynak/tarih.
3. **Mekanik/hastalık/besin** için «başka açıklama bulunamadı, sahada kontrol edin» dili; bunlar «sebep» olarak sunulmaz.
4. **«Sahada şunlara bakın»** kontrol listesi (sebebe göre): don için yaprak kıvrılma/kahverengileşme ve gövde kabuğu; su için damlatıcı/toprak nemi; besin için yaprak damar simetrisi (UF/IFAS PP328); hastalık için küme kenarı ve yayılma yönü; mekanik için budama/söküm kaydı.
5. **«Sebep buydu»** yanıtı (don / su / besin / hastalık / mekanik / görüntü / bilmiyorum) → Saha Defteri'ne etiket olarak yazılır; kalibrasyon verisi buradan birikir.

## 5. Go / no-go ve sınırlar

**Koşullu GO — yalnız don ve görüntü kaynaklı sebepler için, «belirsiz» seçeneğiyle.**

| Sebep | Karar | Gerekçe |
|---|---|---|
| Don | GO | Fiziksel dışlama net (hava > +2 °C → don yok); bir dış etiket tutarlı; kanıt A/B |
| Görüntü kaynaklı | GO (düşük iddia) | Toparlanma/tüm-bahçe imzası açık; ama dairesel, doğrulanmamış |
| Su | Koşullu | Mantıklı imza (NDMI + toprak nemi), etiket yok; ekranda «olası» sözcüğüyle |
| Besin, hastalık, mekanik | NO-GO (şimdilik) | Narenciye uydu kanıtı yok, saha etiketi yok, dışlamayla öne çıkıyor; yalnızca «sahada kontrol edin» listesi |

**Sınırlar:** iki bahçe ilişkili (yaklaşık 13 bağımsız tarih); 1 bağımsız etiket; ağırlıklar ön değer; yalnız S2 NDVI deltası ve bahçe ortancası; parsel içi mekânsal desen (kenar keskinliği, küme yayılımı) bu spikede ölçülmedi.

**Onay sonrası önerilen sıra:** Dilim 1 — kanıt modeli motoru (don + görüntü + su), ağırlıklar katalogda, kanıt satırlarının kaydı; Saha Defteri «sebep buydu» etiketi. Besin/hastalık/mekanik, etiket birikene ve en az 2 farklı bölgeden doğrulama gelene kadar açılmaz.
