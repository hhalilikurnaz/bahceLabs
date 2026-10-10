# BahçeLab — Tasarım İyileştirme Önerisi (Aşama A: denetim ve tasarım)

> Durum: **onay bekliyor.** Bu doküman yalnızca denetim ve öneridir; arayüz/ürün kodu değiştirilmedi.
> Kapsam: Adım 1–6 (giriş, harita arayüzü, bahçe ekleme, uydu/indeks ve hava ekranları).
> Denetim ekran görüntüleri: `~/Desktop/bahcelab-ekran-goruntuleri/denetim/` (28 dosya; dosya adları aşağıda `[01]` gibi anılır).
> Yöntem: 1440×900 ve 390×844 görünümlerde gerçek uygulama, gerçek (Tömük) ve örnek hesaplarla; yükleniyor/hata durumları ağ gecikmesi/kesintisi simüle edilerek; kontrast oranları WCAG formülüyle hesaplandı; üretim paketi ölçüldü.

**Hedef cümle:** BahçeLab, narenciye üreticisinin bahçesini açtığında **3 saniyede "bahçem nasıl, bugün ne yapmalıyım?"** sorusuna cevap alan, markasının koyu yeşil / limon sarısı dilini taşıyan, uydu ve hava verisini *anlamıyla* konuşan bir ürün olmalı. OneSoil'in "indeks seçici + harita" mantığının üstüne **karar desteği** (skor, "bugün", ilaçlama penceresi, uyarılar) koyarak ayrışırız; görsel olarak onun nötr gri-mavi dilinden uzaklaşıp marka renklerimizi kullanırız.

---

## 1. Denetimin özeti (tek paragraf)

Mühendislik tarafı sağlam (gerçek veri, hızlı, testli); **ürün ve marka tarafı henüz "geliştirici arayüzü" seviyesinde.** Uygulama içi arayüz markadan kopuk (nötr gri + açık yeşil, logo yok, serif yok, limon sarısı yok), bilgi çiftçiye değil analiste göre sunuluyor (NDVI/MSAVI/NDRE kısaltmaları, "Piksel/Yumuşak", "Kontrastlı p2–p98"), sol panel tek bir bahçe için 9 farklı modül gösteriyor (≈1700 px kaydırma) ve ilk bakışta "ne yapmalıyım?" sorusuna cevap veren hiçbir öğe yok. Mobilde panel haritayı tamamen kapatıyor. Erişilebilirlikte küçük yazı (9–11 px), düşük kontrastlı soluk metin ve renk-yalnızca-kodlama sorunları var. Bunların çoğu tasarım sistemi + bilgi mimarisi düzeyinde çözülebilir; backend'e birkaç özet uç noktası yeterli.

---

## 2. Marka varlıkları (envanter)

| Varlık | Nerede | Not |
|---|---|---|
| Landing (bahcelabs.com) | Aynı repo: `bahcelab-frontend/src/features/marketing/` (`/`, `/blog`). Ayrı bir site reposu yok. Masaüstünde `BahçeLab - Standalone.html` ve `bahcelabs-web.zip` eski sürümler | Hero: drone ile limon bahçesi videosu/kareleri (120 kare), serif başlık |
| Renkler (landing) | `journey.css`: `--night #0e1a12`, `--night-2 #13241a`, `--cream #f5f2e9`, **`--lemon #f2c94c`**, `--lemon-2 #ffe28a`, `--leaf #2f6b3f` | Marka paleti burada tanımlı ve tutarlı |
| Yazı tipleri | Landing: **Fraunces** (başlık) + **Manrope** (metin). Uygulama: **Inter** + **Plus Jakarta Sans** | `index.html` 4 ailenin hepsini yüklüyor |
| Logo | `assets/marketing/bahcelab-logo.png` (renkli çubuk grafik + kalın "BahceLab", **ç harfsiz**) ve `bahcelab-logo-wordmark.png` (yaprak + italik serif "BahçeLab", krem) | **İki farklı logo.** Renkli çubuklu olan koyu zeminde okunmuyor [01][03]; serif/yaprak olan Fraunces ile uyumlu |
| Referans tasarım | `~/Desktop/BahçeLab folders/bahçelab.png` (koyu yeşil kenar çubuğu, açık yeşil vurgu, Copilot paneli) | Uygulama bu referanstan da uzaklaşmış: referans yeşil/krem sıcaklığına sahip, uygulama nötr gri |
| Görseller | `public/media/hero-frames` (120 kare), `orchard/master-*.webp`, blog kapakları, `assets/trees/tree-stage-*.png` (planlama), favicon | Hero görselleri markalı ama uygulama içinde hiç kullanılmıyor |
| Uygulama paleti | `index.css`: `app-bg #131517`, `app-panel #1c1e21`, `app-card #2a2d31`, vurgu `#7cc65a` | **4 ayrı palet:** landing (orman/limon/krem), giriş (krem + `#0c2418`), uygulama (nötr gri), planlama (`#0b0f0b`) |

**Sonuç:** Marka dili landing'de doğru kurulmuş; giriş ekranında yarım; uygulamada yok.

---

## 3. Bulgular (önem sırasıyla)

Önem: **K** = kritik (ürünü anlamayı/kullanmayı engeller), **Y** = yüksek, **O** = orta, **D** = düşük.

### K1 — "Ne yapmalıyım?" sorusunun cevabı yok (bilgi mimarisi) [10][11][12][15]
Bahçe açılınca ilk görülen şey "SON NDVI 0,22 · Zayıf" ve ardından 6 katman düğmesi. Üretici için 0,22'nin anlamı yok; "Zayıf" etiketi bile NDVI'ın kendisine göre (bahçenin kendi mevsim normaline göre değil) hesaplanıyor. Uyarılar, ilaçlama penceresi, hava uyarıları ayrı sekmelerde/kartlarda dağınık. **Ürünün değer önerisi (karar desteği) ekranda görünmüyor.**

### K2 — Dil analist dili: kısaltma, jargon, açıklamasız seçenek [10][11]
NDVI / MSAVI / NDRE / NDMI / CIgreen, "Değer görünümü: Mutlak/Kontrastlı", "Çizim: Piksel/Yumuşak", "Kontrastlı (p2–p98)", "Verimlilik bölgeleri… ileride blok bölmeye öneri olacak" (geliştirici notu kullanıcıya sızmış). "Bu ne demek?" yalnızca küçük bir "ayrıntı" bağlantısının arkasında.

