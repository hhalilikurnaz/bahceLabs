# 0019 — Geçmiş sayfası, Saha Defteri (doğrulama veri modeli) ve dona bağlı değişim anomalisi (Adım 9G)

Durum: kabul edildi. Tarih: 2026-10-29.

## Bağlam
9F uydu ve hava verisinden **olay** ve **kademe** üretti; ama bu bulguların sahada gerçekten olup olmadığını bilmiyoruz. 9G iki ayrı yüz ekler:

- **Geçmiş**: bahçenin yıllar içindeki seyrini gösterir (zamanın aynası). Yeni veri üretmez, var olan kayıtları okur.
- **Saha Defteri**: sahadaki gerçeği toplar (doğrulama aracı) — konumlu kayıtlar, «Uydu haklı mıydı?» yanıtları ve açık uyarılardan otomatik **saha turu**. Geçmiş'ten işlevce ayrıdır; ikisi aynı olay anahtarlarıyla birbirine bağlanır.

Ayrıca 9F düzeltme turunda dona bağlı optik hasar izini yalnız piksel yamasıyla arıyorduk; bahçe geneli, yama oluşturmayan ama diğer yılların aynı penceresine göre sıra dışı düşüşleri kaçırıyordu.

## Kararlar

### 1. Geçmiş sayfası
1. Ayrı rota `/bahceler/:id/gecmis`; çalışma alanı haritasını **bağlantıyla** açar (`?katman=`, `?tarih=`, `?yil=`, `?olay=`). Bağlantı bir kez uygulanır ve adresten silinir; sayfa durumu paylaşılan zustand deposunda tutulmaz (bahçe değişiminde sıfırlanan görünümle yarışmasın).
2. **Sezon bandı:** mevcut «Bu sezon, önceki N sezon içinde» bileşeni (p10–p90 açık, p25–p75 koyu, kesikli ortanca, bu yılın çizgisi); Canlılık / Klorofil / Yaprak suyu seçilir; aya dokunmak haritayı o aya açar.
3. **Aynı bahçe, N yaz:** her yılın Haziran–Eylül ortancası küçük harita; **tek ortak skala** (kıyaslanabilir); çok yıllı analizin «uyumsuz» saydığı yıl kesikli çerçeve; analiz yoksa boş durum (uydurma kare yok). Dokunmak haritayı o yılın yaz kompozitine açar (`yil` görünümü; yalnız Canlılık katmanı).
4. **Olay zaman çizelgesi 2015→bugün:** tür ve güven süzgeçleri; birleşen olay («don + optik hasar izi») **tek satır** (hem Don hem Optik düşüş süzgecinde bulunur); saha kayıtları ayrı süzgeçle aynı çizelgede; çiftçinin yanıtı rozet olarak olayın yanında.
5. **Yıl özeti** (`GET /gardens/{id}/gecmis-ozeti`): yaz canlılığı **diğer yıllara göre** tek etiket kuralıyla (p25–p75 normal … <p10 / >p90 belirgin; **sayı gösterilmez**; ≥ 5 diğer yıl yoksa «yetersiz»); olay sayısı; uyumsuz yıl; hasat (**yalnız** Saha Defteri hasat kaydından; yoksa «kayıt yok»).
6. **Yeşerme başlangıcı** yalnız eğri güvenilirse ve «ön değer» etiketiyle: kış tabanı (Oca–15 Şub ortancası) ile ilkbahar tepesi (1 Mar–15 Haz) farkının %25'ini **14 gün kalıcı** aştığı ilk gün; genlik ≥ 0,05, ≥ 8 gerçek gözlem, eğri noktalarının ≥ %60'ı gözlem destekli. Aksi hâlde **hiç gösterilmez** (jlnnlk'ta hiçbir yılda güvenilir çıkmadı). Eşikler katalog `gecmis` (ön değer).

### 2. Saha Defteri veri modeli (migrasyon `032_field_book`)
7. `field_records` — gözlem · ilaçlama · gübreleme · sulama · hasat · tuzak; tarih, **isteğe bağlı** konum (WGS84 nokta ya da alan), not, türe özgü `ayrinti`. Konum bahçeye ≤ 500 m, alan ≤ 5.000 da, geçerli GeoJSON olmalı; kayıt sahibi bahçenin çalışma alanıdır (başkasının bahçesi 404).
8. `field_photos` — kayda **ya da** doğrulamaya bağlı (CHECK: tam biri). Yüklenen dosya Pillow ile doğrulanır (yalnız JPEG/PNG/WebP, ≤ 6 MB), uzun kenar 1600 px'e indirilir ve **EXIF'siz JPEG** olarak yeniden kodlanır; kayıt başına ≤ 5 fotoğraf; bahçe ya da kayıt silinince dosyalar da silinir.
9. `event_verifications` — **olay anahtarıyla** (`events.anahtar`) bağlıdır, olay kimliğiyle değil: olay motoru olayları idempotent yeniden kurar ve bileşimi değişen olayın kimliği değişebilir/silinebilir. Doğrulama olayın o anki özetini (başlık, tür grubu, tarih, güven, durum) **taşır**; olay kalksa bile çiftçinin yargısı ve doğruluk özeti kaybolmaz. Hedef türü `olay` ya da `uyari` (bildirim); (bahçe, hedef, anahtar) tekildir (yeniden yanıt üzerine yazar).
10. `tour_visits` — saha turu noktası anahtarıyla «ziyaret edildi» (isteğe bağlı kayıt bağlantısı; kayıt silinirse bağ kopar, ziyaret kalır).
11. «Sonuç olay kaydına yazılır» = olay yanıtı (`/olaylar`) çiftçi sonucunu (`dogrulama`) anahtar eşlemesiyle taşır; olay satırı yeniden yazılsa da yanıt sürer.

### 3. «Uydu haklı mıydı?» akışı
12. Her **olay** (doğrulama bekleyenler dâhil), her **uyarı** (kritik/uyarı öncelikli bildirimler; olay bildirimleri çift sayılmaz) ve hedefi artık listelenmeyen geçmiş doğrulamalar için kart. Yanıtsızlar önce, «doğrulama bekliyor» en üstte. Üç seçenek: gerçekleşti / gerçekleşmedi / **bilinmiyor** (+ not, + fotoğraf). *Bilinmiyor yargı sayılmaz.*
13. **Doğruluk özeti:** tür başına (don · yağış · rüzgâr · optik · radar · uyarılar) doğrulanan, yanlış alarm, bilinmiyor, bekleyen. Bir türde **< 5 doğrulama** varsa oran/sayı yorumlanmaz: «henüz yeterli doğrulama yok (n/5)» (katalog `saha.dogruluk_asgari_n`, ön değer). Doğrulama ceza ya da puan üretmez; yalnızca uydunun hangi türde ne kadar haklı çıktığını ölçer.
14. `docs/agro/olay-dogrulama.md` **bu veriden üretilir** (`scripts/export_event_validation.py`): yanıtlar, notlar ve doğruluk özeti dosyada; yanıtsız olaylarda seçenekler boş durur.

### 4. Saha turu (otomatik)
15. Noktalar **mevcut kayıtlardan okunur**, yeni veri üretilmez: (a) «doğrulama bekliyor» olayın yama merkezi (olay `ayrinti`sine S2 yamasının ağırlık merkezi yazılır; anomali yolunda konum yok → bahçe geneli notu), (b) çok yıllı analizin yıllardır zayıf kalan bölgesi (mevcut zayıf bölge kuralı), (c) son net görüntüdeki **stres yaması**.
16. **Stres yaması** (katalog `saha`, ön değer): görüntünün KENDİ dağılımının alt %10'unun altında bitişik küme; ≥ 1 da ve alt %10'daki piksellerin ≥ %50'sini içerir (dağınık benek yama değildir). İki bahçede 2015–bugün yılda ortalama ~2 olgu: alarm sağanağı yok ([stres-yamasi-raporu.md](../../agro/stres-yamasi-raporu.md)). Tura yalnız **en son** görüntüdeki yama girer.
17. **Sıra:** en yakın komşu (düz çizgi mesafesi), başlangıç = verilen konum (tarayıcı konumu isteğe bağlı) ya da bahçe merkezi; ziyaret edilenler rotadan çıkar, listenin sonunda kalır; en çok 12 nokta, önem sırasıyla seçilir. Rota haritada **kesikli çizgi**dir ve yaklaşık sıradır — gerçek yürüyüş yolu değildir (arayüz bunu söyler). Süre: **55 m/dk** + nokta başına 4 dk (katalog, ön değer).

### 5. Fotoğraf EXIF önerisi
18. `POST …/saha-fotograf-oneri`: dosya **saklanmadan** EXIF çekim tarihi ve GPS konumu okunur; tarih gelecekte/anlamsızsa ve konum (0,0) ise önerilmez; konum bahçeye ≤ 500 m ise önerilir, değilse «uzakta» denir. Arayüz öneriyi gösterir; tarih ve konum **yalnız kullanıcı onaylarsa** forma yazılır. Saklanan dosyada EXIF yine yoktur (yukarıda 8).

### 6. Dona bağlı değişim anomalisi (olay motoru)
19. Dona bağlı bir S2 adayı (don bitişinden sonra 0..+21 günde başlayabilen düşüş) için **iki yoldan biri** yeterlidir: **piksel yaması** (mevcut kural) **ya da** **değişim anomalisi** — bahçe ortancası Δ'sı, diğer yılların aynı ±15 gün penceresindeki ardışık çift Δ dağılımının **p10'unun altında** (≥ 5 örnek). Dona bağlı olmayan adaylarda anomali yolu **kullanılmaz** (mevsimsel gürültü olay üretmesin).
20. **Kalıcılık her yolda kendi ölçüsüyle aranır ve yollar karışmaz:** yama → yama pikselleri sonraki görüntüde de dönem p10 altında; anomali → önceki→SONRAKİ ortanca Δ, düşüşün ≥ %50'si. Seçilen yolun sinyali yalnız kendi düşüşünü ve kalıcılığını taşır (anomali yolunda yama alanı/Δ'sı taşınmaz). `s2_scan` her çift için iki yolun sayılarını döker (rapor ve test bunu okur). Eşikler katalog `olay` (ön değer): `anomali_min_ornek`, `anomali_kalicilik_orani`.
21. Sonuç (iki bahçe): jlnnlk olay 31, şüphe 6 (önce 7); soğuk hava olay 28, şüphe 7 (değişmedi). Dona bağlı optik iz — jlnnlk: Oca 2016 (yama), Şub 2020 (anomali, yeni), Mar 2022 (anomali; önceki turda mevsimsellik diye elenmişti), Şub 2025 (anomali, yeni: yama toparlanmış ama bahçe ortancası düşüşün %72'sini koruyor). Ayrıntı: [degisim-anomalisi.md](../../agro/degisim-anomalisi.md).

### 7. Bildirim → harita bağlantıları (İlke 7)
22. Bildirim ve günlük özet **maddesi** ilgili alana açılır: olay bildirimi `?olay=<kimlik>` (olayın görüldüğü ilk net görüntü + olay kartı; hava olaylarında kart Hava sekmesine bağlar), uydu düşüşü `?katman=<katman>&tarih=<düşüşü gören görüntü>`, çok yıllı analiz `?katman=bolgeler`. Özet kartında her madde kendi bağlantısını açar. Olay yeniden kurulup kimliği değişmişse arayüz «bu olay artık listede yok» der (sessiz hata yok).

### 8. Zaman
23. Backend testleri **sabit saat**te koşar (Europe/Istanbul 2026-10-10 12:00'den ilerleyen `time-machine`); «bugün» uygulamada da Europe/Istanbul takvim günüdür (`shared/clock.py`). Sistem saatine, UTC/yerel kaymaya ya da gece yarısına bağlı test kalmadı.

## Alternatifler
- *Doğrulamayı olay kimliğine bağlamak:* olay yeniden kurulunca yargı kaybolurdu → anahtar + özet.
- *Hasat için ayrı tablo:* aynı kayıt modeli yeterli; hasat yalnız `tur='hasat'` kaydıdır, uydurma/varsayılan yok.
- *Anomali yolunu tüm adaylara açmak:* mevsimsel değişimi olaya çevirirdi → yalnız dona bağlı.
- *Rotayı yol ağıyla hesaplamak:* bahçe içi patikalar haritada yok; yanıltıcı kesinlik yerine «yaklaşık sıra» denir.
- *EXIF'i saklamak:* konum ve zaman sızıntısı; öneri okunur, dosyada tutulmaz.

## Sonuçlar
- Çiftçi yanıtları biriktikçe tür başına uydu doğruluğu ölçülebilir; ≥ 5 doğrulama olmadan hiçbir oran gösterilmez. Eşikler (olay, anomali, stres yaması, yeşerme) doğrulama verisiyle mühendis onayına sunulacak.
- Yeni veri yoksa arayüz boş durum gösterir (tur noktası, yaz haritası, yeşerme, hasat): sahte örnek yok.
- Geçmiş ve Defter aynı olay anahtarlarıyla konuşur; olay motoru değişse de yanıtlar kalır.

## Açık konular
- Saha Defteri çevrimdışı çalışma ve yazdırma düzeni (şimdilik yazdır düğmesi; çevrimdışı kuyruk Adım 11).
- Doğrulama verisi çok bahçeli/çok kullanıcılı olduğunda kullanıcıya göre ayrım (Adım 19).
- Stres yaması ve anomali eşikleri ön değer · mühendis onayı bekliyor.
