# 0034 — Günlük: etiketli gözlem, yapılandırılmış hasat, çevrimdışı kuyruk, dışa aktarma (ADIM 11 · Dilim 0)

Durum: kabul edildi (ürün sahibi kararları, 2026-11-18). İlgili: ADR 0019 (Saha Defteri), ADR 0033 (sebep), `docs/product/adim-11-durum.md`, `docs/product/adim-11-d0-390-olcum.md`, katalog `gunluk` bloğu (`rules/katalog.yaml`, test `tests/test_gunluk_katalog.py`).
Kapsam: **karar ve şema**. Bu belge kod, migration ya da uç nokta eklemez; uygulama Dilim 1–5'tedir. Katalog sözlüğü (etiketler, hasat/kalite/satış kodları, kuyruk ayarları) Dilim 0'da eklendi: «ön değer · mühendis onayı bekliyor».

## Bağlam
Saha Defteri bugün serbest metin + konum + fotoğraf kaydıdır; hasat yalnız tarih ve nottur; çevrimdışı çalışma, etiket ve dışa aktarma yoktur; dev veritabanında sıfır saha kaydı vardır. Adım 11 bunu **kullanılabilir saha günlüğüne** çevirir ve 11B (rekolte) için doğru yapıda veri toplar; **bu adımda tahmin üretilmez.**
390 px ölçümü (jlnnlk gerçek sayfa, `adim-11-d0-390-olcum.md`): Defter 5.378 px yüksekliğinde, yeni kayıt formu **sayfanın 5.015. pikselinde** (23 doğrulama kartından sonra); nokta modunda haritaya dokunmak için ~4.700 px geri kaydırmak gerekir; 44 px altı 32 hedef (doğrulama rozeti özeti 24 px, «kaynak» bağlantısı 36×17, katman onay kutusu 13 px); tarih alanı ≥ 561 px genişlikte 36 px.

## Kararlar

### 1. Hasat birimi
Bahçe geneli **zorunludur**; vana ve/veya bölge **isteğe bağlı, çoklu seçim**. Vana = `irrigation_sectors` (kullanıcı çizer). **Bölge = çok yıllı analiz çokgeni; kimliği kararsızdır** (analiz yeniden koşunca `multiyear_results` ile birlikte silinir), bu yüzden hasat kaydı bölgeyi **o günkü çokgen anlık görüntüsü** olarak saklar. Verim (kg/da) = kayıt kg / seçilen birimlerin alanı toplamı (çakışan birimler tekilleştirilir); birim seçilmemişse bahçe alanı.

### 2. Miktar
Kanonik birim **kg**. Kaynak alanı `miktar_kaynagi`: `kantar` (doğrudan kg, kantar fişi) ya da `kasa_tahmini` (kasa adedi × kasa ağırlığı). Varsayılan kasa ağırlığı **20 kg**, bahçe ayarında değişir (`gardens.kasa_kg`); **kayıt kasa ağırlığını kendi içinde saklar** (ayar sonradan değişse geçmiş kayıt değişmez). Kantar fişi fotoğrafı kayda eklenebilir (`field_photos.rol = 'kantar_fisi'`).

### 3. Kalite sözlüğü
`ihracatlik | birinci_sinif | ikinci_sinif | sanayilik_iskarta`; bir kayıtta birden çok sınıf satırı olabilir (ör. 300 kasa 1. sınıf + 40 kasa sanayilik). **Standart karşılığı (dürüstçe):** UNECE FFV-14 turunçgil standardı üç sınıf tanımlar: «Extra», «Class I», «Class II» (metin: ECE/TRADE/C/WP.7/2009/5, okundu; güncel baskı UNECE sitesi bu ortamdan açılmadığı için doğrulanamadı). Eşleşme birebir **değildir**:

| Günlük sınıfı | UNECE FFV-14 | Not |
|---|---|---|
| birinci_sinif | Class I | doğrudan |
| ikinci_sinif | Class II | doğrudan |
| ihracatlik | **sınıf değil** | ticari hedef; en az Class I + alıcı/ihracat şartnamesi (ön değer); «Extra» burada tutulur |
| sanayilik_iskarta | **karşılığı yok** | Class II asgari gereklerini karşılamayan mahsul |

**Türk Standardı (TS) karşılığı doğrulanamadı** (bu oturumda TS numarası bulunamadı); mühendis/üretici girdisiyle tamamlanacak. UNECE tolerans yüzdeleri (Extra %5, Class I %10, Class II %10) kayıt doğrulamasında **kullanılmaz** (kayıt sınıflandırma beyanıdır, kalite kontrol değil).

