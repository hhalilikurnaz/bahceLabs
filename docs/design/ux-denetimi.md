# BahçeLab · UI/UX denetimi (yalnız analiz)

> **Durum:** 2026-10-29 · bu turda ürün koduna, tasarıma ve veriye **dokunulmadı**; yalnızca bu rapor ve `docs/design/ux-denetimi-ekranlar.pdf` üretildi.
> **Amaç:** 9H ve sonraki büyük ekranlardan önce arayüz ve görselleştirme temelini düzeltmek için dürüst bir durum tespiti.
> **Ekran görüntüleri:** `ux-denetimi-ekranlar.pdf` (60 ekran · 156 görüntü). Aşağıda görüntüler `kimlik__genişlik` biçiminde anılır (örn. **p06-j-su__1440**); PDF'te her görüntünün altında aynı kimlik, sayfa adı, genişlik, durum ve rota yazar.

## 0. Yöntem, kapsam ve sınırlar (önce bunları oku)

**Nasıl ölçtüm**
- Canlı uygulama: yerel Vite (5173) + dev API (8001) + dev veritabanındaki **gerçek iki bahçe** (`jlnnlk`, `soğuk hava`), başsız Chromium, yazılım WebGL. 1440×900, 1024×768, 390×844.
- Giriş şifresini bilmediğim için uygulamanın kendi `create_access_token` fonksiyonuyla **yalnız okuma amaçlı bir oturum çerezi** üretip tarayıcıya verdim. Veritabanına yazma yok, kod değişikliği yok.
- **Boş / yükleniyor / hata / çevrimdışı** durumlarını gerçek veriyi bozmadan, yalnızca tarayıcıda API yanıtını keserek/geciktirerek ürettim (d01–d06). Yani bu durumlar «gerçekten sunucuda oluşmuş» değil, «istemci o yanıtı alsaydı ne gösterirdi» ekranlarıdır.
- Kod envanteri: `src/features/bahcem`, `src/components`, `src/index.css`, `defter.css` taraması (regex sayımı; sayılar kesin değil, büyüklük mertebesi içindir).
- Erişilebilirlik: `@axe-core/playwright` (wcag2a/aa, 2.1, 2.2aa, best-practice) 11 sayfa × 2 genişlik, Durum ve Su için koyu tema dahil; ayrıca etkileşimli öğe boyutu ve yazı boyutu DOM ölçümü.

**Sınırlar (dürüstlük için)**
1. **«Görselleştirme ilkeleri 1–11» belgesi repoda yok.** Roadmap bu adı anıyor ama numaralı 11 maddelik bir liste bulamadım. Yerine `docs/design/KOMUTA-MERKEZI.md` (7 ilke) ve `docs/design/TASARIM-SISTEMI.md` (12 px alt sınır, 44 px hedef, tek yazı tipi çifti) ve `paletler.ts` başlığındaki kurallar ölçüt alındı. 11 maddeyi bana verirsen §g'deki önerileri ona göre yeniden eşlerim.
2. **Performans ölçümü üretim değil.** Vite dev sunucusunda (derlenmemiş, sayfa başına 230–256 istek, uydu fayansı dahil ≈21–22 MB). LCP (0,3–1,5 sn) başsız yazılım GPU'da; harita FPS'i ve katman değişim süresini **ölçmedim** (repodaki `e2e/performans.spec.ts` eşikleri 150 ms medyan / 30 fps; koşturmadım).
3. **Pazarlama sayfaları** (landing, blog) yalnız ilk ekran + axe ile bakıldı; sayfa sonuna kadar tam tur yapılmadı.
4. **Gerçek cihaz, ekran okuyucu (VoiceOver/TalkBack) ve klavye turu yapılmadı;** yalnızca otomatik tarama.
5. **Referans kıyası (§e) kendi bilgimdendir;** bu oturumda rakip ürünleri canlı açıp doğrulamadım.
6. İki bahçe de **aynı bölgede, yan yana**; çok bahçeli veya farklı iklimli bir hesabın liste/karşılaştırma davranışı görülmedi. Bu iki bahçe aynı 9 km ERA5 hücresine düştüğü için Su/Hava verileri **birebir aynı** (bkz. U-31).

**Öncelik tanımı:** **P0** yanlış / okunmaz / kırık · **P1** anlaşılması zor / tutarsız · **P2** cila.

## Özet

| | Sayı |
|---|---|
| P0 | 6 |
| P1 | 21 |
| P2 | 9 |

İyi haber: **axe ana ekranlarda 0 ihlal** (Bahçeler, Durum, Analiz, Su, Geçmiş, Saha Defteri, Ayarlar; açık ve koyu tema; 1440 ve 390). Sorunlar erişilebilirlik kurallarından çok **tutarlılık, yoğunluk, grafik doğruluğu ve hata dürüstlüğü** tarafında.

En kötü üç şey (ayrıntı §g): (1) sunucu hatası kullanıcıya «İlk bahçenizi ekleyin» diye gösteriliyor, (2) Su dengesi grafiği iki ölçeği tek eksende gösteriyor, (3) varsayılan «bahçenin kendi farkları» renk skalası 0,56 °C'lik farkı tam renk aralığına geriyor.

---

## a. Ekran ekran

Her ekran için: cevapladığı soru, iyi olanlar, sorunlar. Sorun kimlikleri (U-xx) §g'de de aynı.

### A1 · Landing (`/`) · a01-landing
**Soru:** «BahçeLab ne işe yarıyor, neden güvenmeliyim?»
**İyi:** Tam ekran dron görüntüsü güçlü ve konuya özgü; başlık (Fraunces) okunur; tek net birincil mesaj.
**Sorunlar**
- **U-17 (P1)** Logo burada renkli çubuklu «BahceLab» (ç yok), uygulamada yaprak simgeli «BahçeLab». Koyu fotoğraf üstünde yeşil logo ≈3:1 altı kontrast (`#2d6b45` / `#06140d` ≈ 2,96) → neredeyse görünmüyor (a01-landing__1440, a02-blog__1440).
- **U-18 (P1)** Metin «her ağacın sağlığını, **rekoltesini** ve su ihtiyacını tek bir haritada gösterir» diyor; rekolte (Adım 11B) yok, «her ağaç» 10 m pikselle mümkün değil. `docs/development/anti-fabrication.md` ilkesine ters bir vaat.
- **P2** Birincil düğme «Kayıtlar çok yakında» ama `/register` çalışıyor; iki düğme aynı işi söylüyor (a01-landing__1440).
- axe: `list` ve `listitem` **serious** (2 + 6 öğe; animasyonlu kartlar) → landing'de gerçek erişilebilirlik ihlali.
- Landing metninin 60/82 parçası 11 px (ölçüm).