### K3 — Sol panel aşırı kalabalık; öncelik yok [10][11][12][13]
Uydu sekmesi tek akışta 9 modül: son değer, katman, değer görünümü, çizim, değişim haritası, karşılaştır, verimlilik bölgeleri, zaman grafiği (+hava katmanı + 5 indeks çipi), durum. 360 px panelde ≈1700 px kaydırma. Gelişmiş görsel ayarlar (Piksel/Yumuşak, Kontrastlı, Değişim, Sürgü) ilk ekranın yarısını işgal ediyor; sıradan kullanıcı bunlara muhtaç değil.

### K4 — Mobilde panel haritayı yutuyor [26][27][28]
390 px'te panel neredeyse tam ekran; arkasındaki harita, lejant ve tarih şeridi panelin üstüne biniyor (lejant ve şerit panel içeriğini kapatıyor). Dokunma hedefleri 27–36 px (öneri ≥44 px). Rail 56 px sürekli yer kaplıyor. Alt sayfa (bottom sheet) kalıbı yok.

### Y1 — Marka uyumsuzluğu: uygulama içi hiçbir marka öğesi yok [06][09][10]
Uygulamada logo yok (genel yaprak ikonu), serif yok, limon sarısı yok, zemin nötr gri. Giriş ekranı krem + koyu yeşil (başka bir palet), landing farklı. Kullanıcı landing'den uygulamaya geçince "başka bir ürüne" geçmiş gibi hissediyor.

### Y2 — Logo okunabilirliği [01][03][24]
Renkli çubuklu logonun koyu yeşil yazısı koyu fotoğraf/orman zemininde neredeyse görünmüyor (landing sol üst, giriş sol üst). İki logo kullanımda; biri markanın serif diline uymuyor ve "ç" harfi yok ("BahceLab").

### Y3 — Harita: indeks katmanı altlığı tamamen kapatıyor, ilk his "boyalı kutu" [10]
%100 opak 10 m piksel katmanı uydu görüntüsünü (ağaç dokusu, sıra düzeni) siliyor; üretici kendi bahçesini tanımakta zorlanıyor. Şeffaflık ayarı yok. Altlık yakınlaştırıldığında yumuşuyor/pikselleşiyor (maxZoom gerçek çözünürlüğe bağlı değil). Seçili olmayan bahçeler haritada yalnızca ince yeşil karakutu; ad etiketi, durum rengi, üzerine gelince özet yok [09].

### Y4 — Boş/yükleniyor/hata durumları zayıf ve tutarsız [06][18][19][20][21]
- Liste iskeleti şekilsiz gri bloklar (içerik yapısını ima etmiyor) [18].
- Hata durumu yalnızca ikon + tek cümle + düğme; ne olduğunu/ne yapılacağını söylemiyor [19].
- Hava sekmesi hata/yeniden deneme sırasında 7+ sn boyunca iskelet gösteriyor [20][21] (react-query yeniden deneme gecikmesi); kullanıcıya "tekrar deneniyor" bilgisi yok.
- Çevrimdışı/önbellek bandı yalnızca Hava sekmesinde var; uydu tarafında yok.
- Boş durumda (yeni kullanıcı) "Bahçe ekle" var ama **ürün turu/ilk adım rehberi ve örnek bahçe yok** [06][07]; sezon seçici (2026 sezonu) ve arama kutusu boş ekranda anlamsız yer kaplıyor.

### Y5 — Erişilebilirlik [22] + ölçümler (bkz. §4)
Soluk metin `#787e86` panel üzerinde 4,08:1, kart üzerinde 3,38:1 (AA için 4,5 gerekir); giriş placeholder'ı 2,1:1. Metin boyutları 9–11 px (grafik ekseni 8,5 px, lejant 10 px). Renk-yalnızca kodlama: ilaçlama şeridi (yeşil/sarı/kırmızı), NDVI kırmızı→yeşil skala, verimlilik bölgeleri (kırmızı/sarı/yeşil) → kırmızı-yeşil renk körü kullanıcılar ayıramaz. SVG grafikler `role=img` ama veriyi metinle sunmuyor. Odak halkası var ama tek tonlu gri (`rgb(159,177,163)`), açık zeminlerde yetersiz.

### Y6 — Tipografi sistemsiz [01][03][10]
4 font ailesi yükleniyor (Inter, Plus Jakarta, Manrope, Fraunces). Uygulamada başlık Plus Jakarta, metin Inter; landing Fraunces+Manrope. Ölçek yok: 9, 10, 11, 12, 13, 14, 15, 16, 26, 34 px serbest kullanım. Sayılar (skor, sıcaklık, mm) için tabular rakam kullanılmıyor, büyük sayılar için ayrı bir "veri tipografisi" yok.

### O1 — Rail'deki ölü uçlar [09]
"Günlük" ve "Raporlar" tıklanınca "sonraki adımlarda gelecek" toast'ı; "Copilot" düğmesi prime köşede ama içerik "çok yakında". Üç ölü uç ilk izlenimi bozuyor; çalışan özellikler (Hava) bunlarla aynı görsel ağırlıkta.

### O2 — Bahçe listesi bilgi yoksulu [09]
Silüet (gerçek şekil ama renk dolgulu kare gibi), "NDVI 0,22" rozeti, uyarı ikonları anlaşılmaz (hangi simge ne?). Bugünkü hava, trend, durum etiketi, sıralama/filtre yok. Üstte "2026 sezonu" seçici listenin en baskın öğesi ama yalnızca grafik yılını değiştiriyor.

### O3 — Hava sekmesi: uzman görünümü [15][16]
7×24 hücrelik ilaçlama şeridi doğru ama "ilaçlayabilir miyim?" sorusuna **tek bakışta cevap vermiyor**; en iyi aralık küçük yeşil metin. 7 günlük satırlar 5 sütun + alt satır (yoğun). Su dengesi "−28 mm, ET₀" teknik; çiftçi "toprak/ağaç ne kadar susuz?" bilmek ister. Don/sıcak uyarıları iyi (kırmızı/sarı kart) ama panelin başında değil, uydu uyarılarıyla tek bir "uyarılar" akışında birleşmiyor.

### O4 — Grafik okunabilirliği [12]
Sıkışık 320×176 grafik, 8,5 px eksen yazısı; iki sezon + 5 indeks + hava katmanı birleşince okunmuyor ("iki eksen karmaşası"). Zaman aralığı seçici, crosshair, fenoloji bandı, bulut güven göstergesi yok.

### O5 — Tarih şeridi [10]
İşlevsel ama bilgisi sınırlı: ay ayraçları yok (yıl ayracı var), bulut yüzdesi yok, "en net görüntü" işareti yok, yalnızca-net filtresi yok. Şerit + lejant + zoom + panel aynı alt bölgede yarışıyor.

