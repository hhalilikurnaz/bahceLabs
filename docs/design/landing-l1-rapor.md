# L1 · Landing P0/P1 düzeltmeleri · rapor

> Dal: `feature/landing-l1`, güncel `dev` üzerine alındı ve birleştirildi. Uygulama kodu (`features/bahcem`) değişmedi.
> **Sonradan durum (L1 kapanışı):** landing tasarım işi durduruldu, görünüm L2'de (roadmap) baştan yapılacak. `jlnnlk` ekran görüntüleri, ürün ekranı bölümleri ve çekim betiği **kaldırıldı** (sahibi bilinmeyen gerçek arazi); aşağıdaki 5. maddeyle ilgili satırlar tarihsel kayıttır. Migration 048'e taşındı, KVKK taslak bayrağı eklendi, «Şifremi unuttum» roadmap Adım 18'e yazıldı.
> Kaynak: [landing-inceleme.md](landing-inceleme.md). Öncesi/sonrası ekranlar: [landing-l1/](landing-l1/) (`once-*`, `sonra-*`; ürün ekranı içerenler kaldırıldı).

## Sonuç

11 maddenin 10'u tamam. Madde 10'un «Şifremi unuttum» akışı yapılmadı (e-posta altyapısı yok). Madde 5'te sulama simülatörü yerine Su ekranı kullanıldı. Lighthouse mobil LCP hedefi, gerçek gecikme uygulanan ölçümde tutuyor, Lighthouse'un varsayılan benzetiminde tutmuyor (aşağıda).

| # | Madde | Durum |
|---|---|---|
| 1 | CTA, bekleme listesi | Tamam. «Kayıtlar çok yakında» hiçbir yerde yok (test bekçisi var). Kayıt açıksa «Erken erişime katıl» → `/register`, kapalıysa aynı adres bekleme formu: e-posta, il, ürün, KVKK bağlantısı, işaretsiz açık rıza. DB tablosu, e-posta benzersiz, hız sınırı, 11 backend testi. |
| 2 | Tek logo | Tamam. `BrandLogo` (yaprak işaretiyle aynı çizim, «BahçeLab» gerçek metin), navbar kontrastı ≈ 15:1, footer filigranı ve favicon dahil. U-17 kapandı. |
| 3 | Navbar | Tamam. Nasıl çalışır · Özellikler · Blog · Giriş yap · CTA. Sosyal ikonlar footer'da. 390 px'te CTA tek satır, menü açılır liste. |
| 4 | Kanıt şeridi | Tamam. Kurucu hikâyesi + Sentinel-2, Landsat, ERA5-Land, SoilGrids (kurum ve kullanım). Sayı, logo, alıntı yok. |
| 5 | Gerçek ürün ekranları | **Geri alındı** (L1 kapanışı): görüntüler ve bölümleri kaldırıldı, yenisi eklenmedi. |
| 6 | Manifesto | Tamam. Dört soyut bölüm yerine Nasıl çalışır (3 adım) + Dürüstlük. «Önce/Hedef» çubukları kalktı. |
| 7 | Journey | Tamam. 3 durak, ≈ 5 ekran (eski ≈ 10). Hero kare dizisi (120 WebP, 14,6 MB) kodda hiç kullanılmıyordu, silindi. Görsel bütçesi aşağıda. |
| 8 | Erişilebilirlik | Tamam. `Reveal as="li"`, eyebrow 12 px, landing e2e axe: 0 ciddi/kritik (masaüstü, mobil, azaltılmış hareket). |
| 9 | Token | Tamam. Landing, blog ve auth'ta ham hex 0, `mk-*` token seti, `buttonClass` tek kaynak, köşe `rounded-md/mk/sheet`. Vitest bekçisi tanıtım dosyalarını da tarar. |
| 10 | Giriş/kayıt | Kısmen. Sol panel metni sentence-case ve ünlemsiz, «planlarınıza ulaşın» kalktı, şifre kuralı tek sabit. «Şifremi unuttum» yok. |
| 11 | Ekranlar, Lighthouse, rapor | Bu belge. |

## Lighthouse (mobil, yerel production derlemesi, gzip, 3 koşu medyanı)

| | Eski (dev) | Yeni | Hedef |
|---|---|---|---|
| **Uygulanan kısıtlama** (gerçek gecikme): LCP | 2,01 sn | **1,57 sn** | < 2,5 sn ✓ |
| aynı: CLS | 0,188 | **0,011** | < 0,1 ✓ |
| aynı: performans / TBT | 87 / 0 ms | 99 / 12 ms | |
| **Varsayılan benzetim** (Lantern): LCP | 8,18 sn | 3,90 sn | < 2,5 sn ✗ |
| aynı: FCP | 2,85 sn | 2,55 sn | |
| aynı: CLS | 0,035 | 0,010 | ✓ |
| aynı: performans | 70 | 84 | |
| Erişilebilirlik skoru | 92 | 100 | |
| Toplam aktarım | 2,3 MB | 0,46 MB | |

