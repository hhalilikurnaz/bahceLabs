# ADIM 11 — Günlük (gözlem + hasat kaydı): durum belgesi

Tarih: 2026-11-18. Kapsam: **yalnız durum tespiti ve dilim önerisi; kod yok.** Kaynaklar: `docs/roadmap.md`, `docs/PLAN-FAZ1.md`, `docs/design/BILGI-MIMARISI.md`, ADR 0019, repo kodu (dosya yolları aşağıda), geliştirme veritabanı (salt okunur sayım). Doğrulama notu: bu belgedeki «bugün var olan» maddeleri kod ve veritabanı sayımından çıkarıldı. §4, Dilim 0'da jlnnlk 390 px ölçümüyle doğrulandı ve iki yerde düzeltildi (`adim-11-d0-390-olcum.md`).

## 1. Roadmap'te Adım 11 ve 11B için yazanlar (aynen)

`docs/roadmap.md` satır 45 (başlık; altında gövde metni **yok**):

> ### 11 · Günlük · 11B Rekolte tahmini · 12 İlaç defteri · 12B İhracat uyum pasaportu · 13 Maliyet defteri · 13B İTU / GlobalG.A.P. kayıt dosyası · 14 Toprak örneklemesi

`docs/roadmap.md` içinde 11 ya da 11B için başka satır yoktur. Tamamlayıcı ifadeler başka belgelerde:

- `docs/PLAN-FAZ1.md` adım tablosu: «| 11 | Günlük: gözlem ve hasat kaydı |» ve «| 12 | İlaç defteri, hasat bekleme süresi, kalıntı uyarısı |»
- `docs/design/BILGI-MIMARISI.md` satır 31: «gunluk   Günlük  Yakında: Gözlemler (11) · Hasat (11) · İlaç defteri (12) · Maliyet & işçi/yevmiye (13) · Kayıt dosyası İTU/GlobalG.A.P. (13B)»
- `docs/design/prototip/komuta-merkezi.html` (tasarım prototipi, değerleri temsilî): «Günlük · Adım 11–13» / «Gözlemler: Fotoğraf ve not, haritada konumuyla» / «Hasat: Blok blok kg / kasa, bölgelerle karşılaştırma» / «Konumlu fotoğraf Adım 11 ile».
- `docs/mimari/karar/0019-gecmis-ve-saha-defteri.md`, «Açık konular»: «Saha Defteri çevrimdışı çalışma ve yazdırma düzeni (şimdilik yazdır düğmesi; çevrimdışı kuyruk Adım 11).» Aynı ADR §2'de: «Hasat için ayrı tablo: aynı kayıt modeli yeterli; hasat yalnız `tur='hasat'` kaydıdır, uydurma/varsayılan yok.»
- Arayüzde bugün Günlük sekmesi: «Gözlem, hasat ve iş kayıtları konumlu fotoğraflarla burada tutulacak.» (`SagPanel.tsx`, «yakında» satırı).

**Sonuç:** 11 için kapsam cümlesi tek satırdır («gözlem ve hasat kaydı»); 11B için «Rekolte tahmini» başlığından başka tanım yoktur. Bu belgedeki dilimler bu boşluğu dolduran **öneridir**, onayınıza tabidir.

## 2. Saha Defteri'nde bugün var olanlar

### 2.1 Kayıt türleri ve kim yazıyor
`field_records` (`domain/fieldbook/models.py`), tür kümesi 7: `gozlem · ilaclama · gubreleme · sulama · hasat · tuzak · yagis`.

