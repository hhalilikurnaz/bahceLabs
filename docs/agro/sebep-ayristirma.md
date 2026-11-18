# ADIM 10B · Dilim 0 — Sebep ayrıştırma (araştırma + spike)

Soru: bir bahçede/bölgede canlılık düştüğünde **olası sebep** ne? Aday sebepler: don, su, besin, hastalık/zararlı, mekanik/yönetim, görüntü kaynaklı.
Kapsam: Ar-Ge. Ürün kodu yok; spike betiği `bahcelab-backend/scripts/sebep_dilim0/spike.py`. Tüm ağırlıklar **ön değer · mühendis onayı bekliyor**.

## 1. Literatür: sebep → uydu + hava imzası

Kanıt derecesi: **A** = narenciyeye özgü, uydu tabanlı; **B** = başka ürün ya da dolaylı; **C** = yalnız mekanizma/saha bilgisi.

| Sebep | Beklenen imza | Zaman / mekân deseni | Derece | Kaynak |
|---|---|---|---|---|
| Don | Hasar donla birlikte değil, **gecikmeyle** (belirtiler günler–haftalar, dal ölümü aylar–iki yıl) NDVI düşüşü; hava gecesi ≤ eşik | Bahçe geneli ya da çukur/alçak kesim; kalıcı | A/B | UF/IFAS HS1275, CH004 (hasarın gecikmeli görünmesi — doğrulandı); NOAA-7 Florida 1982 don haritalama (Auto-Carto 5; PDF açıldı, içerik doğrulanamadı); Valencia Meteosat çalışması (bağlantı yok, doğrulanamadı) |
| Su stresi | NDMI/NDWI düşüşü NDVI'den önce/birlikte; düşük toprak nemi, az yağış | Yaz; bahçe geneli ya da sulama/toprak sınırına uyan kümeler | B | Fas ve Sicilya narenciye NDMI/NDWI çalışmaları |
| Besin | NDRE / kırmızı-kenar göstergeleri NDVI'den önce tepki verir; **kademeli**, mevsimsel | Yavaş, bahçe geneli ya da parsel bazlı | B | Hefer Valley İHA+S2 azot çalışması (başlık doğrulandı); kinnow kırmızı-kenar konumu; elma/mango NDRE (elma: Frontiers Plant Sci. 2025, başlık doğrulandı); UF/IFAS PP328 (HLB ve besin eksikliği ayırt etme rehberi; «orta damar simetrisi» ayrıntısı PDF'ten doğrulanamadı) |
| Hastalık/zararlı | Yayılan, kümeli yama; hava (nem+ılık) önkoşul | Kenardan ya da odaktan genişleyen küme; aylar | B/C | Xunwu HLB uydu çalışması; Tabasco misket limonu S2; mal secco epidemiyolojisi (C) |
| Mekanik/yönetim | **Keskin kenarlı**, ani, kalıcı yama; hava/su açıklaması yok | Budama/söküm/hasat mevsimi; düzgün geometri | B/C | SITS clear-cut tespiti; Soutinho BFAST; badem budama zamanı; INRAE bahçe karıştırıcıları |
| Görüntü | Tek sahnede düşüş, sonrakinde **toparlanma**; tüm bahçe birden | Bulut/gölge/sis; mevsim fark etmez | A | Sentinel-2 SCL değerlendirmesi (arXiv 2406.18584: SCL bulut gölgesi/ince bulut sınıfları verir; «%55,6 kaçırma» rakamı kaynakta bulunamadı → **kaldırıldı**); MDPI Remote Sens. 13(2):300 (403 erişim engeli, doğrulanamadı) |

**Kaynakça doğrulaması (Dilim 1):** aşağıdaki «Kaynakça» bölümü. **Boşluklar (dürüstçe):** besin, hastalık ve mekanik için narenciyeye özgü, doğrulanmış uydu ayrıştırma çalışması bulunamadı; bu üçü B/C derecesindedir. Kaynak bağlantıları kaynakça aşamasında tek tek yeniden açılıp doğrulanacak; doğrulanamayan satır tablodan çıkarılır.

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


## 6. Dilim 1 — kararlar ve sonuçlar (motor + API)

Onay kararları (3): (1) eleme ile seçim yok; (2) görüntü kaynaklı = kapı; (3) her kanıt satırında bağımsızlık etiketi. ADR: `docs/mimari/karar/0033-sebep-ayristirma.md`.