### O6 — Mikro etkileşim ve geri bildirim
Panel açma/kapama geçişi var; bahçe seçince harita uçuşu var ama sonuç (spotlight/karartma) yok; toast sistemi var ama tutarlı kullanılmıyor; klavye kısayolları yok; rail tooltip'i yalnızca hover (dokunmatikte yok) ve hover sonrası haritayı kapatan artık kalıyor [25][26].

### D1 — Performans [bkz. §4]
Tüm rotalar tek 1,9 MB (539 kB gzip) JS paketi yüklüyor (landing dahil MapLibre/terra-draw içeriyor). 4 font ailesi, birkaç yüz kB'lık PNG'ler (481 kB, 393 kB). Uygulama içi veri akışı hızlı (liste ≈0,5 sn), ama NDVI ızgara/PNG'leri tarih değişince yeniden indiriliyor (zaman atlaması hariç önceden yüklenmiyor).

### D2 — Mikro metin (copy)
"Haritada bahçenizin sınırını çizin; uydu görüntüsü ve hava durumuyla izlemeye başlayın" iyi. Ancak "Verimlilik bölgeleri… ileride blok bölmeye öneri olacak", "Planlama alanı" gibi iç dil var. Sayı biçimleri tutarlı (iyi), ama "bulut %1", "ET₀" gibi terimler açıklamasız.

**Korunması gerekenler (iyi olanlar):** tarih biçimi tek kaynaktan ve doğru; veri yükleme hızı; panel/harita yerleşim mantığı; Türkçe uyarı metinleri; don/sıcak uyarı kartlarının dili; ilaçlama gerekçelerinin metni; karanlık tema yaklaşımı; hover yerine focus/tap ile de çalışan şerit.

---

## 4. Ölçümler

| Ölçüm | Sonuç |
|---|---|
| JS paketi (üretim) | `index-*.js` **1.909 kB (gzip 539 kB)** + MapLibre worker 508 kB; tek parça, rota bazlı bölünme yok |
| CSS | 187 kB (gzip 29 kB) |
| Görsel boyutları | 6 PNG 100–480 kB (logo, blog, ağaç aşamaları); kare dizisi WebP |
| Yazı tipi | 4 aile (Inter, Plus Jakarta, Manrope, Fraunces) Google Fonts'tan |
| Landing (üretim önizlemesi, yerel) | FCP 324 ms · LCP 324 ms; **4G + 4× CPU kısıtlı:** FCP 852 ms, LCP 852 ms |
| Giriş sayfası | yerel FCP 280 ms; kısıtlı LCP 1.144 ms (≈ 393 kB aktarım) |
| `/bahcem` veri hazır olma | girişten liste görünene ≈ 520 ms (geliştirme sunucusu + yerel API) |
| Sınırlılık | Ölçümler yerel ağda; gerçek mobil/4G Lighthouse ve gerçek sunucu Aşama B'de **staging üzerinde** tekrarlanacak |

Kontrast (WCAG, metin 4,5:1 / büyük metin 3:1):

| Çift | Oran | Karar |
|---|---|---|
| Soluk metin `#787e86` / panel `#1c1e21` | 4,08 | ✗ |
| Soluk metin / kart `#2a2d31` | 3,38 | ✗ |
| İkincil metin `#a7acb3` / kart | 6,06 | ✓ |
| Vurgu yeşil `#7cc65a` / panel | 8,02 | ✓ |
| Tehlike `#f87171` / panel | 6,04 | ✓ |
| Giriş placeholder (~`#aeb3ae`) / beyaz | 2,13 | ✗ |
| Dokunma hedefleri (mobil) | 27–36 px (çoğu çip/sekme/ikon düğmesi) | ✗ (≥44 px önerilir) |

---

## 5. Önerilen tasarım sistemi — "Limon Bahçesi" teması

Prensip: **tek palet, iki yazı tipi, tek ikon dili.** Landing, giriş ve uygulama aynı token'ları kullanır (uygulama koyu, giriş/landing'in krem bölümleri aydınlık yüzey).

### 5.1 Renk token'ları (koyu uygulama teması)

| Token | Değer | Kullanım | Kontrast (metin/yüzey) |
|---|---|---|---|
| `--bg` | `#0C1710` | Harita dışı zemin, rail | — |
| `--panel` | `#12211A` | Paneller | — |
| `--card` | `#1A2C22` | Kartlar | — |
| `--card-hover` | `#21362A` | Hover/seçili kart | — |
| `--border` | `#2B4235` | Ayraçlar | — |
| `--text` | `#F3F1E7` (krem) | Birincil metin | 14,7:1 (panel) |
| `--text-2` | `#B9C4B6` | İkincil | 9,2:1 |
| `--text-3` | `#93A294` | Soluk (≥12 px) | 6,2:1 (panel), 5,5:1 (kart) |
| `--lemon` | **`#F2C94C`** | Birincil eylem, seçili durum, marka vurgusu, skor halkası | 10,5:1 |
| `--lemon-ink` | `#0C1710` | Limon zemin üstü metin | 11,6:1 |
| `--leaf` | `#7FCB6B` | Olumlu / "İyi" durumu / sağlıklı | 8,5:1 |
| `--warn` | `#F2A04A` | "İzle", uyarı (limonla karışmaması için turuncu) | 7,9:1 |
| `--danger` | `#F0705C` | "Dikkat", don tehlikesi | 5,7:1 |
| `--water` | `#6CB4EE` | Yağış, yaprak suyu, NDMI | 7,5:1 |

Not: limon yalnızca **marka ve birincil eylem** içindir; "uyarı" için turuncu kullanılır (aksi halde "seçili" ile "uyarı" karışır). Aydınlık yüzeyler (giriş kartı, landing bölümleri): `--cream #F5F2E9`, `--ink #13241A`, `--leaf-deep #2F6B3F`.

Durum etiketleri (renk + simge + metin, asla yalnızca renk): **İyi** `--leaf` + ✓ · **İzle** `--warn` + ◔ · **Dikkat** `--danger` + ! .

**Veri skalaları:** her indeks için tek, **renk körü dostu** varsayılan skala (turuncu→sarı→koyu yeşil; kırmızı-yeşil kullanılmaz), seçenek olarak "klasik" (kırmızı→yeşil) ve "gri tonlama". NDMI/yaprak suyu mavi tonlar; değişim haritası turuncu↔mavi (kırmızı↔yeşil yerine). Tüm skalalar daima lejantlı, aynı bileşenle çizilir, uç değerlerde "düşük/yüksek" sözcükleriyle.