**Hedefin kaçırıldığı ölçüm ve neden.** Varsayılan Lighthouse benzetimi yerel sunucuda, ilk boyama anında bitmiş olan tüm istekleri (JS paketi dahil) ilk boyamanın bağımlılığı sayıyor. Yerelde istekler milisaniyede bittiği için `index.html`'deki statik ilk karenin JS'ten önce boyandığını göremiyor. Yazı tipini `optional` yapmak sonucu değiştirmedi (deneyle doğrulandı), yani sorun yazı tipi değil. Gerçek gecikme uygulanınca (devtools) LCP 1,57 sn. Canlıda (Vercel, sıkıştırma, CDN) aynı ölçüm tekrarlanmalı; o zaman benzetim değeri de değişir. Daha ileri adım: stil dosyasını render-blocking olmaktan çıkarmak ya da ana sayfayı derleme anında ön-işlemek (prerender).

LCP öğesi: `index.html` içinde `#boot` statik ilk kare (`<img fetchpriority=high>` + başlık), yalnız `/` için, JS paketinden bağımsız. React hero görseli çözümleyince kabuğu kaldırır; kabuk `aria-hidden` (çift içerik yok), metinleri `tests/journey.test.ts` ile `journeyMessages.ts`'e bağlı.

### Görsel bütçesi

| | Bütçe | Sonuç |
|---|---|---|
| Hero masaüstü | ≤ 1,5 MB | 366 KB |
| Hero mobil | ≤ 800 KB | 128 KB |
| Ürün ekranları (7 WebP, tembel) | | 276 KB toplam |
| Kare sayısı | ≤ 40 | 0 (dizi hiç kullanılmıyordu) |

`prefers-reduced-motion`: kaydırmalı sahne yok, statik tek görsel (e2e doğrular).

## Sizin karar vermeniz gerekenler

1. **KVKK metni taslaktır.** Yalnız sistemin yaptığı işlemleri anlatır (e-posta, il, ürün, rıza zamanı; IP yok; üçüncü kişiye aktarım yok). Veri sorumlusunun unvanı ve başvuru e-postası kodda yok: `VITE_KVKK_VERI_SORUMLUSU` ve `VITE_KVKK_ILETISIM_EPOSTA` ile verilir; boşsa metin sosyal kanalları gösterir. Hukuki onay gerekir. Aynı şekilde «aktarım yok» ve saklama süresi cümleleri sizin taahhüdünüzdür.
2. **«Şifremi unuttum» yapılmadı.** E-posta gönderim altyapısı (SMTP/Resend/SES) yok; sahte bağlantı koymadım. Sağlayıcı seçilince: sıfırlama belirteci tablosu, iki uç nokta, e-posta şablonu, hız sınırı, sayfa.
3. **Hero sahnesi anlatımdır** (bölge boyaması, damla hatları). «Temsili veri yok» kuralıyla gerilim var: sayı, kimlik, ölçüm değeri çıkarıldı, sahnede «Bu sahne anlatım içindir. Gerçek uygulama ekranları aşağıda.» notu duruyor. Bunu da kaldırmak isterseniz sahne yalnız fotoğraf + tarama çizgisine iner.
4. **Migration** (çözüldü): `dev` bu arada `047_sebep_etiket` ekledi; bekleme listesi `048_bekleme_listesi` oldu. CI'a «alembic heads tek olmalı» adımı ve `tests/test_alembic_heads.py` eklendi.
5. **Hız sınırı süreç içidir** (çok işçili dağıtımda işçi başına). Ters vekil arkasında `BEKLEME_VEKIL_GUVEN=true` gerekir, yoksa herkes tek adres sayılır.
6. **Liste yalnız SQL ile okunur** (yönetim ekranı yok): `SELECT … FROM bekleme_listesi`.

## Uygulamada gördüklerim (dokunmadım)

- Durum paneli `jlnnlk` için aynı anda «Normal» ve «Veri yetersiz, durum için yeterli veri yok» diyor; son optik görüntü 39 gün eski. 
- Analiz panelinin dipnotunda «Adım 11» iç yol haritası metni var; kırpmanın dışında bıraktım.
- Durum panelinde «Önümüzdeki 3 gece» (don) kartı var; kırpmanın dışında (don vaadi yok).

## Doğrulama

- Backend: ruff, mypy temiz; `test_bekleme_listesi.py` 11 test, auth testleri geçti.
- Frontend: tsc, oxlint temiz; vitest 45 dosya / 323 test.
- e2e (yerelde, ayrı veritabanı ve portlar): landing 17, bekleme listesi 5, giriş/boş durum, erişilebilirlik, rotalar: 37/37.
- CI ve Tam paket (tüm backend + tüm Playwright): bu dalda çalıştırıldı, sonuç commit durumunda.

## Yeniden üretmek

```bash
node scripts/landing-onizleme.mjs <etiket>      # 1440/390 ekran görüntüleri (Vite açıkken)
node scripts/favicon-uret.mjs                   # favicon.svg → PNG
python3 scripts/landing-gorsel-optimize.py hero <kaynak.webp>
```