**Motor (`domain/sebep/`):** seçilebilir sebepler yalnız **don, su, görüntü kaynaklı**. Besin, hastalık, mekanik seçilemez; «sahada kontrol edin» listesi (kaynaklı madde yoksa «kaynak yok» işaretli). Seçim koşulu: en az bir DOĞRUDAN lehte kanıt + puan ≥ 2,0 + ilk iki sebep farkı ≥ 0,5; aksi halde «belirsiz» ve nedeni. Bağımsız kanıt (istasyon · dış kayıt · kullanıcı yanıtı) ×1,5; bağımsız lehte kanıt yoksa güven sözcüğü «daha olası» olamaz.

**Spike'tan farklar:** (a) «mekanik/hastalık/besin» artık seçilemez (spike'ta dışlamayla öne çıkıyordu); (b) NDMI düşüşü yalnız destekleyici (+1,0; don da düşürür) — tek başına su seçtirmez; (c) bağımsız kanıt (Mersin 17340 istasyonu, kamu kaydı, «Don oldu mu?» yanıtı) eklendi; (d) kalıcılık ölçüsü olay motorunun yama düzeyi ölçüsüdür (spike ile aynı).

**Geriye dönük çıktı (eldeki tüm veri, 21 olay; kararlılık = ağırlık ×U(0,7–1,3), 200 deneme):**

| Bahçe | Tarih | Olay (neden) | Seçim | Güven | Kararlılık | Puan |
|---|---|---|---|---|---|---|
| jlnnlk | 2015-09-12 | şüphe (tüm bahçe) | belirsiz | belirsiz | 1,00 | don −7,5 · su −0,5 · görüntü 1 |
| jlnnlk | 2016-02-09 | don | don | daha olası | 1,00 | don 7 · su 1 · görüntü −1,5 |
| jlnnlk | 2016-04-29 | şüphe (toparlandı) | görüntü | olası | 0,46 | don −7,5 · su −1 · görüntü 2 |
| jlnnlk | 2017-09-26 | düşüş | belirsiz | belirsiz | 1,00 | don −7,5 · su 1,5 · görüntü −0,5 |
| jlnnlk | 2020-03-19 | don | don | olası | 1,00 | don 3,5 · su 0 · görüntü −1,5 |
| jlnnlk | 2020-03-29 | düşüş | belirsiz | belirsiz | 1,00 | don −7 · su −2 · görüntü −0,5 |
| jlnnlk | 2021-02-12 | şüphe (toparlandı) | görüntü | olası | 0,46 | don −3 · su 0,5 · görüntü 2 |
| jlnnlk | 2021-12-24 | şüphe (toparlandı) | görüntü | olası | 1,00 | don −3 · su −2 · görüntü 3 |
| jlnnlk | 2022-04-13 | don | don | olası | 1,00 | don 3,5 · su 1 · görüntü −1,5 |
| jlnnlk | 2023-05-18 | şüphe (toparlandı) | görüntü | olası | 1,00 | don −7,5 · su −1 · görüntü 3 |
| jlnnlk | 2024-05-22 | şüphe (tüm bahçe) | belirsiz | belirsiz | 1,00 | don −7,5 · su −1 · görüntü 0,5 |
| jlnnlk | 2025-03-13 | don | **don** | **daha olası** | 1,00 | don 6,5 · su 0 · görüntü −1,5 |
| soğuk hava | 2015-09-12 | şüphe (teyit edilemedi) | belirsiz | belirsiz | 1,00 | don −7,5 · su −0,5 · görüntü 1 |
| soğuk hava | 2019-04-04 | şüphe (toparlandı) | görüntü | olası | 0,46 | don −7,5 · su 1 · görüntü 2 |
| soğuk hava | 2019-08-27 | şüphe (toparlandı) | görüntü | olası | 0,39 | don −7,5 · su 1,5 · görüntü 2 |
| soğuk hava | 2020-04-13 | şüphe (tüm bahçe) | belirsiz | belirsiz | 1,00 | don −7 · su 0 · görüntü −0,5 |
| soğuk hava | 2021-08-21 | şüphe (toparlandı) | görüntü | olası | 0,46 | don −7,5 · su 1 · görüntü 2 |
| soğuk hava | 2022-04-13 | don | don | olası | 1,00 | don 3,5 · su 1 · görüntü −1,5 |
| soğuk hava | 2023-05-18 | şüphe (toparlandı) | görüntü | olası | 1,00 | don −7,5 · su 1 · görüntü 3 |
| soğuk hava | 2024-05-22 | şüphe (toparlandı) | görüntü | olası | 1,00 | don −7,5 · su −1 · görüntü 3 |
| soğuk hava | 2025-02-01 | düşüş | **belirsiz** | belirsiz | 1,00 | don −4 · su 1 · görüntü −1,5 |