### 5.2 Tipografi
- **Fraunces** (500/600): ekran başlıkları, büyük sayılar (skor, sıcaklık, "En iyi: Salı 06–11"), landing başlıkları.
- **Manrope** (500/600/700, **tabular-nums**): tüm arayüz metni. Inter ve Plus Jakarta kaldırılır → **yüklenen aile sayısı 4 → 2**.
- Ölçek (px / satır yüksekliği): `display 32/36 (Fraunces)`, `h1 24/30 (Fraunces)`, `h2 18/24 (Manrope 700)`, `body 14/20`, `small 13/18`, `caption 12/16` — **12 px altı yok** (şimdi 8,5–11 px var). Mobilde `body 15`.
- Büyük veri sayıları: Fraunces 32–44 px, tabular; birimler küçük ve soluk (°C, mm).

### 5.3 Boşluk, köşe, gölge, ikon, hareket
- **Boşluk:** 4 pt ızgara: 4 · 8 · 12 · 16 · 20 · 24 · 32. Kart içi 16, kartlar arası 12, panel kenar 16.
- **Köşe:** `r-sm 8` (girdi, çip), `r-md 12` (kart), `r-lg 16` (panel), `r-pill 999` (çip, düğme). Şimdiki 8–16 karışık değerler bu üçe indirilir.
- **Gölge:** `e1` kart (yok/ince border), `e2` yüzen kontrol (`0 6 16 /35%`), `e3` panel/çekmece (`0 16 40 /45%`). Harita üstü yüzeyler hafif cam efekti (`backdrop-blur 8`) + border.
- **İkon dili:** lucide, **stroke 1,75**, boyut 16/20/24; alana özgü 6 özel ikon (limon, yaprak, damla, don kristali, ilaç bidonu, güneş-sıcak) aynı çizgi kalınlığında. Emoji yok. Durum ikonları daima etiketle.
- **Hareket:** hover/focus 120 ms ease-out; panel/çekmece 240 ms `cubic-bezier(.2,.8,.2,1)`; harita uçuşu 700–900 ms; skor halkası ve sayılar ilk görünümde 400 ms sayım animasyonu; **`prefers-reduced-motion`'da hepsi anlık**. Odak halkası 2 px `--lemon` + 2 px boşluk (karanlıkta da açıkta da görünür).
- **Dokunma hedefi:** minimum 44×44 (görsel küçük olsa da tıklanabilir alan).

### 5.4 Bileşen envanteri (yeni/yeniden)
`StatusPill` (İyi/İzle/Dikkat) · `ScoreRing` (0–100) · `MetricCard` (değer + değişim oku + sparkline) · `Sparkline` · `Skeleton*` (içerik şeklinde) · `EmptyState` · `ErrorState` (neden + ne yapmalı + tekrar dene) · `OfflineBanner` · `InfoPopover` ("bu ne demek?") · `SegmentedControl` · `BottomSheet` (mobil, 3 durak) · `Legend` (tek bileşen) · `KbdHint`.

---

## 6. Ekran ekran yeni tasarım