### A2 · Blog (`/blog`, `/blog/:slug`) · a02, a03
**Soru:** «Okunacak içerik var mı?»
**İyi:** Büyük kapak, net tipografi; kart düzeni sakin.
**Sorunlar:** **P2** pazarlama sayfaları Fraunces + pill düğme dilinde, uygulama Manrope + 8 px dilinde (U-07'nin parçası). Üst bardaki logo yine düşük kontrastlı (U-17).

### A3 · Giriş / Kayıt · a04, a05, a06
**Soru:** «Hesabıma nasıl girerim?»
**İyi:** Sade form; hata mesajı net ve yerinde (a06-giris-hata__1440: «E-posta veya şifre hatalı.»); şifre göster düğmesi.
**Sorunlar**
- **U-18 (P1)** Sol panelde «PLANLAMA ALANI · Bahçenizi tek ekranda planlayın»: planlama simülasyonu arayüzden kaldırıldı (ADR 0004), vaat ürünle uyuşmuyor.
- **P2** axe `region` (moderate): sayfada landmark yok. `/bahceler/yeni` sayfasında `h1` yok (`page-has-heading-one`).

### B1 · Bahçeler (`/bahceler`) · p01, d01, d02, d03
**Soru:** «Bahçelerim nasıl, hangisine bakmalıyım?»
**İyi:** Harita + liste ilişkisi doğru; etiketler haritada; durum işareti (▲ İzle) etiketli.
**Sorunlar**
- **U-01 (P0)** `TumBahceler.tsx:57-62` yalnızca `isLoading` ve `!gardens` kontrol ediyor; **API hatasında `data` boş kalıyor ve «İlk bahçenizi ekleyin» boş durumu çıkıyor** (d03-hata__1440, __390, __1024). İki bahçesi olan kullanıcı, sunucu düştüğünde bahçelerinin silindiğini sanır. Aynı kalıp alt bileşenlerde de var (U-22).
- **U-30 (P1)** Liste yalnızca ad + alan + «İzle». İki bahçe de «İzle» olduğundan **hangisine bakılacağı söylenmiyor**; skor, değişim, son görüntü yaşı, mini çizgi yok. Sağ panel %80 boş (p01-bahceler__1440).
- **U-23 (P1)** Yükleniyor durumu tek bir gri blok (d02-yukleniyor__1440); içeriğin şeklini taklit etmiyor, harita bile yok.

### B2 · Bahçe ekle (`/bahceler/yeni`) · p15
**Soru:** «Bahçemi nasıl eklerim?»
**İyi:** Arama kutusu haritada; yol net.
**Sorunlar:** **P2** sağ panel neredeyse boş: bir gravür + tek düğme; ekleme akışının adımları (çiz / yükle) önceden görünmüyor (p15-yeni__1440). `h1` yok.

### B3 · Bahçe · Durum (`/bahceler/:id`) · p02, p03, k-*, s01, o01, o07, o08
**Soru:** «Bahçem şu an iyi mi, ne yapmalıyım?»
**İyi**
- Karar önde: «İzle» + 4 kademeli şerit; kademe rengine ek **işaret ve etiket** (renk körlüğü) (p02-j-durum__1440).
- Katman menüsü örnek kalitede: her katmanın neyi gösterdiği, kaynağı, çözünürlüğü, son tarihi (o01-katman-menusu__1440).
- Nokta incelemesi çiftçi cümlesiyle: «Bahçenin %47'i bundan zayıf.» (o08-nokta-inceleme__1440).
- Histogram lejantı haritayla bağlı (üzerine gelince pikseller vurgulanır).
**Sorunlar**
- **U-06 (P0)** Varsayılan skala «Bahçenin kendi farkları» (min–maks'a gerilmiş). Yüzey sıcaklığında lejant **35,91–36,47 °C = 0,56 °C** ve harita açık sarıdan koyu kahveye boyanıyor (k-yuzeySicakligi__1440). Radar değişiminde ±2,24 dB aralığı doygun maviye geriliyor; aynı ekranda «anlamlı değişim yok» yazıyor (k-radarDegisim__1440). **İlk bakış mesajı fiziksel gerçekle çelişiyor.** Lejant 11 px'te dürüst etiket veriyor ama haritanın kendisi yalan söylüyor.
- **U-11 (P1)** Altı satırın üçü «veri bayat» ve her satır kendini tekrar ediyor: başlık «Ağaç gücü», sağ rozet «veri bayat», alt metin «Ağaç gücü: veri bayat.» Bilgi sıfır, alan çok (p02-j-durum__1440). `▲` simgesi aynı ekranda hem «İzle» (uyarı), hem «normalden nemli» (nötr), hem «Risk aktif» için kullanılıyor.
- **U-10 (P1)** Panel ile harita bağlantısız: Analiz/Su/Hava sekmesine geçince harita **hep Canlılık** (histogram lejantı Su ve Hava sekmesinde de duruyor) (p06, p08).
- **U-20 (P1) 390 px:** ilk ekranı harita (≈440 px) + iki yüzen kontrol çubuğu doldurur, çubuklar bahçenin üstünü örter; **karar kartı kıvrımın altında** (p02-j-durum__390).
- **U-16 (P1)** Sezon eğrisi bu ekranın kıvrım altında (bkz. B8).
- Kıvrım altında «Bugün» uyarıları ayrı bir kart ve «Hava» düğmesi ile sekmeye yönlendiriyor: iyi; ama aynı uyarılar Hava sekmesinde ve bildirimlerde de var (üçleme).
- **P2** Eş-değer çizgisi onay kutusu ve Opaklık sürgüsü harita kontrol çubuğunun ilk satırında: uzman kontrolü birincil konumda.

### B4 · Bahçe · Analiz · p04, p05, s02, d05
**Soru:** «Bahçenin neresi yıllardır zayıf/güçlü?»
**İyi:** Başlık bir **bulgu cümlesi** («Güneydoğu kesim yıllardır bahçenin en güçlü kısmı»); bölge tablosunda renk karesi + desen (zayıf taramalı).
**Sorunlar**
- **P1** «Uyumsuz yıllar» kutusu bir **karar** sorusu (analizden çıkar / not ekle / geri al) ama ana başlıktan önce, ilk bakışta en çok yer kaplıyor; tablo ikinci planda.
- «Ön değer · mühendis onayı bekliyor» her kartta tekrar (U-12).
- **P2** «12 yılın tamamı ↗» ok simgesi harici bağlantı gibi; aynı uygulamada Geçmiş sayfasına gidiyor.

### B5 · Bahçe · Su · p06, p07, s03, s04, d04
**Soru:** «Sulamalı mıyım?»
**İyi:** Başlık tek cümle karar («önümüzdeki 7 gün sulama gerekmiyor»); veri yaşı ve kaynağı (ERA5-Land · 9 km · tarih) gri rozette; hata durumunda ErrorState + «Tekrar dene».
**Sorunlar**
- **U-02 (P0)** **Su dengesi** (SuDengesi.tsx:23-26,48): çubuklar sol eksendeki `51 mm / 0 / −51` ölçeğinde; birikimli çizgi **ayrı, etiketsiz bir ölçekte** (`yK`, min…maks) çiziliyor ve eksende yok; yalnız son noktada «89 mm» etiketi var. Okuyucu çizgiyi sol eksene göre okursa yanlış sonuç çıkarır; çizgi çubukların üstünden ve altından geçiyor (p06-j-su__1440, s03-su-kaydirildi__1440).
- **U-12 (P1)** Grafiklerin altındaki açıklamalar 6–8 satırlık 12 px paragraflar: «yağış ↑ · ETc ↓ · siyah çizgi: birikimli (yağış − ETc; kendi ölçeğinde, son değer sağda), 30 gün geçmiş + 7 gün tahmin…» (p06, p07). Bu metin grafiğin işi; grafik kendi başına anlatmıyor.
- **U-13 (P1)** Bu sekmenin görünür metin parçalarının **%60'ı 12 px altında** (63/105; eksen etiketleri dahil).
- **U-31 (P1)** `jlnnlk` ve `soğuk hava` için Su sekmesi **birebir aynı** (aynı nem profili, aynı normal aralık, 89 vs 86 mm). Doğrusu bu (aynı 9 km hücre) ama başlık «Kök bölgesi … nemli (%100)» bahçeye özel bir ölçüm gibi okunuyor; «bu iki bahçe aynı ERA5 hücresinde» uyarısı yok (p06 / p07).
- **U-21 (P1)** Su hata ekranı sunucu 500'ünde «**İnternet bağlantınızı** kontrol edip» diyor; neden yanlış (d04-su-hata__1440).
- **U-14 (P1)** Yüzey–hava dumbbell grafiği değer etiketleri üst üste (+10,5 / +1,6 / ● stres), 6 geçiş × 3 satır metin; legend 8 satır (s03).
- **U-09 (P1)** Alt kısımda «Adım 9H · Sulama planı ve karar kartı 9H'de» yer tutucu kartı (s04-su-kaydirildi2__1440): iç yol haritası kullanıcıya dönük.
- **Doğruluk notu (iyi):** model tahmini içi boş nokta, «ön değer» ve «model tahmini» ayrımı dürüst.

### B6 · Bahçe · Hava · p08, s05, s06
**Soru:** «Bu hafta ne zaman ilaçlarım, risk var mı?»
**İyi:** İlaçlama şeridi: renk **ve desen** (düz / çapraz / nokta) birlikte, lejant ve gerekçe satırı var (s06-hava-kaydirildi2__1440); «en iyi zaman» cümlesi çiftçi dili.
**Sorunlar**
- **U-04 (P0 · düzen)** **Bu sekmenin kartları panelin 20 px iç boşluğu olmadan kenardan kenara** gidiyor: 1440'ta x=922→1440 (ölçüm; Durum ve Su'da 942→1420). Kartlar sağ ekran kenarına yapışık, haritayla aynı çizgide başlıyor (p08-j-hava__1440). **1024'te de aynı** (p08-j-hava__1024); 390'da kartlar yine kenara yakın (p08-j-hava__390). Yani yalnız bir genişlik sorunu değil, Hava paneli kendi kabuğunu kullanıyor.
- **P1 axe `color-contrast` (serious):** «Akdeniz meyve sineği · Orta» rozeti (`bg-app-warn/14` üstünde warn metni).
- **P1 axe `heading-order`:** `h2` doğrudan `h1` olmadan.
- **U-25 (P1)** Gün kısaltmaları «Cum · Cmt · Paz · Pzt · Sal · Çar» ardışık ve benzer (Paz/Pzt) → karışıyor.
- Aynı sulama cümlesi Su başlığında ve «Sulama önerisi» kartında **iki kez** geçiyor.
- Tek vurgu rengi (turkuaz `#0b6b73`) şeritte iyi; ama başka sekmede aynı «iyi» yeşil.

### B7 · Günlük, Rapor (yer tutucu) · p09, p10
**Soru:** — (henüz cevap yok)
**Sorunlar:** **U-24 (P1)** Sekme şeridinde iki tam sekme, içerik yalnızca «Adım 11 · Günlük: … tutulacak» gravürü. Aktif sekme gibi davranıyor, ama hiçbir şey yapmıyor. İç adım adı rozeti dışarıda (U-09).

### B8 · Geçmiş (`/gecmis`) · p11, p12, d11
**Soru:** «Bu sezon geçmiş yıllara göre nasıl?»
**İyi:** «Aynı bahçe, 12 yaz» küçük-çoklu harita **ortak skalada** (ilke: karşılaştırılabilirlik); uyumsuz yıl kesikli çerçeve; sezon eğrisi dürüst: gerçek gözlem noktası ≠ tahmin (kesikli + soluk bant).
**Sorunlar**
- **U-16 (P1)** Sezon eğrisi **aşırı yüklü**: p10–p90 açık bant + p25–p75 koyu bant + ortanca kesikli çizgi + «ortanca (bugünden sonrası soluk)» + gözlem noktaları (iki kaynak, iki boyut) + tahmin bandı + radar köşeli çubukları + üçgenler + fenoloji şeridi + ay düğmeleri. İlk bakışta «bu yıl normal mi?» cevabı yok. «2026 · 0,67» etiketi eğrinin üstüne biniyor (p11-j-gecmis__1440). Ay etiketleri grafikten ≈50 px aşağıda ayrı düğme satırı: eksen koptu.
- **U-14 (P1)** Y ekseni 3 çentik **yuvarlak olmayan değerler** (0,84 · 0,67 · 0,49): `niceTicks` yardımcısı var ama yalnız Hava grafiği kullanıyor.
- **U-26 (P1)** Sayfa genişliği 1140 px, geri düğmesi gri çerçeveli «← Çalışma alanı»; Saha Defteri 1280 px ve siyah çerçeveli aynı düğme; Ayarlar 672 px.
- Mobilde (p11-j-gecmis__390) çeyrek ay etiketleri (Oca/Nis/Tem/Eki) + «ayrıntı» daraltması iyi düşünülmüş; yine de «geçmiş yılların ortancası» etiketi eğriye biniyor.
- 12 yaz küçük haritası «hepsi aynı renk skalasında» diyor; **ilk ekranda bu skalanın lejantı görünmüyor** (kıvrım altını görüntülemedim): sayısal değer okunamıyor olabilir.

### B9 · Saha Defteri (`/defter`) · p13, p14
**Soru:** «Uydu haklı mıydı? Sahada ne gördüm?»
**İyi:** «Uydunun gördüğünü siz doğrulayın» çerçevesi güçlü; dış kanıt rozeti (çelişiyor / belirsiz) kırmızı + işaret ile; üç net yanıt düğmesi (Gerçekleşti / Gerçekleşmedi / Bilinmiyor).
**Sorunlar**
- **U-03 (P0 · 390)** **«Saha kayıtları (0)» harita onay kutusu sayfanın sol üstünde, üst gezinmenin üstüne biniyor** ve «Bahçeler» sekmesini örtüyor (p13-j-defter__390). Büyük olasılıkla kapsayıcıya göre değil sayfaya göre konumlanıyor (kodu incelemedim).
- **U-08 (P1)** `defter.css` Newsreader + IBM Plex Sans + IBM Plex Mono bildiriyor; `index.html` yalnız Manrope + Fraunces yüklüyor; **ölçümde yüklü web yazı tipi yalnız Manrope**. Yani Defter, kullanıcının cihazında bu yazı tipleri yoksa Georgia / system-ui / ui-monospace ile çiziliyor; tasarlanan görünüm garanti değil.
- **U-07 (P1)** Defter ayrı bir tasarım dili: kendi renkleri (`#16181a`, `#008300`, `#b87a00`, `#d1302f`, z1–z5 olarak turuncu/mavi/amber/yeşil/mor), 2 px köşe, 28 px düğme, tabloda eşit aralıklı mono tarihler. Uygulama kabuğuyla aynı sayfada yan yana duruyor.
- Uzun tek sütun: ilk ekranda hem tur boş durumu hem 3 satır açıklama hem sekme; asıl iş (olay doğrulamak) kıvrımın altında.
- Defter'in haritası Durum haritasından **farklı görünüyor** (farklı zoom ve doygunluk; p13-j-defter__1440 ile p02-j-durum__1440 yan yana bakınca): altlık/ayar farkı olup olmadığını kodda doğrulamadım, ama kullanıcı aynı bahçeyi iki farklı görüntüde görüyor.

### B10 · Asistan, İşlerim, Hizmetler, Pazar · p16–p19
**Soru:** — (yer tutucu)
**Sorunlar:** **U-09 (P1)** «Faz 1.5», «Adım 17», «Adım 16'da açılıyor» rozetleri üst gezinmede ve sayfalarda (kodda `Adım N` metni 27, `Faz 1.5` 9 yerde). Kullanıcı için anlamsız; «yakında» tek kelime yeterli. Üç yer tutucu sayfa aynı gravür + tek cümle şablonu (tutarlı ama boş).

### B11 · Ayarlar · p20
**Soru:** «Hangi bildirimleri alayım?»
**İyi:** Anahtarların her biri başlık + tek cümle açıklama; anlaşılır dil; tutarlı hizalama.
**Sorunlar:** **P2** 11 anahtarın hepsi açık, gruplama yok (Hava / Uydu / Sistem). Hesap kartı salt okunur, çıkış ve tema başka menüde.

### Ortak 1 · Üst gezinme ve bahçe çubuğu
- **U-19 (P2) 390 px:** üst bar yalnız «Bahçeler · Asistan» gösteriyor; **İşlerim / Hizmetler / Pazar kodda bilerek gizli** (`UstGezinme.tsx`: `soon` olanlara `max-[560px]:hidden`), yani mobilde hiç erişilemiyor (p02-j-durum__390). Şu an yer tutucu sayfalar olduğu için makul bir karar; ama bu sayfalar dolunca mobil gezinme (alt çubuk veya menü) tasarlanmak zorunda, şimdiki yapıda yeri yok.
- **P1** Sekme «Su» 41×44 px (genişlik 44 altı) (axe dışı DOM ölçümü).
- Arama kutusunun placeholder'ı **kesilmiş** («— "zayıf bölgeleri gös…»).

### Ortak 2 · Bildirim paneli · o05
- **U-05 (P0)** Bildirim metni ham istisna adı gösteriyor: «Hata: **WeatherSourceError**: ERA5 arşivine şu an ulaşılamıyor.» (o05-bildirimler__1440, __390). Kullanıcıya İngilizce sınıf adı; üstelik «ÖNEMLİ» etiketiyle.
- **P1** 3 okunmamış bildirimin 3'ü de operasyonel (veri akışı) uyarısı; çiftçinin ürün kararıyla ilgisi yok, ürün ile sistem uyarıları ayrılmamış.
- Panelin altı kart ortasında kesiliyor (iç kaydırma beklenen, ama kesim butonların ortasında).

### Ortak 3 · Komut paleti · o04
**P2** Arka plan kararmıyor; giriş alanı kalın sarı çerçeveyle dış kenara dayalı (o04-komut-paleti__1440). Öneriler iyi («zayıf bölgeleri göster»).

### Ortak 4 · Çevrimdışı · d06
**P2** Koyu, yüzen bant üst gezinmeyi örtüyor ve açık temayla uyumsuz (d06-cevrimdisi__1440). Metin iyi («Son yüklenen bilgiler gösteriliyor»).

### Ortak 5 · Yükleniyor / boş / hata
- **U-23 (P1)** Yükleniyor: tek gri blok; Analiz yüklenirken harita tarih kutusu «**— görüntü yok**» diyor (d05-analiz-yukleniyor__1440): yükleniyor ile yok karışık.
- **U-22 (P1)** Hata sessizce «yok»a dönüşüyor: `SezonEgrisi` (hata → «Bu gösterge için henüz net görüntü… yok»), `GostergeCubuklari`, Katman menüsü, Geçmiş alt bileşenleri `isError` bakmıyor. Yalnız ana paneller (`DurumPaneli`, `AnalizPaneli`, `SuPaneli`) ErrorState gösteriyor.
- **İyi:** `ErrorState` bileşeni tutarlı (simge + başlık + açıklama + «Tekrar dene») ve kullanılıyor (10 yerde).

### Ortak 6 · Koyu tema · d09–d11
**İyi:** Koyu tema temiz; kontrastlar korunmuş (dim/kart 5,6:1, muted/panel 7,5:1). Histogram, grafikler token kullandığı için sorunsuz döner. **P2** Koyu temada harita lejant paneli ve grafik «gri bant» daha az ayrışıyor.

---

## b. Görsel hiyerarşi ve düzen

**İlk bakışta göz nereye gidiyor?**
- **Çalışma alanı (Durum/Analiz/Su/Hava) 1440:** göz **haritadaki renkli ızgaraya** gidiyor (en büyük, en doygun yüzey), sonra sağ panelde başlık. Doğru: «harita ana sahne» ilkesi tutuyor. Ama panelde karar (İzle) **küçük, solda, sarımsı-kahve** ve altındaki altı eşit ağırlıklı kart onu bastırıyor; «veri bayat» satırları görsel ağırlığı karar kadar taşıyor.
- **390:** göz haritaya + iki yüzen çubuğa gidiyor; karar ekranın %80'inin altında (U-20).
- **Su:** başlık güçlü (cümle), ama altındaki iki grafik eşit ağırlıkta ve ikisi de ince çizgi/çubuk; hangisinin karar kanıtı olduğu belli değil.
- **Geçmiş:** büyük kart + tek eğri; ilk bakış «gri-yeşil bulut». Ana mesaj («bu yıl normalin içinde») yok.
- **Defter:** metin ağırlıklı, harita solda; yeşil/kırmızı rozetler en doygun öğe; iyi.

**Ana bilgi öne çıkıyor mu?** Durum başlığında evet; Analiz'de başlık cümlesi evet; Su'da başlık evet ama kanıt grafiği yok; Hava'da («Cumartesi 07:04–17:47» yeşil, büyük) evet; Geçmiş'te hayır.

**Kalabalık / boş alan dengesi**
- Dolu: Su sekmesi (iki grafik + üç paragraf lejant + rozetler), Geçmiş sezon eğrisi, bildirim kartları.
- Boş: Bahçeler listesi (2 satır), Bahçe ekle paneli, Günlük/Rapor/Asistan sayfaları, Ayarlar sağ-sol boşluk.
- Dengesizlik: yoğun ekranlar (Su) **metinle**, boş ekranlar **boşlukla** çözülmüş; ortada bir ritim (kart başlığı + tek sayı + tek grafik) yok.

**Hizalama ve ızgara**
- Kabuk: 56 px üst bar, 52 px bahçe çubuğu, 922 px harita + ~518 px panel (sabit görünüm); panel içi 20 px kenar boşluğu — **Hava'da yok** (U-04).
- Sayfa genişlikleri: Geçmiş 1140, Defter 1280, Ayarlar 672, yer tutucular 600, auth 2 kolon: **beş farklı kolon genişliği**, ortak 12 kolonlu iskelet yok.
- Başlıklar: Durum «İzle» 26 px, Su başlığı 19–20 px 700, Hava başlığı 28 px hafif + yeşil, Geçmiş 22 px, Defter serif 28 px: **beş farklı ekran-başlığı stili**.
- Hizalama: kart başlıkları 13 px semibold sol; sayısal sağ sütunlar tabular (iyi).

---

## c. Tasarım dili envanteri (koddan)

> Kapsam: «uygulama» = `features/bahcem` + `components` (187 dosya); «pazarlama» = `features/marketing`, `auth`, `planning-simulation` (86 dosya). Sayılar regex sayımıdır.

### Tasarım dili sayısı
Aynı depoda **4 çakışan dil**:
1. **Uygulama kabuğu** (`.app-shell`): Manrope, köşe 6/8/10 px, açık/koyu token'lar.
2. **`@theme` («Limon Bahçesi»)**: Fraunces başlık, köşe 8/12/16 px, farklı krem/yeşil değerleri. `.app-shell` bunları **yeniden tanımlayarak üstünü kapatıyor** (aynı değişken adı, iki değer kümesi, iki yazı tipi); `docs/design/TASARIM-SISTEMI.md` hâlâ ilkini anlatıyor.
3. **Saha Defteri** (`.notebook`, `defter.css`): kâğıt/mürekkep paleti, Newsreader + IBM Plex (yüklenmiyor), 0–2 px köşe.
4. **Pazarlama/Auth**: Fraunces + pill düğme, `#0c2418 / #2d6b45 / #f3efe4` aileleri, 125 `rgba()` ve 12 özel gölge.
+ **Ölü**: `planning-*` token ailesi (`features/planning-simulation`, 269 kullanım), arayüzden kaldırılmış (ADR 0004) ama bundle ve token yüzeyinde duruyor. `docs/frontend/design-tokens.md` hâlâ yalnız bunu anlatıyor.

### Renkler
- Uygulamada **117 hex kullanımı, 94 benzersiz**: `paletler.ts` 55 (veri skalaları, meşru), `defter.css` 20 (ayrı dil), `indices.ts` 8, `SahaCizgileri` 6, `HaritaIsaretleri` 6, `kademe.ts` 5, `BahceSiniri` 4, `DrawController` 3. Veri paleti dışındaki **~39 hex** token'a bağlı değil.
- Pazarlama: **49 benzersiz hex, 198 kullanım**; en çok `#0c2418` (38), `#2d6b45` (21), `#f3efe4` (17).
- **Aynı rolün farklı yazımı:**
  - «Mürekkep/koyu metin»: `#13241a` (@theme) · `#17201b` (shell) · `#16181a` (defter) · `#0c1710` (forest) · `#1a241c` (marketing) = **5**.
  - «Marka yeşili»: `#2f6b3f` · `#1e4b35` · `#14472e` · `#2d6b45` · `#0c2418` · `#357a43`/`#4e8750` (veri) = **6+**.
  - «Limon sarısı birincil»: `#f2c94c` · `#e5bc2f` · `#e8bc33` · `#d8ae1f` · `#ffe28a`.
  - «Su mavisi»: `--color-app-water` `#4a7491` (shell) · `SU_RENK.su` `#2f6a99` · `SU_RENK.suSoluk` `#9ec1dc` · `yaprakSuyu` rampası · `#1f6fa8` (@theme) · `#2a78d6` (defter z2) = **3 ayrı «su» mavisi canlı kullanımda**.
  - «Sıcaklık/uyarı turuncusu»: **turuncu iki anlam taşıyor**: uyarı (`--color-app-warn` `#a24f1b`), hava sıcaklığı çizgisi (WeatherChart, `warn`), yüzey sıcaklığı (`SU_RENK.yuzey` `#c2461f`), Landsat rampası, defter z1 `#eb6834`.
  - **Hava sıcaklığı iki farklı renk:** Hava sekmesinde turuncu (`warn`), Su sekmesi dumbbell'inde gri-mavi (`SU_RENK.hava` `#4a5a66`).
- **Durum renkleri üç yerde üç değer**: shell (`success #2d6a4a / watch #8a6a0c / warn #a24f1b / danger #a8322a`), defter (`#008300 / #b87a00 / #d1302f`), @theme (`#2a7a3b / – / #9a4f08 / #b3382a`). `--color-app-watch` yalnız shell/koyuda tanımlı, @theme'de yok.
- **Kontrast (hesapladım, açık tema):** muted/kart 6,4 · dim/kart 5,1 · dim/arka plan 4,7 · watch/beyaz 5,1 · warn/beyaz 5,7 · su `#2f6a99`/beyaz 5,8 · ETc `#a8601c`/beyaz 4,8 → **hepsi AA geçer**, en düşük payı olanlar dim ve ETc rengi. **Kart kenarlığı** `#d9d6cc` beyazda 1,45:1 (dekoratif; kontrol kenarlığı `--color-app-border-strong` 3,5:1: doğru ayrım).

### Yazı boyutları ve ağırlıkları
- Ölçek token'ı: `caption 12 · small 13 · body 14 · lead 16 · h2 18 · h1 24 · display 32 · metric 44 · score 56` (belge: «12 px altı yok»).
- Gerçek: uygulamada **269 adet `text-[Npx]`** (arbitrary) vs **143 adet adlı token**. Yani **metin boyutlarının ≈%65'i token dışı**.
- Kullanılan arbitrary değerler (18): 9 · 9,5 · 10 · 10,5 · 11 · 11,5 · 12 · 12,5 · 13 · 13,5 · 14 · 15 · 16 · 19 · 20 · 22 · 26 · 28. **Yarım piksel değerler** (9,5 · 10,5 · 11,5 · 12,5 · 13,5) toplam 119 kullanım; **en sık kullanılan iki boyut `13` (61) ve `12,5` (57)**, token olan 13 (small) ile aynı iş için `12,5` yazılıyor.
- **12 px altı: 81 bildirim** (kural «12 px altı yok»). En çok: `OlayZamanCizelgesi` 7, `SezonEgrisi` 6, `KatmanMenusu` 6, `DogrulamaBolumu` 5, `KayitBolumu` 5, `HistogramLejant` 5. SVG içi `fontSize`: 8, 9,5, 10 (14×), 10,5, 11 (8×); `CHART.fontPx = 12` tanımlı ama **yalnız WeatherChart** kullanıyor.
- Ölçüm (görünür metin parçası): 12 px altı oranı **Durum %31 · Analiz %27 · Su %60 · Geçmiş %52 · Landing %73**.
- Ağırlık: `semibold` 158, `medium` 17, `bold` 16, `normal` 4; SVG'de `fontWeight` 600/700 ayrı. Aslında iki-üç ağırlık, ama `semibold` neredeyse her şeyde → **hiyerarşi ağırlıkla değil boyutla kuruluyor ve her şey kalın**.
- Yazı tipi: uygulama Manrope; başlık `font-display` 22 yerde (shell'de Manrope'a eşleniyor); Fraunces landing/auth; Defter'de 3 ek aile (yüklenmiyor). Harici bağımlılık: **Google Fonts** (üçüncü taraf istek; KVKK/performans notu).

### Boşluk
- Tailwind 4 pt ızgara; en sık: `2` (178), `3` (146), `1` (104), `1,5` (87), `2,5` (61), `0,5` (52), `4` (38), `3,5` (30). **Yarım adımlar (0,5/1,5/2,5/3,5) = 230/731 ≈ %31** (2 / 6 / 10 / 14 px: ızgara dışı).
- Kart içi boşluk: `p-3.5` (14 px) 9 kopyada, `p-3`, `p-5`, `p-4`: **kart dolgusu standardı yok**.
- Sabit px: 29 farklı `w/h/min/max-[Npx]` (19, 360, 340, 132, 560, 420, 52, 1280, 128, 92, 170, 286, 18…).
- Inline `style={{}}` 54 (uygulama) + 25 (pazarlama).

### Köşe yarıçapı
- Shell'de `rounded-sm/md/lg` = 6/8/10 px (@theme'de 8/12/16): **aynı sınıf iki değer**. Kullanım: `rounded-md` 96 · `rounded` (4 px) 31 · `rounded-full` 23 · `rounded-sm` 12 · `rounded-lg` 8; arbitrary `rounded-[2px]` 9, `[3px]` 8, `[1px]` 1; `.glass` 10 px; popup 12 px; Defter 2 px; pazarlama `xl/lg/full`. **≥9 farklı etkin yarıçap.**