- **1 Şubat 2025 «mekanik» vakası «belirsiz»'e döndü** (testle kilitli: `test_altin_bahce_sebep_snapshot`, `test_eleme_ile_secim_yok_dogrudan_kanit_sart`). Don puanı −4: pencerede en düşük ERA5 3,8 °C ve Mersin istasyonu çelişiyor; kamu kaydı («Şubat 2025», il düzeyi) lehte ama aylık ve tek başına yetmez.
- **Şubat 2025 don (jlnnlk, bağımsız etiket):** don, «daha olası» (bağımsız istasyon kanıtı).
- **Düşüş sebebi sınırı:** «toparlandı» sonucu olay motorunun kendi etiketidir; görüntü seçimleri bu etikete kısmen dayanır (dairesel). Toparlanan 9 uyarıdan 6'sı «görüntü» (3'ü belirsiz); kalıcı 3 düşüşten hiçbiri «görüntü» seçilmedi.
- **Düşük kararlılık (0,39–0,46)** görüntü seçilen beş olayda: puan eşiğe (2,0) çok yakın; ağırlık ±%30 oynayınca belirsize düşüyor. Ekranda kararlılık «düşük» ise güven sözcüğü bir kademe düşürülmelidir (Dilim 2 kararı).

**Görüntü kapısı — geriye dönük ölçüm (uyarı ANINDAKİ veriyle, sonraki sahne yok):** uyarı nüfusu 13 (saf optik düşüş olayları + sonradan şüpheye düşenler; hepsi «doğrulama bekliyor» olarak bildirilmişti). Sonradan: 9 toparlandı, 3 kalıcı, 1 bilinmiyor.

| Kapı eşiği (görüntü puanı) | Bastırılacak uyarı | Doğru bastırma (sonra toparlandı) | Yanlış bastırma (kalıcı düşüş) |
|---|---|---|---|
| 1,0 · 1,5 · 2,0 · 2,5 · 3,0 | **0** | 0 | 0 |

Sebep: uyarı anında görüntü lehine yalnız «sahne bulutu ≥ %20» ve «bahçenin ≥ %80'i tek adımda» kanıtı vardır; görüntü puanı en çok 1,0 (tek kanıt: sahne bulutu). **Düzeltme (Dilim 2):** «sahne bulutu» Sentinel-2 karosunun (tile) genel bulut yüzdesidir, bahçeye özgü değildir; önceki cümledeki «hep < %20» yanlıştı — 13 uyarının 5'inde karo bulutu ≥ %20 idi (kalıcı gerçek düşüşlerden biri dahil: 20 Mart 2020, karo %41). Bu kanıt özgül değildir. «Toparlandı» kanıtı (puan +2) ancak SONRAKİ sahneyle gelir; o noktada olay zaten atmosfer şüphesine düşer ve mevcut akış önceki bildirimi kapatır. **Sonuç: kapı bu veride 0 uyarıyı bastırır; mevcut «bildirimi kapat» akışının önüne geçecek ek bir kazanç ölçülemedi.** Kapı kodu ve testleri hazırdır (bulutlu + tüm-bahçe düşüşünde kapanır, kalıcı/don kanıtlı olayda kapanmaz). Daha erken (uyarı anı) sinyal gerekir: SCL gölge/bulut piksel payı ya da aynı hafta ikinci sensör (Landsat/HLS) — Dilim 2'den sonra ayrı karar.

**Kullanıcı yanıtı:** «sebep buydu» (su · don · besin · hastalık/zararlı · budama/hasat · bilmiyorum) → `sebep_etiket` (ayrı tablo; yanıt anındaki model seçimi ve sırası ile birlikte) + Saha Defteri «gözlem» kaydı + 9J kural performansı `sebep_ayrisma` (isabet = motor seçimi = kullanıcı sebebi; seçim yoksa ya da «bilmiyorum» ise isabete girmez; yanıt < `kural_min_yanit` ise «ölçülemiyor»). `egitim_riza` alanı vardır, varsayılan **yok**; eğitimde kullanım açık rızaya bağlıdır (rıza metni Adım 19–20).