| Tür | Kim yazar | Yapılandırılmış alan (`ayrinti`) | Başka yerde kullanılıyor mu |
|---|---|---|---|
| yağış ölçümü (`yagis`) | kullanıcı (form) | `mm` zorunlu, 0–500 (doğrulanır) | Sulama planı o günün yağışını hava serisinden ÖNCE bu değerle alır (`water/rain_series.py`); 9J kaynak uyumu ölçüm-ERA5 farkını aylık biriktirir (`izleme/uyum.py`) |
| sulama (`sulama`) | kullanıcı (form) **ve** Sulama panelindeki «uygulandı» (`irrigation/service.py`) | `sure_dk` ve/ya `m3`, isteğe bağlı | Toprak kovasına eklenir; 9J kural performansı «uygulama oranı» |
| gözlem (`gozlem`) | kullanıcı (form, tur noktası ziyareti) **ve sistem** | kullanıcı kaydında yok; sistem kayıtlarında `konu` anahtarı | `don_uyarisi` («Don oldu mu?» yanıtı, `don/servis.py`), `sebep_yaniti` («Sebep buydu», `sebep/servis.py`), sistem kontrol yanıtı (`irrigation/sk_servis.py`); don hasar raporu PDF'i kayıt ve fotoğrafları alır |
| hasat (`hasat`) | kullanıcı (form) | **yok** (yalnız tarih, isteğe bağlı konum, not, fotoğraf) | Geçmiş sayfası yıl satırında yalnız «kayıt var · adet · son tarih» (`fieldbook/service.py: harvest_by_year`) |
| ilaçlama, gübreleme, tuzak | kullanıcı (form) | **yok** | Hiçbir hesapta kullanılmıyor (tuzak sayımı girişi roadmap'te sonraya bırakıldı) |

Ayrı tablolar: `event_verifications` («Uydu haklı mıydı?», olay anahtarıyla), `tour_visits` (saha turu ziyareti), `sebep_etiket` (model eğitimi için ayrı; rıza alanı var, varsayılan yok), `don_geri_bildirim`.

### 2.2 Veri modeli kuralları
Tarih zorunlu; konum isteğe bağlı: nokta ya da alan (WGS84), bahçeye ≤ 500 m, alan ≤ 5.000 da, geçerli GeoJSON; kayıt sahibi bahçenin çalışma alanı (başkasının bahçesi 404); düzenleme ve silme var (`PATCH/DELETE /gardens/{id}/saha-kayitlari/{id}`). Kayıtta **vana (`irrigation_sectors`), bölge (`multiyear_zones`) ya da blok bağı yoktur**; yalnız serbest konum vardır. Etiket/kategori alanı yoktur (gözlem için tür dışında sınıflandırma yok).

### 2.3 Fotoğraf
`field_photos`, kayıt başına ≤ 5, JPEG/PNG/WebP ≤ 6 MB (`field_photo_max_bytes`), sunucuda Pillow ile doğrulanır, uzun kenar 1600 px'e indirilir, **EXIF'siz JPEG** olarak yeniden kodlanır. Fotoğrafın EXIF tarihi ve konumu **öneri** olarak okunur (`saha-fotograf-oneri`; dosya saklanmaz), kullanıcı onaylamadan forma yazılmaz. Doğrulama kartlarına da fotoğraf eklenebilir.

### 2.4 Ekranlar
- **Saha Defteri tam sayfası** `/bahceler/:id/defter` (`DefterSayfasi.tsx`): harita + «Saha turu» + «Uydu haklı mıydı?» doğrulama kartları + «doğruluk özeti» + «Kayıtlar» (yeni kayıt formu, kayıt listesi, tür süzgeci, silme, haritada göster). Harita katmanı «Saha kayıtları».
- **Saha turu** (**karar ve gerçekleme var**, ADR 0019 §4, 9G-B): otomatik kontrol noktaları mevcut kayıtlardan okunur: doğrulama bekleyen olayın yama merkezi, yıllardır zayıf kalan bölge, son net görüntüdeki stres yaması; en yakın komşu sırası (en çok 12 nokta), 55 m/dk + nokta başına 4 dk, her noktada not + tek fotoğrafla «ziyaret edildi», geri alınabilir, yazdır düğmesi (`window.print`).
- **Geçmiş** olay çizelgesi saha kayıtlarını «Saha kayıtları» süzgeciyle aynı çizelgede gösterir; çiftçi yanıtı olay satırında rozet.
- **Çalışma alanı «Günlük» sekmesi: boş yer tutucu** («yakında»). Bugün kartında `sekme: gunluk` seçeneği tanımlı ama içerik yok.

### 2.5 Çevrimdışı durum
**Yok.** Service worker, `manifest`, IndexedDB ya da yazma kuyruğu yok (`OfflineBanner.tsx` yalnız üstte uyarı gösterir ve bağlantı gelince sorguları yeniler). Mutasyonlarda otomatik yeniden deneme yok (`retry: 1` yalnız sorgular için). Form taslağı kalıcı değil. Fotoğraflar kayıt oluştuktan SONRA, tek tek yüklenir (`useKayitOlustur`); yükleme düşerse kayıt fotoğrafsız kalır ve hata görünür.

### 2.6 Dışa aktarma
Kayıtlar için **yok** (CSV, PDF, GeoJSON yok). Var olanlar: don olayı hasar raporu PDF'i (kayıt ve fotoğrafları içerir), `scripts/export_event_validation.py` (doğrulama yanıtlarını `docs/agro/olay-dogrulama.md`'ye yazar), saha turu yazdır düğmesi.