### Gölge
- Token `e1/e2/e3`: **üç ayrı tanım** (@theme, `.app-shell`, koyu tema). Kullanım: `shadow-e3` 8, `e1` 6, `e2` 4, `sm` 1. Ayrıca `.glass`, popup (`0 12px 32px rgb(0 0 0 / .45)`), pazarlama **12 özel gölge** (`inset 0 1px 0 …, 0 12px 40px …` vb.).

### Diğer
- SVG `strokeWidth`: **20 farklı değer** (0,35 … 3). Ortak çizgi ağırlığı ölçeği yok.
- Breakpoint: `max-[560px]` **114 yerde**, ayrıca 900 (22), 1279 (10), 561, 480, 479, 420, 400, 1180, 1100 → **≥10 özel kırılma**; Tailwind `sm:` 14, `md:` 2, `@container` 3. İki dar-ekran mekanizması: CSS sınıfı + `useDarEkran()` JS kancası (3 yer).

### Bileşen envanteri: aynı işi yapan kopyalar

| İş | Ortak bileşen | Kopya / sapma |
|---|---|---|
| Yükleniyor iskeleti | `ui/Skeleton` (11 dosya) | **10 el yapımı** `animate-pulse rounded bg-app-card-hover` (SezonEgrisi, BulutAltindaGorus, YilTablosu, YazHaritalari…) |
| Boş durum | `ui/EmptyState` (1 dosya) + `kabuk/BosDurum` (gravürlü) | **13 el yapımı** `border-dashed … place-items-center` kutusu; yani **üç farklı boş durum biçimi** |
| Hata | `ui/ErrorState` (10) | Alt bileşenlerde hata = boş (U-22); sistem hata metni ağ varsayıyor |
| Kart | `ui/Card` (11 dosya) | **9+ el yapımı** `rounded-md border border-app-border bg-app-card p-3.5`; `.glass` (18) ayrı panel dili; `Card` kendi başlık düzenine sahip |
| Düğme | `ui/Button` (7 dosya), `IconButton` (4) | `min-h-11` 48 + `min-h-9` 23 el yapımı düğme; Defter'in `.btn` (28 px) |
| Sekme / segment | `ui/Segmented` (1), `ui/Tabs` (0) | **4 ayrı sekme uygulaması:** `BahceCubugu` (nav tablist), `SezonEgrisi` (el yapımı tablist), `KatmanMenusu`, Defter `.tab` |
| Rozet / etiket | `ui/Badge` (3), `ui/Chip` (0) | `RuleBadge`, `rounded-[2px] border px-1` (deneysel, «Adım 17», «Faz 1.5») farklı yazımlar |
| Tooltip / ipucu | `ui/Tooltip`, `ui/InfoHint` (0) | `title=` + SVG `<title>` + sayfa içi paragraf |
| Çekmece / modal | `ui/Drawer` (0), `ConfirmDialog` | Bildirim paneli, komut paleti, nokta incelemesi: **üç ayrı yüzer-panel** uygulaması |
| Mini çizgi | `ui/Sparkline` (yalnız Card içinde) | Bahçe listesinde hiç kullanılmıyor |
| Lejant | `HistogramLejant`, `BolgeLejanti` | Sezon eğrisi, Su dengesi, Nem profili, Yüzey–hava, Bulut altında: **her grafik kendi lejant paragrafı** |
| Değer eksen | `lib/chartScale.niceTicks` | yalnız 1 kullanım; diğer 6 grafik 3 çentik elle |