### 6.1 Giriş / kayıt
**Şimdi:** sol yarıda koyu fotoğraf ve okunmayan logo, sağda krem kart; fontlar uygulamayla uyumsuz [03][04].
**Yeni:** Sol: tam yükseklik hero fotoğrafı (landing'deki drone/limon kareleri; hafif yeşil duotone), üstte **krem serif logo (yaprak + "BahçeLab")**, Fraunces başlık ("Bahçenizi uzaydan okuyun, bugün ne yapacağınızı bilin"), altta üç kısa değer cümlesi. Sağ: krem zemin, Fraunces başlık, Manrope form, **limon birincil düğme (koyu metin)**, placeholder kontrastı ≥4,5:1, şifre göster/gizle, "Beni hatırla", net hata satırı (alan altında ve `aria-live`). Kayıt kapalıyken: "Erken erişim listesi" e-posta kutusu (ölü uç yerine).

```
┌───────────────────────────────┬──────────────────────────┐
│ 🌿 BahçeLab  (krem, serif)    │  ← Ana sayfa              │
│                               │                          │
│   [drone + limon bahçesi]     │   Giriş yap  (Fraunces)   │
│                               │   E-posta [___________]   │
│  Bahçenizi uzaydan okuyun,    │   Şifre   [________ 👁]   │
│  bugün ne yapacağınızı bilin  │   [ Giriş yap ] (limon)   │
│  ✓ Uydu + hava, tek ekranda   │   Hesabın yok mu? Kayıt   │
│  ✓ Türkçe, sade uyarılar      │                          │
└───────────────────────────────┴──────────────────────────┘
```

### 6.2 İlk kullanım (boş durum + rehber)
**Şimdi:** gri panel, tek düğme [06][07].
**Yeni:** Boş panel yerine **3 adımlı karşılama kartı**: ① "Bahçenin sınırını çiz" ② "Uydu görüntüleri hazırlanır (~1,5 dk)" ③ "Bugünkü durumu ve ilaçlama penceresini gör". İki eylem: **[Bahçemi çiz]** (limon) ve **[Örnek bahçeyi incele]** (ikincil; hazır Erdemli örnek bahçe, "Örnek" rozetli, silinebilir). Harita bu sırada Türkiye genelinden başlar ve "Konumunu ara" ipucu gösterir. Sezon seçici ve arama kutusu bahçe yokken gizlenir. Bahçe eklendikten sonra işleme ilerlemesi **panelde adım adım** gösterilir ("Görüntüler indiriliyor 34/113 …").

### 6.3 Ana ekran — bahçe listesi ve harita genel görünümü
**Yeni sol panel (liste):**
```
┌ Bahçelerim ───────────────────────────┐
│ 3 bahçe · 270 dekar · ⚠ 1 dikkat      │  ← özet şerit
│ [Hepsi] [Dikkat 1] [İzle 1] [İyi 1]   │  ← filtre; sıralama ▾ (Durum)
│ ┌───────────────────────────────────┐ │
│ │[NDVI küçük resim] Don gecesi  ❄   │ │
│ │ 90 dekar · ☁ 18°   ┌──╱╲_╱─┐ 30gün│ │
│ │ ● Dikkat · Yarın gece don riski   │ │
│ └───────────────────────────────────┘ │
│ … (İzle, İyi kartları)                │
│ [+ Bahçe ekle]                        │
└───────────────────────────────────────┘
```
Kart: **gerçek son NDVI küçük resmi** (backend küçük resim), ad, dekar, bugünkü hava (ikon + °), 30 günlük sparkline, **durum pili**, tek satırlık sebep ("Yarın gece don riski" / "Yaprak suyu 2 haftada %12 düştü"). Simgeler yerine **metinli çipler**; renk körlüğü için şekil+metin.
**Harita (bahçe seçili değilken):** tüm bahçeler son duruma göre dolgulu (yeşil/turuncu/kırmızı, %35 opaklık) + **ad etiketi**; üzerine gelince küçük özet kartı (ad, durum, skor, bugünkü hava, "Aç →"). Sezon seçici, genel görünümde kaldırılır (grafik içine taşınır).

### 6.4 Bahçe detay — **"Genel" sekmesi (yeni varsayılan)**
Sekmeler: **Genel · Uydu · Hava** (Gözlem/Günlük ileride eklenir).
```
┌ ← Don gecesi              ⋯ ┐
│ Limon · 90 dekar · Erdemli   │
│ [Genel] Uydu  Hava            │
│ ┌ BUGÜN ────────────────────┐ │   ← en fazla 3 madde, önem sırasıyla
│ │ ❄ Yarın 03:00 don tehlikesi│ │
│ │ 💧 İlaçlama için en iyi:    │ │
│ │   Salı 06:00–11:00         │ │
│ │ 📉 Yaprak suyu son 2 haftada│ │
│ │   %12 düştü (güneybatı)    │ │
│ └────────────────────────────┘ │
│ ┌ BAHÇE DURUMU ─────────────┐ │
│ │  ◔ 62   Dikkat             │ │   ← skor halkası (Fraunces)
│ │ "Güneybatı köşede yaprak   │ │
│ │  suyu düşüyor; kontrol     │ │
│ │  önerilir."                │ │
│ └────────────────────────────┘ │
│ Canlılık  0,49 ▲%3 ~~╱╲~  ⓘ │   ← indeks kartları (2×2)
│ Yaprak suyu 0,18 ▼%12 ~╲~ ⓘ │
│ Klorofil/besin … ▬ %0 ~~~   ⓘ │
│ Toprak düz. canlılık … ▲     ⓘ │
│ [Haritada göster ▸]            │
└────────────────────────────────┘
```
- **Bugün kartı:** kural tabanlı, backend'de; kaynaklar: don/sıcak uyarısı, ilaçlama penceresi (varsa en yakın gündüz aralığı), indeks düşüşü uyarısı, işleme/veri durumu. Her madde tıklanınca ilgili sekmeye/haritaya gider.
- **Bahçe durumu:** skor + tek cümle (bkz. §7.2).
- **İndeks kartları:** "Canlılık (NDVI)" biçimi: **anlamlı ad ana, teknik ad ikincil**; 14 günlük değişim oku + %; mini sparkline (son 90 gün); `ⓘ` ile "Bu ne demek?" popover'ı ("Yaprak suyu: yaprağın su içeriğini gösterir. Düşüş su stresine işaret edebilir; sulamayı ve toprak nemini kontrol edin.").
- Karta dokununca **Uydu** sekmesine geçilir ve harita o indeksi gösterir.

### 6.5 Uydu sekmesi (sadeleşmiş)
```
┌ Haritada gösterilen: [Canlılık ▾]  (6 seçenek, anlamlı adlarla) ┐
│  segmented: [Normal] [Kontrast]    Şeffaflık ──●──            │
│  Karşılaştır ▾  (Değişim: 2 hafta · geçen yıl · iki tarih)      │
│  ▸ Gelişmiş (çizim stili, sürgü)  ← varsayılan kapalı           │
├ Sorunlu bölgeler (3) ───────────────────────────────────────────┤
│  1. Güneybatı köşe · 0,4 dekar · Yüksek · Yaprak suyu  [Odakla] │
├ Verimlilik bölgeleri ───────────────────────────────────────────┤
│  ▮ Yüksek 12,6 dekar %14 — "Güçlü; bu kesimde verim beklenir"   │
├ Zaman grafiği [3 ay][6 ay][1 yıl][2 yıl]  ← aralık seçici ──────┤
└──────────────────────────────────────────────────────────────────┘
```
- "Katman" 6 çip → **tek açılır seçici** (anlamlı ad + kısa açıklama + küçük örnek renk skalası). "Gerçek renk" ayrı ikonla.
- Piksel/Yumuşak ve Sürgü **Gelişmiş**'in altında (çoğu kullanıcı hiç açmaz).
- **Sorunlu bölgeler listesi**: alan, şiddet (Yüksek/Orta/Düşük), hangi indeks, tıklayınca haritada odak + mini önizleme; ileride "Gözlem ekle" düğmesi için yer ayrılmış.
- **Verimlilik**: lejant + alan/pay + kısa yorum, anahtar yerine "Haritada göster" bağlantısı; geliştirici notu kaldırılır.
- **Grafik:** büyütülmüş (tam panel genişliği, 12 px yazı), **aralık seçici**, **crosshair**, sezon karşılaştırması isteğe bağlı çip, **limon fenoloji bantları** (çiçeklenme Mar–Nis, meyve gelişimi, hasat Eki–Mar; arka planda %8 opaklık, açıklamalı), **bulut güveni** (noktaların opaklığı bulut oranına göre; ipucunda "güven: düşük (bulut %40)"). **Hava katmanı**: ayrı küçük alt panel (yağış çubukları + sıcaklık çizgisi) — indeks grafiğiyle **aynı x ekseni, ayrı y ekseni**, tek eksene karıştırılmaz; böylece "iki eksen karmaşası" olmaz.

### 6.6 Hava sekmesi (çiftçi dili)
```
┌ [İlaçlama] En iyi zaman                ┐
│  SALI 06:00 – 11:00     ✓ Uygun         │   ← Fraunces, büyük
│  Bugün: uygun değil (rüzgâr 21 km/s)    │
├ Uyarılar: ❄ Yarın gece don tehlikesi … ┤   ← kırmızı > sarı, panelin tepesi
├ 7 gün ─ Bugün ☁ 25°/15° 💧0 mm          │   ← sade: gün · ikon · max/min · damla mm
│          Salı  ☀ 24°/14° 💧7 mm  🌧     │
├ ▸ Saat saat ilaçlama (7×24)   [aç]      │   ← şerit artık "Detay"
├ Su durumu: "Son 7 günde toprak buharlaşmaya göre
│   28 mm susuz kaldı → sulama gündemde olabilir"
│   Yağış: bu ay 61 mm (geçen yıl 20 mm, ▲ 3 kat)
└ Veri: Open-Meteo (CC BY 4.0) · Güncelleme 14:35 │
```
- İlaçlama "hero": en iyi gündüz aralığı büyük; yoksa "Önümüzdeki 7 günde uygun pencere yok — en yakın sınırda: Perşembe 08–10".
- Saat saat şerit **ayrı açılır bölüm**; renk + desen (uygun ✓ düz, sınırda çizgili, uygun değil noktalı) → renk körü uyumlu.
- Su dengesi cümleyle ("susuz kaldı / fazla yağış aldı"), "ET₀" yalnızca ⓘ içinde; "reçete değildir" notu kalır.
- Çevrimdışı bandı tüm uygulamada tek bileşen.

### 6.7 Harita kontrolleri ve altlık
- **Spotlight:** bahçe seçilince bahçe dışı %45 koyu yeşil maskeyle kararır (200 ms), bahçe parlak kalır; ESC/geri ile kalkar.
- **Altlık:** MapTiler uydu (varsayılan) + **Esri World Imagery seçeneği** (katman menüsünde "Altlık" bölümü, ikisinin Erdemli karşılaştırması Aşama B'de yan yana ekran görüntüsüyle karar verilir; **lisans uyarısı §8**). `maxZoom` gerçek kaynak çözünürlüğüne bağlanır (bulanık aşırı yakınlaştırma yerine "daha fazla yakınlaşılamaz" ipucu); NDVI katmanı altlıktan daha yüksek yakınlaştırmada keskin kalır ama **şeffaflık sürgüsü** (varsayılan %80) ve "altlığı göster" tutamacı ile bahçe dokusu görülebilir.
- Köşe çentikleri: kenar piksellerinin (all_touched) poligon sınırında **anti-alias'lı clip** ile yumuşatılması (aşağıda öneri tablosu).
- Lejant: sol altta tek kompakt bileşen; tarih şeridiyle çakışmayacak şekilde şeridin üstüne konumlanır; mobilde şeridin içine katlanır.

### 6.8 Tarih şeridi
Ay ayraçları ("Eyl | Eki"), her küçük resmin altında tarih + **bulut %**, bulutlu tarihler soluk ve küçük bulut ikonlu; "★ en net" (bulut ≤ %5 ve geçerli piksel ≥ %95) işareti; "Yalnızca net" anahtarı; komşu ±2 tarih ızgara/PNG'si **önceden yüklenir** (geçiş anında), ok tuşları + Home/End; oynat/hız denetimi şeritten ayrı küçük gruba.

### 6.9 Mobil
- Rail → **alt sekme çubuğu** (Bahçeler · Hava · Ekle · Hesap); Copilot düğmesi mobilde gizlenir (içerik yokken).
- Panel → **alt sayfa (bottom sheet)**: kapalı (yalnızca başlık+durum), yarım (Bugün + durum), tam. Harita her zaman görünür; lejant ve şerit sayfa durumuna göre gizlenir/yukarı kayar.
- Tüm hedefler ≥44 px; liste kartları tek sütun; grafik tam genişlik.

### 6.10 Durumlar
- **Skeleton:** içerik biçimli (kart yüksekliği, sparkline çizgisi, skor halkası taslağı); en fazla 400 ms gecikmeden sonra gösterilir (kısa yüklemelerde yanıp sönme olmaz).
- **Hata:** "Bahçeler yüklenemedi. İnternet bağlantınızı kontrol edin; birkaç saniye içinde yeniden denenecek. [Şimdi dene]" + otomatik geri sayım; teknik kod yalnızca "ayrıntı" altında.
- **Çevrimdışı/önbellek bandı:** üstte ince bant ("Çevrimdışısınız — son kayıt 14:35").
- **Toast:** tek bileşen; 4 tür (başarı, bilgi, uyarı, hata), eylem düğmesi ("Geri al"), `aria-live`.
- Boş durumlar: her sekme için ilustrasyonlu (yaprak çizgi çizimi) kısa açıklama + eylem.

### 6.11 Etkileşim ve yardım
Klavye kısayolları: `?` yardım penceresi, `G` bahçeler, `W` hava, `←/→` tarih, `Space` oynat, `/` arama, `Esc` kapat. Panel/çekmece geçişleri tek yay eğrisi; bahçe seçince harita uçuşu + spotlight; hover/focus durumları token'lardan; rail tooltip'i dokunmatik için uzun basma/etiket.

---

## 7. Ürün önerilerinin değerlendirmesi

Efor: **S** ≤ 1 gün, **M** 2–4 gün, **L** 1–2 hafta (tek geliştirici, test dahil). Karar: ✅ öneri uygun · ✏️ değiştirerek · ⏸ ertele.

| # | Öneri | Karar | Neden / beklenen etki | Efor |
|---|---|---|---|---|
| 1 | Çiftçi dili (Canlılık, Yaprak suyu, Klorofil/besin, Toprak düz. canlılık; "bu ne demek?") | ✅ | En büyük anlaşılırlık kazancı; en ucuz. Teknik ad ikincil (NDVI) ve `ⓘ` popover. CIgreen → "Yaprak yeşilliği (CIgreen)". Backend `GET /indeks/tanimlar` zaten ad/açıklama taşıyor; çiftçi adı + "ne demek / ne yapmalı" alanları eklenir | S |
| 2 | Bahçe durumu skoru (0–100) + tek cümle, kural tabanlı backend | ✅ ✏️ | Kararın merkezi. **Mutlak NDVI'ya değil, bahçenin kendi mevsim normaline ve geçen yılın aynı dönemine göre** (narenciye herdem yeşil; mutlak eşik yanıltır). Dayanıklılık: skor "yönlendirme"dir, teşhis değil; Tömük saha bilgisiyle kalibre edilir. Ayrıntı §7.2 | L |
| 3 | "Bugün" kartı (1–3 madde) | ✅ (ekleme istediğiniz gibi) | Açılış değeri: karar desteği. Kural önceliği §7.3 | M |
| 4 | İndeks kartları (değer, 14 gün değişim, sparkline) | ✅ | Tek bakışta eğilim; seçili indeks haritaya bağlanır. Sparkline verisi `index_observations`'tan (yeni özet ucu) | M |
| 5 | Bahçe listesi (küçük resim, sparkline, durum, hava, sıralama/filtre, üst özet) | ✅ | Çok bahçeli kullanıcı için öncelik; küçük resim backend'de (son NDVI PNG'sinden 96 px) üretilip önbelleklenir | L |
| 6 | Harita genel görünüm (durum renkli, etiket, hover kartı, spotlight) | ✅ | Marka farkı yaratan en görünür öğe; MapLibre fill + symbol katmanı, hover popup | M |
| 7 | Uydu altlığı: maxZoom, Esri World Imagery, çentik giderme | ✅ ✏️ | maxZoom/çentik: ✅ (S/M). **Esri**: lisans/ticari kullanım kısıtı olabilir (§8); yalnızca karşılaştırma spike'ı + karar, doğrudan eklemeyiz | M |
| 8 | Grafik: aralık seçici, crosshair, fenoloji bantları, bulut güveni | ✅ | Okunaklılık + güven. Fenoloji tarihleri **ayarlanabilir sabitler** (bölgeye göre kayar; "tipik" etiketi). Hava katmanı ayrı alt panel (aynı x) | M |
| 9 | Tarih şeridi (ay ayraçları, bulut %, ★ en net, "yalnızca net", ön yükleme) | ✅ | Gezinme hızı + güven; ön yükleme zaten `useGrid` ile kolay | M |
| 10 | Hava sekmesi (hero ilaçlama, sade 7 gün, uyarı önceliği, su dengesi dili) | ✅ | İlaçlama kararı tek bakışta; mevcut veri yeterli, yalnızca sunum + birkaç alan | M |
| 11 | Sorunlu bölgeler listesi + odak | ✅ | Bugün yalnızca haritada kesikli çizgi; liste eylemi görünür kılar, "Gözlem ekle"ye hazırlar. Backend: bölgeler zaten GeoJSON; liste için alan/şiddet/indeks özeti | M |
| 12 | Verimlilik bölgeleri (lejant, alan/pay, yorum) | ✅ | Yorum şablonlu: "Yüksek: …güçlü, verim beklenir" (bilgi, reçete değil). Geliştirici notu kaldırılır | S |
| 13 | Renk körü dostu skala | ✅ ✏️ | Varsayılanı renk körü uyumlu yapmak (kırmızı-yeşil yerine turuncu→sarı→yeşil + açık/koyu kontrast) + "klasik" seçeneği. Durum/ilaçlama için desen+simge | M |
| 14 | İlk kullanım (3 adım ipucu, örnek bahçe) | ✅ | Aktivasyon; örnek bahçe `make db-seed` mantığıyla hesap başına istek üzerine oluşur (`ornek` rozeti) | M |
| 15 | Giriş/kayıt marka uyumu | ✅ | Düşük risk, yüksek algı; kayıt kapalıyken erken erişim listesi | S |
| 16 | Durumlar (skeleton, boş/hata, toast, çevrimdışı) | ✅ | Tutarlılık + güven | M |
| 17 | Mikro etkileşim + klavye yardımı | ✅ | Cila; `?` penceresi küçük | S/M |
| 18 | Performans (ön yükleme, tembel yükleme, açılış ölçümü) | ✅ | Rota bazlı kod bölme (landing/giriş MapLibre'siz), fontlar 4→2, görseller WebP; hedef: giriş/landing JS ≤ 250 kB gzip, `/bahcem` LCP ≤ 2,5 sn (4G) | M |

### 7.1 Kendi önerilerim (eklenmesini öneriyorum)

| # | Öneri | Neden / etki | Efor |
|---|---|---|---|
| A | **Tek logo** (serif+yaprak) ve "ç"lı yazım; koyu/açık varyantlar; uygulama rail'inde marka işareti | Marka tutarlılığı, logo okunmuyor sorunu (Y2) | S |
| B | **Rail'de ölü uçları gizle** ("Günlük/Raporlar" gelene kadar yok ya da "Yakında" rozetli, tıklanamaz); Copilot düğmesini içerik gelene kadar kaldır | İlk izlenim; çalışan özellikler öne çıkar | S |
| C | **Sezon seçiciyi** liste başlığından kaldırıp grafik aralığına taşı | Listenin en baskın öğesi anlamsızdı | S |
| D | **Şeffaflık sürgüsü + "uydu görüntüsü" tutamacı** (NDVI altlığı kapatma sorunu) | Bahçeyi tanıma; Y3 | S |
| E | **Veri güven göstergesi** her yerde ("Son görüntü 3 gün önce, bulut %5") ve sentetik/örnek veri rozeti | Güvenilirlik (tarım kararları) | S |
| F | **Çok dilli hazırlık yok, ama metin merkezi** (`copy.ts`): tüm Türkçe metinler tek yerde, ton kuralı ("sen" değil "siz", emir yerine öneri) | Tutarlı dil, ileride İngilizce/Arapça | S |
| G | **Bildirim tercihi** (don uyarısı e-posta/push) — *ürün kararı*, Aşama B kapsamı dışı önerilir | Don uyarısının asıl değeri uyarının kullanıcıya *ulaşması* | L (ertele ⏸) |
| H | **Paylaş/yazdır özeti** ("Bahçe durumu" tek sayfa PDF; Adım 8 ile birleşir) | Danışman/ziraat mühendisiyle paylaşım | ⏸ |
| I | **Tek tıkla "Sorun var" geri bildirimi** (skor/uyarı yanlışsa) | Kural kalibrasyonu için gerçek veri | S |

### 7.2 Bahçe durumu skoru — kural tabanlı tasarım (backend)
Girdi: bahçenin son geçerli sahnesi ve geçmiş serisi, aktif hava uyarıları.
- **Canlılık (40 puan):** son 14 günün NDVI/MSAVI ortalaması ÷ *bahçenin kendi* geçen yıl aynı dönem ortalaması (± mevsim normali); oran ≥ 0,95 → tam puan, 0,70 altı → 0.
- **Yaprak suyu (20):** NDMI'nin tarihsel medyanına göre durumu.
- **Klorofil/besin (15):** NDRE değişimi (14 gün).
- **Eğilim (15):** son 14 günde NDVI düşüş eğimi; bahçe içi homojenlik (p10–p90 aralığı).
- **Bölgesel sorun (10):** sorunlu bölge alan payı.
- **Ceza:** kırmızı hava uyarısı −15, sarı −7; çoklu indeks uyarısı −15.
- Etiket: ≥ 75 **İyi**, 55–74 **İzle**, < 55 **Dikkat**. Veri yetersizse (geçerli görüntü yok / < 3 gözlem) skor yok, "Veri hazırlanıyor".
- **Cümle şablonları** (öncelikli sebep seçilerek): "Son 2 haftada stabil." / "Güneybatı köşede yaprak suyu düşüyor, kontrol önerilir." / "Çarşamba yağış var; ilaçlamayı Salı yapın." Konum ifadesi sorunlu bölge merkezinin bahçe içindeki yönünden (GB, KD…) üretilir.
- Her skor `neden` listesiyle döner (şeffaflık); birim testli; kalibrasyon tablosu dokümante edilir. Dürüstlük notu: skor bir *yönlendirme*dir, agronomik teşhis değildir.

### 7.3 "Bugün" kartı — öncelik kuralı
1) Kırmızı hava uyarısı (don tehlikesi/aşırı sıcak) → 2) çoklu indeks/öncelikli uydu uyarısı → 3) uygun ilaçlama penceresi (en yakın gündüz) veya "bu hafta pencere yok" → 4) sarı hava/uydu uyarıları → 5) önemli iyi haber ("canlılık geçen yıldan %8 yüksek") → 6) veri eski/işleme sürüyor. En fazla 3 madde; yoksa "Bugün için özel bir uyarı yok. Son görüntü: …".