### 2.7 Veri durumu (dürüstlük)
Geliştirme veritabanında bugün: `field_records` **0**, `field_photos` **0**, `event_verifications` **0**, `tour_visits` **0**, `sebep_etiket` **0**, `don_geri_bildirim` **0**, `irrigation_sectors` (vana) **0**, `multiyear_zones` 70. Yani sahadan **hiç gerçek kayıt yok**; hasat, verim ya da rekolte için kalibrasyon verisi sıfırdır.

### 2.8 Test örtüsü
`e2e/defter.spec.ts` 8 test (boş durum, nokta+not+fotoğraf, alan kaydı, doğrulama, dış ön yargı, saha turu, katman, EXIF önerisi); `tests/test_fieldbook_api.py`, `test_fieldbook_rules.py`, `test_fieldbook_exif.py`; yağış/sulama kaydı tüketicileri kendi testlerinde.

## 3. Eksikler (Adım 11 için)

| Konu | Bugün | Eksik |
|---|---|---|
| **Gözlem kaydı** | Konumlu, fotoğraflı serbest metin | **Etiket/konu yok** (zararlı · hastalık · fenoloji · genel); kullanıcı etiketli gözlem giremez, etiketle süzemez. «Konu» yalnız sistem yazımında var ve kullanıcıya görünmez. Fenoloji gözlemi (çiçek, meyve tutumu vb.) fenoloji motoruna girdi olmuyor. «Sahada şunlara bakın» kontrol listesi (Adım 10B) ile kayıt arasında bağ yok. |
| **Saha turu** | Otomatik noktalar var (§2.4) | 10B'nin «belirsiz» olay ve sebep kontrol noktaları tura girmiyor; tur ziyaretinde «Sebep buydu» sorulmuyor; noktalara vana/bölge adı yazılmıyor (vana yok). Çevrimdışı kullanım yok. |
| **Hasat kaydı** | Yalnız tarih + not (+ konum, fotoğraf) | **Yapılandırılmış alan yok:** blok/vana, kasa sayısı, kasa kg ya da toplam kg, kalite sınıfı, fiyat, alıcı. Birim ve düzenli giriş yok; Geçmiş yalnız «adet · son tarih» gösterir. |
| **Blok / vana bağı** | Vana tablosu var (`irrigation_sectors`, çokgen, dev'de 0), çok yıllı bölge var (70). Kayıtlarda bağ yok | Roadmap notu: «blok (parsel alt bölümü) kavramı yok» (ADR 0023). Hasat için birim seçilmeli: vana mı, otomatik bölge mi, serbest çokgen mi. Nokta-çokgen eşlemesi teknik olarak kolay. |
| **Hasat → verim haritası / rekolte kalibrasyonu** | Yok | Verim (kg/da) hesabı, vana/bölge bazlı verim katmanı, yaz canlılığı ile karşılaştırma (prototip: «bölgelerle karşılaştırma»); rekolte tahmini 11B'dedir ve **kalibrasyon verisi birikmeden anlamlı sonuç vermez** (dev'de hasat 0). 11'in görevi veriyi doğru yapıda toplamaktır. |
| **Dışa aktarma** | Yok (§2.6) | Günlük kayıtlarının CSV (Türkçe Excel uyumlu) ve konumlu GeoJSON dışa aktarımı; sonraki 13B İTU/GlobalG.A.P. dosyası bu alanlara dayanır. |
| **Çevrimdışı** | Yok (§2.5) | Yazma kuyruğu, taslak, fotoğraf kuyruğu, tekrarlı gönderimde tek kayıt (idempotans). ADR 0019 bunu açıkça Adım 11'e bırakmıştı. |
| **Günlük sekmesi** | «Yakında» satırı | Gerçek içerik (kayıt akışı, ekleme, süzgeç). |

## 4. Mobil / saha kullanımı riskleri (kod incelemesi; 390 px ekran görüntüsü alınmadı)