Sonuç: ortak kütüphane **iyi niyetle var, ama uygulama ekranları onu kullanmamış**: 14 ortak bileşenden 6'sı hiç kullanılmıyor.

---

## d. Grafik ve harita envanteri

**Kütüphane:** harici grafik kütüphanesi yok. Tüm grafikler **elle yazılmış SVG** (React), `d3-contour` yalnız eş-değer çizgisi için. `package.json`'daki `d3-scale`, `d3-shape`, `d3-array` bağımlılıkları **kodda hiç import edilmiyor** (ölü bağımlılık). Harita: MapLibre GL + Mapbox uydu altlığı, raster katmanlar `<canvas>`.

### Tür × yer × stil

| # | Grafik | Tür | Yer | Y/eksen | Etiket px | Tooltip / etkileşim | Renk |
|---|---|---|---|---|---|---|---|
| 1 | Sezon eğrisi (`SezonEgrisi`) | çizgi + iki kademeli normal bant + ortanca + gözlem noktaları + tahmin bandı + radar köşeli çubuk + fenoloji şeridi | Durum (kıvrım altı), Geçmiş | 3 çentik, yuvarlak değil; ay etiketi ayrı düğme satırı | 10 / 11 | `<title>` yalnız noktada; ay'a tıklama haritayı o aya götürür | metin rengi çizgi, `accent` %12/26 bantlar |
| 2 | Hava grafiği (`WeatherChart`) | çubuk (yağış) + çizgi (sıcaklık), çift eksen | Hava | `niceTicks`, birimli (mm / °C) renkli etiket | 12 (`CHART.fontPx`) | imleç dikey çizgi + okuma satırı | `app-water` + `app-warn` |
| 3 | Su dengesi (`SuDengesi`) | iki yönlü çubuk (yağış↑ / ETc↓) + birikimli çizgi | Su | sol: mm çubuk; **çizgi ayrı etiketsiz ölçek** | 10 / 10,5 | `<title>` günlük satır | `SU_RENK.su` / `etc` / metin; tahmin = gri bant |
| 4 | Toprak nem profili (`NemProfili`) | dikey derinlik × nem; normal aralık kutusu + bugün/30 gün çizgisi | Su | 3 çentik (0,16 / 0,34 / 0,53), **birim eksende yok** | 10 / 11 | `<title>` | `su` + `suSoluk` + gri bant |
| 5 | Yüzey–hava (`YuzeyHava`) | dumbbell + normal aralık kutusu, 6 geçiş | Su | 3 çentik °C; fark satırları | 9,5 / 10 / 10,5 / 11 | satır tıklaması haritayı o tarihe götürür | `yuzey` kırmızı-turuncu + gri-mavi hava |
| 6 | Bulut altında görüş (`BulutAltindaGorus`) | şerit (optik ● / radar ■) + RVI çizgisi | Su | RVI 2 çentik, tarih 3 | 10 / 11 | satır başı etiket | metin + gri |
| 7 | Histogram lejantı (`HistogramLejant`) | histogram (24–28 sütun) + ortanca + tipik bant | Harita köşesi | uç kelimeler («zayıf → güçlü») | 11 / 12,5 | hover: haritada ilgili pikseller vurgulanır | rampanın kendi rengi |
| 8 | Nokta incelemesi mini çizgi | çizgi 6 nokta (radar) | Harita popup | – | 10,5 | – | metin |
| 9 | Gösterge çubukları (`GostergeCubuklari`) | bullet (değer + normal bant) HTML | Durum | – | 11–12,5 | dokunma → harita katmanı | `accent` |
| 10 | Kademe şeridi (`KademeSeridi`) | 4 parçalı kategorik | Durum | – | 11,5 | – | `success/watch/warn/danger` + işaret |
| 11 | Olay zaman çizelgesi | 5 şeritli zaman çizelgesi (HTML) | Geçmiş | yıl etiketleri 10 px | 10–12 | satır → ayrıntı, «haritada göster» | monokrom |
| 12 | Yıl tablosu | tablo + kademe dili | Geçmiş, Analiz | – | 11,5–12,5 | olay sayısı → süzgeç | – |
| 13 | Yaz haritaları (`YazHaritalari`) | küçük-çoklu (12 canvas), ortak skala | Geçmiş | lejant yok | 12 | karaya dokun → harita | canlılık rampası |
| 14 | İlaçlama şeridi (`SprayStrip`) | saatlik ısı şeridi, renk + desen | Hava | saat etiketleri | 12 | hover/ok tuşu: saatin nedeni | `spray-ok/edge/no` + desen |
| 15 | 7 gün tablosu (`DailyForecast`) | tablo + ikon | Hava | – | 12–14 | – | `accent` ikon |
| 16 | **Harita rasterleri** (8 katman + Bölgeler + Değişim) | sürekli rampa (6), orantılı kareler (LAI), toprak zemin + tepe daireleri (MSAVI), iki yönlü fark (2) | Durum haritası | lejant 3 yerde | 11–12,5 | nokta incelemesi | `RAMPS` (8 tane, OKLab testli) |