---

## 8. Riskler ve açık sorular (onayınızı bekleyen kararlar)

1. **Esri World Imagery lisansı:** doğrudan döşeme kullanımı genelde ArcGIS hesabı/anahtarı, kullanım kotası ve atıf gerektirir; ticari üründe maliyet doğabilir. Önerim: Aşama B'de yalnızca **karşılaştırma ekran görüntüsü** + lisans notu; kullanıma karar siz verin. MapTiler planınızın çözünürlük/yıl bilgisi de karşılaştırmaya girer.
2. **İki logodan hangisi?** Serif+yaprak (krem) önerim; renkli çubuklu logo ürün ailesi için kalacaksa uygulamada kullanılmaz.
3. **Skor kalibrasyonu:** Tömük bahçesinden bildiğiniz "iyi/kötü" dönemleri (ör. 2025 ilkbahar) birkaç örnekle doğrulayabilir misiniz? Kuralları gerçek sahaya göre ayarlarız.
4. **Fenoloji takvimi:** Mar–Nis çiçeklenme, Eki–Mar hasat sizin bölgenize uygun mu (Erdemli Interdonat/Lamas)? Ayarlanabilir sabit olarak koyacağım.
5. **Landing'e dokunulacak mı?** Önerim yalnızca logo/tipografi/token hizalaması (içerik değişmez). Ayrı bir site reposu gerekiyorsa söyleyin.
6. **Örnek bahçe** her yeni kullanıcıya otomatik mi, isteğe bağlı mı? Önerim isteğe bağlı.
7. **Copilot düğmesi:** içerik gelene kadar gizlemeyi onaylıyor musunuz?
8. **Kapsam sınırı:** Bildirim/e-posta (G) ve PDF paylaşımı (H) Aşama B'ye dahil edilmesin (ayrı adım).