1. **Bağlantı:** çevrimdışı yok; mutasyonlar zaman aşımı/yeniden deneme olmadan bekler (`apiRequest` AbortController kullanmıyor). Zayıf bağlantıda «Kaydet» sonsuza dek bekleyebilir; sayfa yenilenirse yazılan not kaybolur (taslak yok).
2. **Fotoğraf yükleme:** istemci tarafında küçültme yok; telefon fotoğrafı sıklıkla 3–10 MB iken sınır 6 MB (aşılırsa sunucu doğrulama hatası döner; zayıf hatta yavaş) — **Dilim 0 ölçümü:** 413 değil doğrulama hatası. Fotoğraflar kayıttan sonra sıralı yüklenir: kısmi başarısızlıkta kayıt var, fotoğraf yok; kullanıcı «yeniden dene» ile **ikinci bir kayıt** üretebilir (kopya). iOS'ta HEIC için tarayıcı dönüşümüne güveniliyor. `capture` özniteliği yok: doğrudan kamera açılmıyor.
3. **Konum:** kayıt formunda «Konumumu kullan» yok; konum haritaya dokunarak seçilir (GPS yalnız saha turu başlangıcında, `TurBolumu`). Doğruluk (m) gösterilmiyor. Güneş ışığında 10 m piksel haritasında nokta seçimi zor.
4. **Tek elle kullanım / 390 px:** ≤ 900 px'te harita `56vh` üstte, form altta: nokta seçmek için sayfayı iki yönde kaydırmak gerekiyor; ekran klavyesi formu ve düğmeyi örtebilir. Dokunma hedefleri: **Dilim 0 ölçümüne göre** giriş formu 390 px'te 44 px (tarih alanı ≥ 561 px'te 36 px); asıl sorun başka yerde: 32 hedef < 44 px (doğrulama rozeti özeti 24 px, «kaynak» bağlantısı, katman onay kutusu 13 px) ve **yeni kayıt formu sayfanın 5.015. pikselinde** (23 doğrulama kartından sonra). Ayrıntı: `adim-11-d0-390-olcum.md`.
5. **Gerçek durum zorluğu:** eldiven, güneş yansıması (renk dışı işaret kuralı var), batarya; kayıt akışı 3 dokunuştan uzun (tür → tarih → konum → not → foto → ekle).
6. **Kişisel veri:** konumlu fotoğraf ve not kişisel veridir (KVKK); alıcı/fiyat ticari olarak hassas; dışa aktarma ve ileride paylaşım bağlantısı (rapor adımı) bunu kapsamalı.
7. **Veri bütünlüğü:** `ayrinti` serbest JSON; hasat ve gözlem için tür bazlı doğrulama yok (yağışta var). Kg/kasa gibi alanlarda birim karışıklığı riski.

## 5. Önerilen dilimler ve kabul ölçütleri

Sıra gerekçesi: yazma yolu (kuyruk, idempotans) hasat alanlarından ÖNCE kurulur; hasat alanları vana/bölge kararına bağlıdır; verim karşılaştırması hasat verisi olmadan anlamsızdır. 11B (rekolte tahmini) bu adımın **dışındadır**, ayrı adım olarak kalır.

**Dilim 0 — Kararlar ve şema (kod yok, ADR 0034).** Karar listesi (§6); hasat kayıt alanlarının ve birimlerinin ziraat mühendisi/üretici görüşüyle belirlenmesi; 390 px'te mevcut Defter'in gerçek ekran görüntüleriyle saha riskleri tablosunun ölçülmesi (§4 doğrulaması).
*Kabul:* ADR 0034 onaylı; hasat ve gözlem alan sözlüğü (birim, aralık, zorunluluk) katalogda «ön değer · mühendis onayı bekliyor»; §4 maddeleri ekran görüntüsüyle doğrulanmış ya da çürütülmüş.

**Dilim 1 — Gözlem v2 + Günlük sekmesi.** Etiketli gözlem (zararlı · hastalık · fenoloji · genel; alt alanlar Dilim 0'da), «Konumumu kullan» (doğruluk gösterilir), kamera yakalama, **istemci tarafında fotoğraf küçültme**, taslağın yerelde saklanması, Günlük sekmesinde kayıt akışı ve ekleme; 10B «Sahada şunlara bakın» maddesinden ön dolu gözlem; tura 10B belirsiz olay noktası.
*Kabul:* etiketle süzme çalışır; 390 px'te kayıt ≤ 4 dokunuş (ölçülüp belgelenir) ve tüm hedefler ≥ 44 px; istemci çıktısı sunucu sınırının (6 MB) altında; sayfa yenilemede taslak kaybolmaz; e2e + axe + 1440/1024/390 ekranları; mevcut Defter testleri bozulmaz.

**Dilim 2 — Çevrimdışı yazma kuyruğu.** IndexedDB kuyruğu, istemci üretimli kayıt kimliği (sunucuda tekil), fotoğraf ayrı kuyruk, eşzamanlama göstergesi («beklemede / gönderildi / hata»), tekrar gönderimde tek kayıt.
*Kabul:* e2e'de tarayıcı çevrimdışıyken kayıt + fotoğraf eklenir, bağlantı gelince **tam 1 kayıt ve fotoğraf(lar)** oluşur (kopya yok); fotoğraf yüklemesi düşünce kayıt kaybolmaz ve «yeniden dene» kopya üretmez; zaman aşımı + yeniden deneme testi; kuyruk durumu ekranda görünür; yenilemeden sonra da korunur.

**Dilim 3 — Hasat kaydı (yapılandırılmış).** Karara göre alanlar: tarih, birim (vana/bölge/bahçe geneli), miktar (kg ve/veya kasa + kasa ağırlığı), kalite sınıfı, isteğe bağlı fiyat ve alıcı; tür bazlı doğrulama; düzenleme/silme; Geçmiş yıl satırında kg/da; Günlük listesinde hasat görünümü.
*Kabul:* aralık ve birim doğrulaması birim testli (geçersiz kayıt 422); Geçmiş'te hasat yalnız kayıttan gelir, kayıt yoksa «kayıt yok» (uydurma yok); fiyat/alıcı yalnız sahibine görünür ve dışa aktarımda açıkça seçilir; migration + geri alma; e2e + axe + 390 px ekranı.

**Dilim 4 — Hasat → vana/bölge karşılaştırması ve veri paketi.** Kg/da hesabı (alan çokgenden), vana/bölge bazlı verim görünümü, yaz canlılığı ile yan yana karşılaştırma; 11B için «kalibrasyon veri yeterliliği» göstergesi (kaç sezon, kaç birim). **Tahmin üretilmez.**
*Kabul:* yeterli veri yoksa görünüm kapalı ve nedeni yazılı (ilke: yok/bayat ayrı); sayılar kaynak ve tarihle; ilkeler tablosu 1–11; hasat 0 olan jlnnlk'te dürüst boş durum.

**Dilim 5 — Dışa aktarma.** Günlük kayıtları için CSV (UTF-8 BOM, Türkçe Excel ayracı) ve konumlu GeoJSON; fotoğraf bağlantıları; seçili tarih aralığı ve tür.
*Kabul:* dışa aktarılan satır sayısı ekrandaki süzgeçle eşit (test); alıcı/fiyat varsayılan DIŞARIDA, kullanıcı seçerse içeride; dosyalar Excel'de Türkçe karakterle açılır (örnek doğrulama); başkasının bahçesi 404.

## 6. Onayınızı bekleyen kararlar
1. **Hasat birimi:** vana (`irrigation_sectors`; dev'de 0, kullanıcı çizer), otomatik çok yıllı bölge ya da bahçe geneli? (Öneri: bahçe geneli zorunlu, vana/bölge isteğe bağlı.)
2. **Miktar:** kg mı, kasa mı, ikisi birden? Kasa ağırlığı sabit mi, kullanıcı mı girer?
3. **Kalite sınıfı sözlüğü** (ürün bazlı: limon, portakal, mandalina, greyfurt): ziraat mühendisi girdisi gerekli.
4. **Fiyat ve alıcı** toplansın mı? (Ticari hassasiyet; öneri: isteğe bağlı, dışa aktarmada varsayılan kapalı.)
5. **Gözlem etiket seti** ve fenoloji gözleminin fenoloji motoruna girdi olup olmayacağı (öneri: bu adımda yalnız kayıt; motor bağı sonra).
6. **Çevrimdışı kapsamı:** yalnız kayıt kuyruğu mu, tam PWA (kurulabilir uygulama, önbellekli harita karoları) mı? (Öneri: yalnız kuyruk; PWA ayrı karar.)
7. **Dışa aktarma biçimleri** (CSV + GeoJSON yeterli mi, PDF sezon özeti 16'ya mı bırakılsın?).