## Kaynakça (bağlantılar 2026-11-17'de tek tek açıldı)

| Kaynak | Bağlantı | Sonuç |
|---|---|---|
| UF/IFAS HS1275 — Freeze Damage Symptoms and Recovery for Citrus | https://ask.ifas.ufl.edu/publication/HS1275 | Açıldı; don belirtileri, kabuk kazıma, yaprak dökümü, dal ölümü aylar–iki yıl **doğrulandı** |
| UF/IFAS CH004 — Recovering from Freeze Damage | https://ask.ifas.ufl.edu/publication/CH004 | Açıldı; gecikmeli hasar, dal ölümü iki yıla kadar **doğrulandı** |
| UF/IFAS PP328 — HLB and Nutrient Deficiency Identification | https://ask.ifas.ufl.edu/publication/PP328 | Sayfa açıldı (rehber başlığı doğrulandı); «orta damar simetrisi» ayrıntısı PDF'te, PDF okunamadı → **ayrıntı doğrulanamadı** |
| UF/IFAS SS616 — Mn ve Zn (narenciye) | https://ask.ifas.ufl.edu/publication/SS616 | Açıldı; besin işlevleri (belirti ayrıntısı kullanılmadı) |
| Sentinel-2 SCL kapsama değerlendirmesi | https://arxiv.org/html/2406.18584v2 | Açıldı; SCL sınıfları (bulut gölgesi, ince bulut) **doğrulandı**; «%55,6 gölge kaçırma» rakamı **bulunamadı, kaldırıldı** |
| Hefer Valley İHA+uydu kanopi azotu | https://cris.iucc.ac.il/en/publications/multi-scale-remote-sensing-for-sustainable-citrus-farming-predict/ | Açıldı; başlık doğrulandı, içerik ayrıntısı okunmadı |
| Elma azotu, simüle uydu verisi (Frontiers Plant Sci. 2025) | https://www.frontiersin.org/articles/10.3389/fpls.2025.1613487/full | Açıldı; başlık doğrulandı (B derece: başka ürün) |
| Florida 1982 don — NOAA kutup yörüngeli (Auto-Carto 5) | https://cartogis.org/docs/proceedings/archive/auto-carto-5/pdf/an-evaluation-of-the-noaa-polar-orbiter-as-a-tool-for-mapping-freeze-damage-in-florida-during-january-1982.pdf | PDF açıldı; metin okunamadı → **içerik doğrulanamadı** |
| Narenciye mal secco, limon bahçesi toprak mikrobiyomu (PMC11276235) | https://pmc.ncbi.nlm.nih.gov/articles/PMC11276235 | Açıldı; konu mal secco (epidemiyoloji değil mikrobiyom) → **epidemiyoloji satırında kullanılamaz** |
| MDPI Remote Sens. 13(2):300 | https://www.mdpi.com/2072-4292/13/2/300 | **Açılamadı (403)** → doğrulanamadı |
| MDPI Remote Sens. 11(24):2925 | https://mdpi.com/2072-4292/11/24/2925 | **Açılamadı (403)** → doğrulanamadı |
| INRAE HAL (hal-04761841, hal-04872820) | https://hal.inrae.fr/hal-04761841v1/document | **Açılamadı** (bot doğrulaması sayfası) → doğrulanamadı |
| HLB, ResNet yaprak (ISPRS Annals X-3-2024) | https://isprs-annals.copernicus.org/articles/X-3-2024/331/2024/ | Açıldı; başlık doğrulandı (HLB, yer tabanlı çoklu bant; uydu değil) |
| Valencia Meteosat don; Sicilya NDVI+NDWI; Fas NDMI; Xunwu HLB; Tabasco misket limonu S2; SITS clear-cut; Soutinho BFAST; badem budama zamanı | — | Bu oturumda bağlantısı yok → **doğrulanamadı**; §1 tablosunda bu satırlar kaynakça tamamlanana kadar «B/C, doğrulanamadı» okunmalıdır |

Katalog (`sebep.kontrol_listesi`) yalnız doğrulanan kaynaklara bağlanır: don → HS1275, CH004; besin/hastalık → PP328 (rehber varlığı); görüntü → arXiv 2406.18584 (SCL sınıfları). Su ve mekanik maddeleri **kaynaksızdır** (kaynak: null).


## 7. Dilim 2 başı — görüntü kapısı için ERKEN sinyal ölçümü (uyarı anı, sonraki sahne yok)

