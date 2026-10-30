# BahçeLab · Görselleştirme ilkeleri (1–11)

> **Durum:** onaylı (UX denetimi sonrası, 2026-10-29). Her ekranın ve grafiğin kontrol listesi; roadmap'teki «görselleştirme ilkeleri 1–11» bu belgedir.
> Gerekçeler ve ekran bulguları: [`ux-denetimi.md`](ux-denetimi.md). Uygulama yönleri: [`gorsel-dil-v2/`](gorsel-dil-v2/README.md).

Her ilkenin sonunda **«Kontrol»** satırı vardır: bir ekran/grafik incelemesinde cevabı evet-hayır olan soru.

1. **Her ekran tek soruya cevap verir; başlık cevap cümlesidir.**
   «Su», «Analiz» gibi etiket başlık değildir; «Kök bölgesi nemli; önümüzdeki 7 gün sulama gerekmiyor» başlıktır.
   *Kontrol:* Ekranın sorusunu tek cümleyle yazabiliyor muyum ve başlık o cümlenin cevabı mı?

2. **Önce karar + tek sayı, sonra tek kanıt grafiği, sonra ayrıntı (akordeon).**
   Sıra değişmez: karar cümlesi → tek büyük sayı → kanıt → ayrıntı. Ayrıntı varsayılan kapalıdır.
   *Kontrol:* Kıvrım üstünde (1440×900 ve 390×844) karar ve sayı görünüyor mu?

3. **Referans bahçenin kendi geçmişidir: «normal bant» tek tanım, her yerde aynı görünüm.**
   Normal bant (p25–p75 koyu, p10–p90 açık, ortanca çizgi) tek bileşen, tek renk; tüm zaman grafiklerinde aynı motif.
   *Kontrol:* Bant, katalogdaki tek kuraldan (`normal_bant`) mı geliyor ve her grafikte aynı mı görünüyor?

4. **Dürüst ölçek.**
   Mutlak skala varsayılandır. Gerilmiş skala etiketlidir («gerilmiş skala · 0,56 °C aralık») ve fiziksel gürültü eşiğinin (katalog, ön değer) altında kapalıdır. Eşik çizgileri (don 0 °C, normal bant, sulama eşiği) metinde değil grafiktedir.
   *Kontrol:* Haritadaki renk farkı fiziksel farkla orantılı mı? Eşik grafikte çizili mi?

5. **Renk yalnız veride ve anlamı sabittir.**
   Bitki = yeşil · su = mavi · sıcaklık = sarı→kahve · uyarı = amber + simge · sorun = kırmızı + simge. **Bir renk iki anlam taşımaz** (turuncu hem uyarı hem sıcaklık olamaz). Arayüz kromu nötrdür.
   *Kontrol:* Bu renk bu sayfada başka bir şey de anlatıyor mu?

6. **Renk tek başına anlam taşımaz.**
   Desen, simge veya etiket eşlik eder (kademe: simge + ad; ilaçlama: desen; bölge: tarama).
   *Kontrol:* Ekranı gri tonlamaya çevirince anlam korunuyor mu?

7. **Belirsizlik görünür.**
   Gözlem dolu, tahmin taralı/soluk; veri yaşı rozeti; güven belirtilir («ön değer · mühendis onayı bekliyor» sayfa başına tek rozet).
   *Kontrol:* Gözlem ile tahmin birbirinden ayrılıyor mu ve verinin yaşı yazıyor mu?

8. **«Yok», «bayat» ve «hata» ayrı şeylerdir; her birinde neden + ne zaman gelir.**
   Yok: «Henüz çekilmedi, ilk görüntü ~2 gün içinde». Bayat: «Son veri 9 gün önce». Hata: «Sunucudan yanıt alınamadı» (ağ hatasından ayrı mesaj) + tekrar dene. **Hata asla boş durum olarak çizilmez.**
   *Kontrol:* Üç durum görsel ve metin olarak ayrı mı?

9. **Doğrudan etiketleme; lejant paragrafı yok; jargon «?» arkasında; 12 px taban, yarım piksel yok.**
   Seriyi çizginin yanına yaz. Açıklama bir cümleyi geçmez; uzun açıklama «?»/«Nasıl hesaplandı?» arkasındadır. SVG metni dahil hiçbir yazı 12 px altında değildir.
   *Kontrol:* Lejant olmadan grafik okunuyor mu? En küçük yazı ≥ 12 px mi?

10. **Harita ve grafik bağlıdır.**
    Sayfada ortak zaman ekseni, senkron imleç; sekme haritayı da değiştirir (Su → yaprak suyu katmanı; Hava → katman yok/hava).
    *Kontrol:* Grafikte gezinince harita o tarihe gidiyor mu? Sekme değişince harita anlamlı biçimde değişiyor mu?

11. **Bir grafik, bir mesaj: çift eksen yok, süs yok; katman değişimi ≤ 150 ms.**
    İki ölçek gerekiyorsa iki panel, aynı zaman ekseni. Her grafiğin başlığı mesajını söyler.
    *Kontrol:* Grafiğin mesajı tek cümle mi? İkinci bir y ekseni var mı? (`e2e/performans.spec.ts`: katman değişimi medyan ≤ 150 ms.)

## Uygulama notları
- Eşikler ve kurallar katalogdadır (`katalog.yaml`), sürümlü, «ön değer · mühendis onayı bekliyor»; ilke 4'ün gerilme eşikleri `gorsel.gerilme_min_aralik`.
- Bu belge kural kataloğu değil **tasarım kontrol listesi**dir; sayısal eşik içermez.
- Her adım (9H dahil) kapanışında bu 11 madde ekran bazında işaretlenir.