---

## 9. Aşama B önerisi (onaydan sonra) — dilimler ve backend uç noktaları

**Dilim 1 — Temel (S/M, ~3–4 gün):** token'lar + Fraunces/Manrope, tek logo, giriş/kayıt yenileme, durum bileşenleri (skeleton/hata/boş/çevrimdışı/toast), erişilebilirlik düzeltmeleri (kontrast, hedef boyutu, odak halkası), rota bazlı kod bölme + font azaltma. *Önce/sonra ekran görüntüleri.*
**Dilim 2 — Çiftçi dili ve detay ekranı (M/L, ~1 hafta):** indeks adları + "ne demek", Bugün kartı, Bahçe durumu skoru, indeks kartları, sekme yapısı (Genel/Uydu/Hava), Uydu sekmesi sadeleştirme, sorunlu bölge listesi.
**Dilim 3 — Liste ve harita (L, ~1 hafta):** liste kartları (küçük resim, sparkline, durum, hava), özet/filtre/sıralama, harita genel görünüm + spotlight, şeffaflık, maxZoom, çentik giderme, altlık karşılaştırma.
**Dilim 4 — Grafik, şerit, hava (M, ~4–5 gün):** grafik yeniden tasarımı (aralık, crosshair, fenoloji, güven, hava alt paneli), tarih şeridi, hava sekmesi yeniden düzeni, renk körü skala.
**Dilim 5 — Mobil ve cila (M, ~3–4 gün):** alt sayfa + alt sekme çubuğu, klavye kısayolları, mikro etkileşimler, ilk kullanım rehberi + örnek bahçe, performans ölçümü (staging Lighthouse).