### 4. Satış (isteğe bağlı, kişiye özel)
`dalinda_goturu | tuccara_kg | hale | kendi_depoya | ihracatciya` (kod ASCII; arayüzde «Dalında götürü»); alıcı adı serbest metin; fiyat TL/kg, götürüde **toplam TL**. Ayrı tabloda (`hasat_satis`), yalnız çalışma alanı sahibine döner; **hiçbir toplulaştırma, kıyas, pazar ya da dışa aktarma bu tabloyu açık seçim/rıza olmadan okumaz** (19B kıyası ve 17 Pazar bu tablodan beslenmez; CI testi: satış tablosunu okuyan kod yolu allow-list ile sınırlı).

### 5. Gözlem etiketleri ve sistem yanıtları
Etiket kümesi katalogda (yedi kategori, 33 etiket; test onaylı listeyle birebir kilitler). **Dilim 1 güncellemesi (onay 2026-11-20):** «Çevre/fizyolojik»e **Su stresi (solgunluk)** eklendi; yeni kategori **Bakım/yönetim** (Budama, Hasat, «Budama / hasat (ayrıştırılmamış)»; ileride ilaçlama ve gübreleme buraya girer). Şiddet + yaygınlık zararlı, hastalık, çevre ve sulama/altyapıda **zorunlu**, fenoloji, bakım ve genel gözlemde isteğe bağlıdır (`siddet_zorunlu`, ön değer). Her gözlemde **şiddet** (az/orta/çok), **yaygınlık** (tek ağaç/birkaç ağaç/bölge/bahçe geneli), **konum** («Konumumu kullan» ya da haritadan nokta; doğruluk metre olarak yazılır) ve isteğe bağlı vana.
**Eşleme** (sistem yanıtları aynı etiket setiyle yazılır; kayıt `gozlem_detay.kaynak = 'sistem'`):