### Aynı veri farklı yerde farklı mı gösteriliyor?
- **Canlılık (NDVI):** harita rampası · histogram · bullet çubuk · sezon eğrisi · 12 küçük harita · bölge tablosu: **6 görünüm, 6 farklı kodlama**; her biri meşru (konum / dağılım / bugün / zaman / yıllar / bölgeler) ama **aynı renk dili ve aynı «normal» bandı tek tanımdan** değil (bandın p25–p75 / p10–p90 rengi her yerde yeniden yazılmış).
- **Su (mavi) ve sıcaklık (turuncu):** yukarıdaki renk çakışmaları (U-15): iki farklı mavi, hava sıcaklığı iki farklı renk, turuncu hem uyarı hem sıcaklık.
- **Zaman ekseni:** 5 zaman grafiği, **4 farklı aralık** (takvim yılı · son 90 gün ×2 · 30+7 gün · 6 Landsat geçişi); hiçbirinde senkron imleç yok (yalnız Hava'da kendi içinde).
- **Normal bant:** Sezon eğrisinde alan, Nem profilinde kutu, Yüzey–hava'da kutu, Gösterge çubuğunda segment, Su dengesinde gri **«tahmin»** bandı: gri bant **hem «normal» hem «tahmin»** anlamına geliyor (Su dengesinde tahmin, Nem profilinde normal) → aynı görsel, iki anlam.
- **Etiket/lejant:** her grafik kendi lejantını 12 px paragrafla yazıyor; ortak lejant yok.

### Her grafik: doğru tür mü, ilk bakışta mesaj veriyor mu?

| # | Doğru tür? | İlk bakış mesajı? | Karar |
|---|---|---|---|
| 1 Sezon eğrisi | Evet (zaman + normal bant doğru kurgu) | **Hayır**: 8 öğe yarışıyor; «normal mi?» cümlesi yok | Sadeleştir: bant + bu yıl çizgisi; fenoloji ve radar ayrı satır; sonuç cümlesi başlıkta |
| 2 Hava | Evet (yağış çubuk + sıcaklık çizgi klasik) | Kısmen: iki eksen, 90 gün; «yağış toplamı / kuru gün» sayı yok | Eşik çizgisi (don 0 °C, 20 mm/gün) ve başlıkta toplam |
| 3 Su dengesi | Kısmen: iki yönlü çubuk iyi; **birikimli çizgi aynı eksende değil** | **Hayır**: neyin ne olduğu paragraf okunarak anlaşılıyor; **yanlış okunabilir** | Çizgiyi ayrı panele/etiketli ikinci eksene al; tek mesaj: «30 günde −X mm» |
| 4 Nem profili | Evet (derinlik ekseni doğal) | Kısmen: bugünkü doluluk yüzdesi sayısı grafikte yok; birim eksende yok | Eksene «m³/m³», sağ yanda %doluluk |
| 5 Yüzey–hava | Evet (fark = dumbbell) | Kısmen: «+3,2 °C normal bandın üstünde» başlığı iyi; altı etiket kalabalık | Etiketleri azalt, yalnız sapan geçişi renkle vurgula |
| 6 Bulut altı | Kısmen: iki satırlı şerit + RVI çizgisi üç anlam bir arada | Kısmen (üstte bulgu cümlesi var) | RVI'ı ayır |
| 7 Histogram | Evet (dağılım) | Evet; ama **skala varsayılanı yanıltıcı** (U-06) | Mutlak skala varsayılan |
| 9 Gösterge çubukları | Evet (bullet doğru) | Evet | Koru |
| 10 Kademe şeridi | Evet (sıralı 4 sınıf) | Evet | Koru; ▲ simgesini tekilleştir |
| 11 Olay zaman çizelgesi | Evet (lane timeline) | Orta | 11 px etiket → 12 px |
| 13 Yaz haritaları | Evet (small multiples) | Orta: **lejant yok**, sayı yok | Ortak mini lejant |
| 14 İlaçlama şeridi | **Çok iyi** (renk + desen + saat) | Evet | Örnek al |
| 16 Harita rampaları | Doğru: tek ton sıralı, iki yönlü diverging; OKLab/ΔE testli | İyi; skala sorunu hariç | `paletler.test` korunmalı |

---

## e. Referans kıyası

> **Kaynak notu.** Aşağıdakiler benim ürün bilgimden gelir; bu oturumda ürünleri canlı açıp doğrulamadım. Ayrıntıda (tam renk, tam etiket) yanılabilirim; kalıplar yıllardır sabit olanlardır. Karar öncesi güncel ekran görüntüsüyle teyit edilmeli.

| Ürün | Uydu verisini nasıl gösteriyor | Zaman serisini nasıl gösteriyor | Bizden iyi olduğu nokta (ilke) |
|---|---|---|---|
| **OneSoil** | Tarlayı tek indeks haritası, sabit ve basit renk skalası; harita ana ekran; tarla içi verimlilik bölgeleri hazır | Tarla başına tek NDVI çizgisi; tarih sürgüsüyle harita eşlenir; tarla listesinde satır içi mini çizgi | Tek soru, tek grafik. Harita ve çizgi aynı tarih eksenine bağlı. **Liste ekranında mini çizgi:** tıklamadan «kim kötüleşiyor» okunur (bizde Bahçeler listesi boş: U-30). |
| **Climate FieldView** | Katmanlar üst üste, sabit lejant, aynı yerde aynı biçimde; zaman için tarih şeridi | Sezon karşılaştırması yan yana iki harita, aynı skala; «geçen yıl bu tarih» tek tık | **Aynı skala = karşılaştırılabilir.** Gerilmiş skala bilinçli bir anahtar; varsayılan mutlak (bizde ters: U-06). Karşılaştırma ayrı bir ilk-sınıf mod. |
| **EOSDA** | İndeks seçici, her indeks için aynı lejant bileşeni; bölge ve verim ayrı sekme | Sezon boyu çok serili çizgi + hava (yağış çubuğu, sıcaklık çizgisi) **ortak zaman eksenli**; imleç hepsinde senkron | **Ortak zaman ekseni:** NDVI, yağış, sıcaklık üst üste aynı x'te. Bizde bunlar farklı sekmelerde 4 farklı aralıkta. |
| **Planet** | Görüntüyü görüntü olarak göster, analizi yarı saydam üste bindir; gerçek renk ↔ analiz sürgüsü; tarih/çözünürlük kenarda | Küçük resim şeridi; bulutlu tarihler soluk ve işaretli | **Tarihlerin kendisi görünür:** hangi tarihte net görüntü var, hangisi bulutlu. Bizde tek «‹ 9 Eki 2026 ›» kutusu; net/bulutlu tarihler görünmez. |
| **Doktar** | Çiftçi dili; uydu + hava + görev bir arada; haritada ad + durum | Hava ve toprak için basit çubuk/çizgi, birim açık, eşik çizgisi (don) işaretli | **Dil ve birim:** NDVI, RVI, VH dB, p10–p90, m³/m³ ön yüzde yok ya da «?» arkasında; **eşik çizgisi grafikte**. |

**Ortak çıkan 6 ilke (bizde eksik):**
1. Tek ortak zaman ekseni, senkron imleç.
2. Sabit lejant bileşeni; mutlak skala varsayılan, gerilmiş skala bilinçli seçim.
3. Hangi tarihlerde net görüntü var görünür.
4. Eşik çizgisi grafikte (don 0 °C, sulama eşiği, normal bant).
5. Liste ekranında mini çizgi.
6. Jargon arkaya, çiftçi cümlesi öne: «Nasıl hesaplandı?» arkasında.

**Bizim onlardan iyi olduğumuz yerler (dürüstlük):** belirsizliği açıkça gösteren sezon eğrisi (gözlem ≠ tahmin), «ön değer · mühendis onayı bekliyor» şeffaflığı, veri yaşı rozetleri, Saha Defteri doğrulama döngüsü (hiçbir referans bunu yapmıyor), ilaçlama şeridinin renk-desen çifti, katman menüsünün açıklama kalitesi.

---

## f. Erişilebilirlik, durum tutarlılığı, Türkçe terimler, performans

### Erişilebilirlik (axe + DOM ölçümü)
| Sayfa | 1440 axe | 390 axe | Not |
|---|---|---|---|
| Bahçeler · Durum · Analiz · Su · Geçmiş · Saha Defteri · Ayarlar | **0** | **0** | açık + koyu (Durum, Su) |
| Hava | 2 | 1 | `color-contrast` serious (Orta rozeti, 1440), `heading-order` moderate |
| Bahçe ekle | 1 | 1 | `page-has-heading-one` moderate |
| Landing | 2 serious | 2 serious | `list`, `listitem` (animasyonlu kartlar) |
| Giriş | 1 | 1 | `region` moderate |

- **Kontrast:** token düzeyinde AA sağlanıyor (bkz. §c). Axe harita üstündeki yarı saydam lejant metnini ve `<canvas>` içeriğini **doğrulayamaz**; harita yüzeyleri için ayrı el kontrolü gerekir (hiç yapmadım).
- **Dokunma hedefi (390 px):** yalnızca **Su** sekmesi 41×44 (genişlik 44 altı); harita atıf bağlantıları (Mapbox / OpenStreetMap / Maxar / «Improve this map») **14 px yükseklik** ve atıf düğmesi 24×24: zorunlu telif metni, ama hedef küçük. 1px'lik «ay git» / anahtar girdileri ekran okuyucu içindir (`sr-only`), sorun değil. Ana tasarım belgesi «≥ 44 px» diyor; 1440'ta 27/46 öğe 44 altı (masaüstü için WCAG 2.2 AA ≥24 yeterli; 11'i 24 altı: atıf bağlantıları, küçük kontroller).
- **12 px altı yazı** WCAG ihlali değil ama kendi kuralına aykırı ve düşük görme için sorun (U-13).
- **Renk dışı kodlama:** kademe (işaret + etiket), ilaçlama şeridi (desen + simge), bölge (desen) iyi. **Sorun:** `▲` anlam tekilliği (U-11); radar katmanında artış/azalma yalnız renkle (mavi/turuncu) lejanttaki sözcüklerle.
- **Klavye / odak:** `:focus-visible` tanımlı (2 px halka, kabukta limon). Odak turunu denemedim. Komut paleti `⌘K` var.
- **Sayfa başlığı:** `document.title` yalnız blogda değişiyor; uygulama içi bütün rotalar «BahçeLab | Tarımda Akıllı Üretim» (sekme/geçmiş ve ekran okuyucu sayfa değişimini ayırt edemez). **Atlama bağlantısı (skip link) yok.** `<main>` var; `lang="tr"` var.

### Boş / yükleniyor / hata tutarlılığı
- **Üç ayrı boş durum biçimi** (BosDurum gravürlü, EmptyState, kesik çerçeveli kutu); **iki yükleniyor biçimi** (Skeleton, el yapımı pulse blok) ve bazı yerlerde hiç iskelet yok (harita tarih kutusu «— görüntü yok»).
- **Hata = boş** (U-01, U-22); hata nedeni her zaman «İnternet bağlantınız» (U-21).
- **Çevrimdışı**: ayrı üst bant, ayrı stil (P2).
- **İyi:** boş durum metinleri «neden + ne zaman gelir» formunda (örn. «Veri çekiliyor · %N»); **sahte veri yok** ilkesi gerçekten uygulanmış (hiçbir yerde uydurma grafik görmedim).

### Türkçe metin ve terim tutarlılığı
- **Bir kavram, çok ad:** «katman» (105+69 geçiş) / «gösterge» (15) / «indeks» (67, kodda) / «bölge» / «yama»; Defter «yama» diyor, Analiz «bölge». «Sezon eğrisi» başlığı «Bu sezon, kendi geçmişine göre» ve Geçmiş'te «Bu sezon, önceki 10 sezon içinde». **«ortanca» (23) ve «medyan» (8)** karışık (kodda satır sayımı; hepsi ekrana yansımıyor olabilir).
- **«Günlük» sekmesi ↔ «Saha Defteri»:** ikisi örtüşen kavram (gözlem/kayıt), iki ayrı isim ve iki ayrı yer.
- **«Geçmiş» (sayfa) ↔ «Geçmiş ↗» (harita düğmesi) ↔ «12 yılın tamamı ↗» ↔ «Arşiv» (eski rota adı)**: aynı sayfaya üç ad.
- **«veri bayat / veri yok / kanıt yok / belirsiz»:** dört farklı «bilmiyoruz».
- **Jargon ve kısaltma ön yüzde:** p10–p90, p25–p75, ETc, Kc, ET₀, RVI, VH dB, m³/m³, ERA5-Land, LAI, MSAVI, NDRE, HLS, SoilGrids, «orta (risk tahmini, teşhis değil)». Her biri yerinde anlamlı; birlikte 12 px lejant paragraflarında çiftçi için yük.
- **İngilizce kalıntı:** «Toggle attribution», «Improve this map» (harita kütüphanesi), bildirimde `WeatherSourceError` (U-05).
- **Tarih biçimi:** «9 Eki 2026», «29 Eki 2026», «25 Eyl 2026» kısaltmalı; ay adı bazen tam («Eylül normaline göre»). Kabul edilebilir ama kural yok.
- **Disclaimer kalıbı:** «ön değer · mühendis onayı bekliyor» her ekranda 1–4 kez; doğru ve dürüst, ama tekrarla gürültü oluyor (bir kez, sayfa üstünde tek rozet yeterli).

### Performans (kısıtlı; bkz. §0.2)
- Açılış (Vite dev, başsız): **LCP 0,3–1,5 sn**; uygulama sayfası başına **230–256 istek, ≈21–22 MB** (büyük kısmı uydu fayansı + dev modülleri). Landing 75 istek ≈12 MB; auth 82 istek ≈10,8 MB.
- Üretim derlemesi (`dist`, 12 Eki, eski): en büyük JS parçası **1,07 MB** (muhtemelen MapLibre), `dist/assets` toplam 5,3 MB; birkaç **≈330–530 KB PNG** (landing görselleri; WebP/AVIF ile küçülür).
- Harici istek: `fonts.googleapis.com` / `fonts.gstatic.com` (3. taraf, render-blocking CSS).
- **Katman değişimi:** ölçmedim. Repoda test eşiği var (medyan ≤150 ms, p95 ≤200 ms, ≥30 fps); CI'da yalnız `E2E_PERF_CI=1` ile koşuyor. Katman değişiminde gösterge davranışını da ölçmedim.
- Ölü bağımlılıklar (`d3-scale`, `d3-shape`, `d3-array`) derlemeye girmiyor olabilir (tree-shake) ama yönetim yükü.

---

## g. En önemli 10 sorun ve «görsel dil v2» taslağı

### En önemli 10 sorun (öncelik sırası)

| # | Sorun | P | Neden önemli | Görüntü |
|---|---|---|---|---|
| 1 | **U-01** Sunucu hatası «İlk bahçenizi ekleyin» olarak gösteriliyor (+ alt bileşenlerde hata = «yok», U-22) | P0 | Kullanıcı veri kaybettiğini sanar; sistem hatasını gizler; `TumBahceler.tsx:57` | d03-hata__1440/390/1024 |
| 2 | **U-02** Su dengesi çizgisi çubuklardan bağımsız, etiketsiz ölçekte | P0 | Çiftçi sulama kararında yanlış okuyabilir; ürünün en kritik grafiği | p06-j-su__1440, s03 |
| 3 | **U-06** Varsayılan «bahçenin kendi farkları» skalası küçük/gürültü farkı büyük gösteriyor (0,56 °C tam sarı→kahve; radar ±2,24 dB doygun mavi, metin «değişim yok» derken) | P0 | İlk bakış mesajı fiziksel gerçekle çelişir; «dürüst ölçek» ilkesine ters | k-yuzeySicakligi__1440, k-radarDegisim__1440 |
| 4 | **U-05** Bildirimde ham istisna adı + sistem/ürün uyarısı karışık | P0 | Güven ve profesyonellik; ürün kararlarının önünü operasyonel gürültü kesiyor | o05-bildirimler__1440 |
| 5 | **U-03 + U-04** Kırık yerleşimler: Defter 390'da onay kutusu üst gezinmenin üstünde; Hava 1440'ta kartlar kenardan kenara | P0 | Görünür hata; ikisi de «bir ekran daha unutulmuş» izlenimi | p13-j-defter__390, p08-j-hava__1440 |
| 6 | **U-07/U-08** Dört çakışan tasarım dili; aynı token adı iki değer; Defter fontları yüklenmiyor; ölü planlama paleti | P1 | Her yeni ekran (9H) hangi dili kullanacağını bilemez; tutarsızlık katlanır | p11 vs p13 vs a04 |
| 7 | **U-13/U-12** 12 px altı yazı (ölçümde Su %60, Geçmiş %52) ve 6–8 satırlık lejant paragrafları | P1 | Okunabilirlik; grafik kendi başına anlatmıyor; kendi kuralına aykırı | p06, s03, s04 |
| 8 | **U-14/U-16** Grafikler ortak bileşene dayanmıyor; 5 zaman grafiği 4 farklı aralık; sezon eğrisi aşırı yüklü; yuvarlak olmayan eksen | P1 | 9H'de yeni grafik eklenecek: şimdiki kopyalama bunu katlayacak | p11, s01 |
| 9 | **U-10/U-11** Harita ile panel kopuk (Su/Hava'da hep Canlılık) ve Durum kartları «veri bayat» tekrarı | P1 | «Harita ana sahne» ilkesi kendini bozuyor; karar kartı bilgi taşımıyor | p06, p08, p02 |
| 10 | **U-09/U-18** İç yol haritası (Faz/Adım) ve kaldırılmış ürün vaadi arayüzde | P1 | Kullanıcıya dönük metin ürünün gerçek durumunu yanlış anlatıyor; anti-fabrication ilkesi | p16–p19, s04, a04 |

### Tüm sorun listesi (kısa)

| Kimlik | P | Özet |
|---|---|---|
| U-01 | P0 | Liste: API hatası = boş durum |
| U-02 | P0 | Su dengesi çift ölçek |
| U-03 | P0 | Defter 390: onay kutusu üst gezinmeyi örter |
| U-04 | P0 | Hava 1440: kartlar kenardan kenara |
| U-05 | P0 | Bildirimde `WeatherSourceError` |
| U-06 | P0 | Göreli skala varsayılan yanıltıyor |
| U-07 | P1 | Dört tasarım dili, çakışan token'lar |
| U-08 | P1 | Defter yazı tipleri yüklenmiyor |
| U-09 | P1 | Faz/Adım rozetleri kullanıcıya dönük |
| U-10 | P1 | Harita sekmeyle değişmiyor |
| U-11 | P1 | Durum kartı tekrarı ve ▲ çok anlamı |
| U-12 | P1 | Jargon + 12 px lejant paragrafları |
| U-13 | P1 | 12 px altı yazı (81 tanım) |
| U-14 | P1 | Grafik ekseni/etiketi ortak değil; yuvarlak olmayan çentik |
| U-15 | P1 | Renk anlam çakışması (su 3 mavi, sıcaklık 2 renk, turuncu çift anlam) |
| U-16 | P1 | Sezon eğrisi aşırı yüklü; ilk bakış mesajı yok |
| U-17 | P1 | Logo tutarsız ve düşük kontrast (landing/auth) |
| U-18 | P1 | «Planlama alanı», «rekolte», «her ağaç» vaatleri |
| U-19 | P2 | 390: İşlerim/Hizmetler/Pazar bilerek gizli, mobil gezinme yok |
| U-20 | P1 | 390: karar kartı kıvrımın altında |
| U-21 | P1 | Sunucu hatasında «internet bağlantınızı» |
| U-22 | P1 | Alt bileşenlerde hata = «yok» |
| U-23 | P1 | Yükleniyor: tek blok; «— görüntü yok» |
| U-24 | P1 | Günlük/Rapor boş ama sekme olarak duruyor |
| U-25 | P1 | Paz/Pzt kısaltması |
| U-26 | P1 | Sayfa genişliği/başlık/geri düğmesi 5 farklı |
| U-27 | P2 | Komut paleti arka plan karartması yok |
| U-28 | P2 | Çevrimdışı bandı üst gezinmeyi örter |
| U-29 | P2 | Bahçe ekle sağ panel boş; `h1` yok |
| U-30 | P1 | Bahçeler listesi: iki «İzle», ayırt edici bilgi yok |
| U-31 | P1 | Yan yana iki bahçe aynı ERA5 hücresi: uyarı yok |
| U-32 | P2 | «↗» simgesi iç bağlantıda |
| U-33 | P2 | Ayarlar anahtarları gruplanmamış |
| U-34 | P2 | Landing `list/listitem` axe, düğme metinleri çelişkili |
| U-35 | P2 | Arama kutusu placeholder kesik; atıf bağlantıları küçük |
| U-36 | P2 | `document.title` sabit; atlama bağlantısı yok |

(Toplam: P0 6 · P1 21 · P2 9.)

### «Görsel dil v2» taslağı (yalnız öneri, onay bekler)

**İlkeler:** (1) tek dil, (2) önce karar cümlesi + tek sayı, sonra kanıt grafiği, sonra ayrıntı, (3) renk yalnız veride, (4) her grafik tek mesaj taşır ve başlığında söyler, (5) belirsizlik/veri yaşı her zaman görünür, (6) hata ve «yok» ayrı şeylerdir.

**1. Renk skalaları**
- **Sıralı (tek ton, açık→koyu):** Bitki = yeşil (`canlilik`, `klorofil`, `yaprakAlani`, `tacToprak` aynı ailenin tonları, sarı-yeşil yalnız klorofil), Su = mavi, Sıcaklık = sarı→turuncu→kahve, Radar = gri-mavi.
- **İki yönlü (diverging):** TEK şema: azalma/kötü = kahve-turuncu ← nötr → artış/iyi = yeşil-mavi; eşik altı **soluk** (radar değişimi, değişim haritası).
- **Skala davranışı:** varsayılan **mutlak** (sabit uçlar); «Bahçenin kendi farkları» ayrı, **etiketli rozetle** («gerilmiş skala · 0,56 °C aralık») ve **minimum aralık eşiği** (aralık fiziksel gürültünün altındaysa gerilme kapalı, harita nötr + «fark yok»).
- **Anlamsal sabitler:** su = mavi (tek ton), hava sıcaklığı = tek renk (her yerde aynı), yüzey sıcaklığı = turuncu-kahve, uyarı = **amber + simge** (turuncu «sıcaklık» için ayrılır), kötü durum = kırmızı + simge, normal bant = nötr gri-yeşil (tahmin için ayrı desen: **çapraz tarama**).
- **Durum kademeleri:** tek tanım (shell değerleri), simge tekil: iyi ● · izle ▲ (yalnız bu) · dikkat ◆ · sorun ■; «nötr bilgi» için simge yok.
- Tüm token'lar tek yerde (`tokens.css`); **hex yasak** (veri rampaları hariç, `paletler.ts` kaynak).

**2. Yazı hiyerarşisi (Manrope tek aile; Fraunces yalnız pazarlama)**
| Rol | px / satır | Ağırlık |
|---|---|---|
| Metrik (tek büyük sayı) | 32 / 36, tabular | 700 |
| Sayfa başlığı / karar cümlesi | 22 / 28 | 700 |
| Kart başlığı | 15 / 22 | 600 |
| Gövde | 14 / 20 | 500 |
| Yardımcı / not | 13 / 18 | 500 |
| Etiket / eksen / lejant (**taban**) | 12 / 16 | 500–600 |
Kurallar: **12 px altı yok** (SVG dahil), yarım-piksel yok, 3 ağırlık (500/600/700), büyük harf etiketi yalnız «bölüm üst yazısı».

**3. Boşluk, köşe, gölge**
- 4 pt ızgara; yarım adım (`1.5/2.5/3.5`) yok. Kart dolgusu 16, kart arası 12, bölüm arası 24.
- Köşe: 8 (kontrol/rozet), 12 (kart/panel), tam yuvarlak (yalnız avatar/anahtar). Defter 2 px kalkar.
- Gölge: `e1` (kart, çok hafif), `e2` (yüzen panel). Başka gölge yok.

**4. Ortak grafik bileşen seti** (`@/components/chart`)
- `ChartFrame` (başlık = mesaj cümlesi, birim, kaynak + veri yaşı rozeti, «?» ayrıntısı), `TimeAxis` + **paylaşılan zaman alanı ve senkron imleç** (sayfa başına tek `TimeDomain`), `ValueAxis` (`niceTicks`, birim zorunlu), `Band` (normal bant: tek tanım), `Threshold` (eşik çizgisi: don 0 °C, sulama eşiği), `Annotation`, `ChartLegend` (tek satır; uzun açıklama «?» arkasında), `ChartTooltip` (tek bileşen: tarih + değer + kaynak), `Sparkline`.
- **Tür kataloğu (her tür tek yerde):** çizgi+bant · günlük çubuk (yağış) · iki yönlü çubuk (denge) · dumbbell (fark) · bullet (bugün vs normal) · şerit (saatlik/tarih) · dağılım (histogram) · küçük-çoklu harita. Her türün **kabul ölçütü**: tek mesaj başlığı, 12 px taban, ≥3:1 çizgi/yüzey kontrastı, renk dışı kodlama, veri yoksa «neden + ne zaman».
- **Çift eksen yasak.** İki ölçek gerekiyorsa iki panel, aynı zaman ekseni (Su dengesi: üstte günlük yağış/ETc, altta birikimli).
- Ölü bağımlılıkları (`d3-scale/shape/array`) ya kullan ya kaldır; kütüphane kararı (visx/uPlot) ayrı bir ADR.

**5. Sayfa iskeleti**
- **Kabuk** (değişmez): 56 üst bar · 52 bağlam çubuğu (bahçe + sekmeler).
- **Çalışma alanı sayfası:** harita (sol) + 440 px panel. Panel **üç katman**: ① *Karar kartı* (tek cümle + tek sayı + veri yaşı) ② *Kanıt* (tek ana grafik) ③ *Ayrıntı* (akordeon: diğer grafikler, nasıl hesaplandı, tanımlar). Harita katmanı **sekmeye göre otomatik** (Su → yaprak suyu, Hava → hiçbir katman/çizim), katman çubuğu tek satır (uzman kontrolleri «⋯» altında).
- **Tam sayfa** (Geçmiş, Defter, Ayarlar): tek `PageShell`: 12 kolon, en çok 1200 px, aynı başlık stili, aynı geri düğmesi, aynı üst boşluk.
- **Liste ekranı:** satır = ad · durum · mini çizgi · veri yaşı · «kim kötüleşiyor» sıralaması.
- **Mobil:** harita ≤36vh + sürüklenebilir alt sayfa, **karar kartı ilk ekranda**; harita kontrolleri tek satıra iner; sekmeler kaydırılabilir ve kaydırma ipucu verir.
- **Durumlar:** `Skeleton` (içerik şekli), `EmptyState` (neden + ne zaman gelir), `ErrorState` (ağ ↔ sunucu ayrımı: «sunucudan yanıt alınamadı» / «bağlantı yok»), `StaleBadge` (veri yaşı); **hata asla boş durum olarak çizilmez**.
- **Terim sözlüğü:** katman / gösterge / bölge / ortanca tek ad; teknik terimler `InfoHint` içinde; disclaimers sayfa başına **tek** rozet.

**6. Önerilen sıra (onaydan sonra)**
1. **P0 düzeltmeleri** (U-01…U-06): küçük, bağımsız; yeni tasarım dilini beklemeden.
2. **Token birleştirme:** `@theme` + `.app-shell` + `.notebook` → tek `tokens.css`; ölü `planning-*` temizliği; yazı tipi kararı (Defter: ya yükle ya Manrope'a geç).
3. **Ortak grafik bileşenleri:** önce `ChartFrame`, `ValueAxis`, `TimeDomain`; Su dengesi bunlarla yeniden yazılır (U-02 kalıcı çözüm).
4. **Sayfa iskeleti** (`PageShell`, üç katmanlı panel); Bahçeler listesi.
5. **9H bu temelin üstünde** (yeni grafik = yeni dilden başlar).
6. Pazarlama ve Defter en sonda.

---

## Ek: Ürettiklerim ve nasıl yeniden üretilir
- `docs/design/ux-denetimi.md` (bu rapor), `docs/design/ux-denetimi-ekranlar.pdf` (temas sayfası, 32 sayfa, ≈24 MB).
- Ham görüntüler, betikler ve `audit.json` oturumun geçici klasöründe (`/private/tmp/claude-501/.../scratchpad/`); depoya eklenmedi. İstenirse betikleri `bahcelab-frontend/scripts/ux-denetimi/` altına, ürün koduna dokunmadan, eklerim.
- Bu turda **ürün kodu, tasarım ve veri değişmedi**; git'te yalnız iki yeni dosya var.