Eşikler ölçümden ÖNCE belirlendi, sonuca bakılarak ayarlanmadı: (a) komşu halka (bahçe sınırından 100–300 m, yalnız ağaçlık; mevcut `sk_halka` önbelleği) aynı sahnede NDVI ya da NDMI z ≤ −1 (aynı dönemin ±15 günü, diğer yıllar) **ve** hava kanıtı yok (pencere en düşük > +2 °C, kurak toprak yok); (b) SCL bulut gölgesi (sınıf 3) + bulut olasılığı (8, 9, 10) piksel payı, bahçe + 100 m tamponda ≥ %10 **ve** hava kanıtı yok. Kabul ölçütü: toparlanmayan bir uyarı bastırılırsa kural GEÇMEZ.

| Bahçe | Tarih | Sonradan | Halka z (NDVI / NDMI) | SCL gölge+bulut | Hava kanıtı yok | (a) halka | (b) SCL |
|---|---|---|---|---|---|---|---|
| jlnnlk | 2016-04-29 | toparlandı | -0.5 / -0.7 | %0.0 | evet | — | — |
| jlnnlk | 2017-09-26 | kalıcı | -0.9 / 0.3 | %0.0 | evet | — | — |
| jlnnlk | 2020-03-29 | kalıcı | -2.4 / 1.3 | %22.9 | evet | bastırır | bastırır |
| jlnnlk | 2021-02-12 | toparlandı | -2.6 / -0.4 | %0.0 | hayır | — | — |
| jlnnlk | 2021-12-24 | toparlandı | -1.6 / 0.4 | %0.0 | evet | bastırır | — |
| jlnnlk | 2023-05-18 | toparlandı | -2.1 / -0.0 | %0.0 | evet | bastırır | — |
| soğuk hava | 2015-09-12 | bilinmiyor | — / — | %0.0 | evet | — | — |
| soğuk hava | 2019-04-04 | toparlandı | — / — | %0.0 | evet | — | — |
| soğuk hava | 2019-08-27 | toparlandı | — / — | %0.0 | evet | — | — |
| soğuk hava | 2021-08-21 | toparlandı | — / — | %0.0 | hayır | — | — |
| soğuk hava | 2023-05-18 | toparlandı | — / — | %0.0 | evet | — | — |
| soğuk hava | 2024-05-22 | toparlandı | — / — | %0.0 | evet | — | — |
| soğuk hava | 2025-02-01 | kalıcı | — / — | %0.0 | evet | — | — |

| Kural | Bastırılan | Sonradan toparlanan | Sonradan KALICI (gerçek düşüş) | Karar |
|---|---|---|---|---|
| (a) komşu halka | 3 | 2 | 1 | **GEÇMEZ** |
| (b) SCL gölge+bulut | 1 | 0 | 1 | **GEÇMEZ** |
| (a) ya da (b) | 3 | 2 | 1 | **GEÇMEZ** |

**Sonuç:** her iki kural da 20 Mart 2020 jlnnlk düşüşünü bastırırdı; bu düşüş sonraki sahnede toparlanmadı (kalıcı, gerçek). Halka z −2,4 (komşular da düştü: bölgesel, Şubat 2020 donunun gecikmiş etkisi olası — pencere dışı) ve SCL payı %22,9. Kabul ölçütü ihlal edildi: **kapı eski haliyle kalır; bu iki sinyal motora EKLENMEDİ.** Halka yalnız jlnnlk için var (soğuk hava bahçesinde `sk_halka` yok): 13 uyarının 7'si halka için değerlendirilemedi. SCL ölçümü ağ gerektirir (panel isteğinde kullanılamaz); ölçüm betiği: `scripts/sebep_dilim2_erken_sinyal.py`, yardımcı: `domain/sebep/scl.py`.
**Not:** «bölgesel düşüş + hava kanıtı yok» bu bahçede gerçek bir hasarın (gecikmiş don) de imzasıdır; halka eş zamanlı düşüşü tek başına «görüntü kaynaklı» demek için yeterli ayırt edici değildir.

**Güven kademesi (onay):** kararlılık < 0,5 ise güven sözcüğü bir kademe düşer (daha olası → olası → zayıf) ve görüntü kapısı KAPANMAZ. Altın bahçede etkilenen beş olay: jlnnlk 2016-04-29, 2021-02-12; soğuk hava 2019-04-04, 2019-08-27, 2021-08-21 (hepsi «olası» → «zayıf»; kapı kapanmaz).