| Sistem yanıtı | Gözlem etiketi |
|---|---|
| 10B «Sebep buydu: don» | Çevre/fizyolojik · Don |
| «besin» | Çevre/fizyolojik · Yaprak sararması (besin belirtisi olabilir) |
| «hastalık/zararlı» | Hastalık · Diğer (tür bilinmiyor) |
| «su» | Çevre/fizyolojik · Su stresi (solgunluk) |
| «budama/hasat» | Bakım/yönetim · Budama / hasat (ayrıştırılmamış) |
| «bilmiyorum» | eşleşme yok (gözlem üretilmez) |
| ADIM 10 «Don oldu mu?» oldu | Çevre/fizyolojik · Don |
| «olmadı», «bilmiyorum» | eşleşme yok (olumsuz yanıt gözlem değildir; `don_geri_bildirim`'de kalır) |

**Karar (2026-11-20):** «su» ve «budama/hasat» yanıtları yukarıdaki etiketlere eşlenir; «Don oldu mu?» «olmadı» ve «bilmiyorum» eşlenmez (`don_geri_bildirim`'de kalır, Saha Defteri kaydı etiketsiz durur). 10B «budama/hasat» yanıtı tek bir yanıttır; budama mı hasat mı ayrımı yapılamadığından «ayrıştırılmamış» etiketine yazılır. `sebep_etiket` tablosu asıl kayıt olarak sürer.

### 6. Çevrimdışı
- **Yazma kuyruğu** (IndexedDB): her kayıt istemcide üretilen **kimlikle** (`istemci_kimligi`, UUID) kuyruğa girer; sunucuda `(garden_id, istemci_kimligi)` tekildir → aynı kayıt tekrar gönderilirse **mevcut kayıt döner, ikinci kayıt oluşmaz**. Fotoğrafın da kendi istemci kimliği vardır (`field_photos (kayıt, istemci_kimligi)` tekil): **fotoğraf yeniden denemesi ikinci fotoğraf/kayıt üretmez.** Sıra: kayıt → fotoğraflar; kayıt oluştuysa fotoğraf yarıda kalsa da yalnız eksik fotoğraflar sürer.
- **Taslak:** form alanları yerelde saklanır (sayfa yenilemede ve uygulama kapanınca kaybolmaz).
- **Fotoğraf:** istemcide küçültülür (uzun kenar 2048 px, hedef ~1 MB, EXIF'siz yeniden kodlama), sunucu sınırı (6 MB) değişmez.
- **Zaman aşımı ve görünürlük:** istek zaman aşımı 30 sn (fotoğraf 60 sn), artan bekleme 5/30/120/600 sn, en çok 200 bekleyen (taşarsa kullanıcıya söylenir); ekranda sürekli **«gönderilmeyi bekliyor (N)»** ve kayıt başına durum (bekliyor · gönderiliyor · hata + «yeniden dene» · «sil»).
- **Kapsam:** çevrimdışı **oluşturma** (ve kuyruktaki kaydı düzenleme/silme); eşzamanlanmış kaydı düzenleme/silme çevrimiçi gerektirir.
- **Oturum:** erişim belirteci kısa ömürlüdür; 401'de kuyruk **durur ve kayıt silinmez**, kullanıcıya «yeniden giriş» gösterilir; yenileme belirteci (14 gün) akışı kuyruğu sürdürür.
- **PWA kabuğu:** yüklenebilir (manifest + 192/512 px simge; 512 px simge bugün **yok**, Dilim 2'de üretilir) ve uygulama kabuğu önbelleği (derlenmiş dosyalar). **API yanıtları, fotoğraflar ve harita karoları önbelleğe ALINMAZ.** Çevrimdışıyken harita boş kalır; konum **GPS ile** alınır (haritadan nokta seçimi çevrimiçi gerektirir) ve ekran bunu açıkça söyler. Yeni sürüm bildirimi kullanıcı onayıyla uygulanır.
- **Gizlilik:** kuyruktaki kayıtlar cihazda şifresiz durur (cihaz kaybı riski belgede ve ayarlar sayfasında söylenir); EXIF konumu küçültmede silinir, konum yalnız kullanıcının seçtiği/GPS noktasıdır.

### 7. Dışa aktarma
- **CSV:** UTF-8 **BOM**, ayırıcı `;`, satır sonu CRLF, ondalık **virgül**, tarih ISO (`2026-11-18`, Excel TR tarih olarak açar). İki dosya: `gozlemler` ve `hasatlar` (hasatta sınıf satırı başına bir satır; kayıt kimliği tekrar eder). **Formül enjeksiyonu önlemi:** `=`, `+`, `-`, `@`, sekme ya da CR ile başlayan metin hücreleri başına `'` alır.
- **Satış sütunları varsayılan DIŞARIDA**; kullanıcı «Satış bilgisini dahil et» seçerse yazılır.
- **GeoJSON:** `FeatureCollection`; konumlu kayıt = Point/Polygon, konumsuz kayıt `geometry: null`; özellikler CSV ile aynı sütunlar (satış hariç varsayılan), fotoğraflar oturum gerektiren bağlantı olarak.
- Süzgeç (bahçe, tarih aralığı, tür/etiket) ekrandakiyle aynı; **satır sayısı süzgeçle eşit** (test). PDF kayıt defteri **13B**'dedir.

## Şema önerisi (uygulama Dilim 1–5; Dilim 0'da migration YOK)
Çapa kayıt `field_records` kalır (ADR 0019 §2: hasat `tur='hasat'`); fotoğraf, konum, liste, silme tek yerde. Yeni sütun/tablolar:

```
field_records   + istemci_kimligi uuid NULL;  UNIQUE (garden_id, istemci_kimligi) WHERE istemci_kimligi IS NOT NULL
field_photos    + istemci_kimligi uuid NULL;  UNIQUE (record_id, istemci_kimligi) / (verification_id, istemci_kimligi)
                + rol varchar(12) NOT NULL DEFAULT 'genel'   -- genel | kantar_fisi (katalog foto.roller)
gardens         + kasa_kg numeric(4,1) NOT NULL DEFAULT 20   -- aralık: katalog hasat.kasa_kg_min..max

gozlem_detay    (record_id PK FK field_records CASCADE, kategori varchar(20), etiket varchar(32), siddet varchar(4), yayginlik varchar(12),
                 sector_id uuid NULL FK irrigation_sectors SET NULL, kaynak varchar(8) -- kullanici | sistem,
                 iliski_anahtar varchar(80) NULL, konum_dogruluk_m numeric(6,1) NULL)

hasat_detay     (record_id PK FK CASCADE, miktar_kaynagi varchar(14), toplam_kg numeric(10,1) NOT NULL CHECK > 0,
                 kasa_adedi int NULL, kasa_kg numeric(4,1) NULL)
hasat_sinif     (id, record_id FK CASCADE, kalite varchar(20), kasa_adedi int NULL, kg numeric(10,1) NOT NULL, UNIQUE (record_id, kalite))
hasat_birim     (id, record_id FK CASCADE, tur varchar(5) -- vana | bolge, sector_id uuid NULL FK SET NULL,
                 bolge_etiket varchar(40) NULL, geom geometry(MultiPolygon,4326) NULL, alan_m2 double precision NOT NULL)
hasat_satis     (record_id PK FK CASCADE, satis_sekli varchar(16), alici varchar(120) NULL, fiyat_tl_kg numeric(8,2) NULL, toplam_tl numeric(12,2) NULL)
```
**Doğrulama kuralları (Dilim 3'te testle):** `kasa_tahmini`: her sınıf satırında `kasa_adedi` zorunlu, `kg = adet × kasa_kg`, `toplam_kg = Σ kg`; `kantar`: `toplam_kg` zorunlu, sınıf satırı kg toplamı `toplam_kg` ile **±%1** (katalog `toplam_tolerans_yuzde`) içinde; kasa ağırlığı katalog aralığında; en az bir sınıf satırı; sınıf kodları, satış şekli, etiket/şiddet/yaygınlık **katalogdan** doğrulanır (bilinmeyen kod 422); gelecekteki tarih 422; satış alanları yalnız `hasat_satis`'te.
API (uygulama sırası): Dilim 1 `POST/PATCH /gardens/{id}/saha-kayitlari` gözlem alanlarını alır (`istemci_kimligi` ile idempotent); Dilim 3 hasat gövdesi; Dilim 5 `GET /gardens/{id}/gunluk/disa-aktar?bicim=csv|geojson&…`.

## Ek kararlar
- **Saha turu:** 10B'nin «belirsiz» sebep olayları ve «Sahada şunlara bakın» maddeleri **kontrol noktası** olur (Dilim 1): nokta = olay yaması merkezi (yoksa bahçe merkezi), listede sebep başına kontrol maddeleri, ziyarette gözlem formu ön dolu ve «Sebep buydu» sorulur.
- **Dokunma hedefi:** tarih dahil tüm giriş ve düğmeler **tüm genişliklerde ≥ 44 px** (bugün tarih alanı ≥ 561 px'te 36 px). Satır içi metin bağlantıları muaf; ayrı dokunulan her şey (özet satırı, onay kutusu etiketi) ≥ 44 px.
- **Yeni kayıt akışı (390 px):** kayıt ekleme sabit bir eylemle (alt çubuk «+ Kayıt») her zaman erişilir; harita ile form aynı görünümde (nokta seçimi için ~4.700 px kaydırma kalkar). Ayrıntı Dilim 1 tasarımında.
- **Her dilimde 390 px ekran görüntüsü zorunlu** (jlnnlk gerçek sayfa; gerçek veri yoksa test bahçesi, belgede işaretli).

## Alternatifler
- *Hasat için ayrı çapa tablosu:* fotoğraf/konum/liste/silme/9G bağları yeniden yazılırdı → `field_records` çapası + tipli yan tablolar.
- *Satışı hasat satırına koymak:* toplulaştırma ve dışa aktarmada yanlışlıkla sızar → ayrı tablo, açık seçim.
- *Bölgeyi kimlikle bağlamak:* kimlik analizle birlikte silinir → çokgen anlık görüntüsü.
- *Tam PWA (harita karoları dahil):* depolama ve lisans (karo kullanım şartları) maliyeti, kararla dışarıda; yalnız kabuk + kuyruk.
- *Kalite sınıflarını UNECE adlarına eşitlemek:* ihracatlık ve sanayilik standardın sınıfı değildir → eşleşme tablosu açıkça söyler.

## Sonuçlar ve sınırlar
- 11B için veri yeterliliği ancak hasat kayıtları birikince ölçülür; dev veritabanı bugün sıfırdır.
- TS karşılığı ve UNECE güncel baskı doğrulaması açık; kalite sözlüğü «ön değer · mühendis onayı bekliyor».
- Çevrimdışıyken harita yoktur; GPS doğruluğu cihaza bağlıdır.

## Dilim 1 gerçeklemesi (2026-11-20)
- Migration `049_gozlem_detay` (kategori, etiket, şiddet, yaygınlık, vana, kaynak kullanici|sistem, ilişki anahtarı, GPS doğruluğu); `GET /gunluk/sozluk` (katalogdan); kayıt uç noktaları gözlem alanlarını alır, katalogdan doğrular (bilinmeyen kod, eksik şiddet/yaygınlık, başka bahçenin vanası 422), `kategori`/`etiket` süzgeci.
- Sistem yanıtları (`Sebep buydu`, `Don oldu mu?`) `fieldbook/sistem.py` ile katalog eşlemesinden etiketli yazılır (`kaynak = sistem`).
- Saha turu: 10B «belirsiz» (son 45 gün, `saha.tur_sebep_gun`, henüz yanıtsız) düşüşler `sebep_belirsiz` noktası olur: olay yaması merkezi, katalog «Sahada şunlara bakın» maddeleri (kaynaksız madde «kaynak yok»), ziyarette «Sebep buydu». Aynı olay iki nokta üretmez.
- Arayüz: sabit «+ Kayıt» ve kayıt çekmecesi (≤ 900 px'te harita üstte, çekmece kalan alanda; kaydırma gerekmez), «Konumumu kullan» (doğruluk m), kamera/galeri, istemcide küçültme (uzun kenar ve hedef boyut katalogdan), yerel taslak, Günlük sekmesi, tüm Defter hedefleri ≥ 44 px (e2e taraması 390 ve 1024 px).
- Dilim 2'ye bırakılanlar: çevrimdışı kuyruk, `istemci_kimligi` idempotansı, PWA. Taslakta fotoğraf yoktur.