**Yeni/değişecek backend uçları**
| Uç nokta | İçerik |
|---|---|
| `GET /gardens/{id}/ozet` | Skor (0–100), etiket, nedenler, tek cümle özet, "Bugün" maddeleri (öncelik sıralı), indeks kartları (güncel değer, 14 gün değişim %, 90 günlük sparkline), son görüntü tarihi/güven |
| `GET /gardens/ozet` | Liste için: her bahçenin skoru/etiketi/sebebi, 30 günlük NDVI sparkline, bugünkü hava (ikon, °), aktif uyarı sayısı, küçük resim URL'i, toplamlar (bahçe sayısı, toplam dekar, dikkat sayısı) |
| `GET /gardens/{id}/kucuk-resim.png` | Son NDVI'dan ≤ 96–192 px, bahçe şekline kırpılmış, önbellekli (`Cache-Control`) |
| `GET /gardens/{id}/indeks/{indeks}/{tarih}/zones` (genişletme) | Bölge başına alan, şiddet, merkez, yön ("güneybatı") |
| `GET /indeks/tanimlar` (genişletme) | `ciftci_adi`, `ne_demek`, `ne_yapmali`, önerilen skala (renk körü uyumlu) |
| `POST /ornek-bahce` | İsteğe bağlı örnek bahçe oluşturma (silinebilir, `ornek` rozetli) |

Testler: skor/özet/Bugün kuralları birim testli (sınır değerler, veri yok, çakışan uyarılar); küçük resim ve özet uçları yetki testli.

---

## 10. Onay isteği

Lütfen şunları bildirin: **(a)** dokümanın genel yönü, **(b)** §7 tablosunda çıkarmak/ertelemek istedikleriniz, **(c)** §8'deki 8 sorunun cevabı, **(d)** Aşama B'de hangi dilimle başlayalım (önerim: Dilim 1 → 2). Onaydan önce arayüz kodunda değişiklik yapılmayacak.

---

### Ek A — Denetim ekran görüntüleri dizini
`01` landing üst · `02` landing kaydırma · `03` giriş · `04` kayıt · `05` giriş hatası · `06` boş durum · `07` bahçe ekle menüsü · `08` boş hava özeti · `09` bahçe listesi · `10`–`14` bahçe detayı (Uydu sekmesi, 5 kaydırma noktası) · `15` Hava sekmesi · `16` hava özeti · `17` Copilot çekmecesi · `18` yükleniyor (liste) · `19` hata (liste) · `20`–`21` hava yükleniyor/hata · `22` klavye odağı · `23`–`28` mobil (landing, giriş, harita, liste, detay, detay alt).

### Ek B — Denetim yapılırken gözlenen teknik notlar
- Odak halkası: rail bağlantısında `2px solid rgb(159,177,163)` (açık gri); tüm odaklanabilir öğelerde tek tutarlı halka tanımlı değil.
- Mobil küçük hedefler (ilk 40): hesap menüsü 36×36, geri 32×32, sekmeler 36 px yüksek, indeks çipleri 32 px, grafik çipleri 27–28 px, "Konum ara" 21 px, harita atıf bağlantıları 14 px.
- `index.html` 4 font ailesini bloklayıcı olarak yüklüyor; `font-display: swap` var ama alt kümeleme yok.
- Tüm rotalar tek pakette: landing ziyaretçisi MapLibre + terra-draw + togeojson + jszip indiriyor.
