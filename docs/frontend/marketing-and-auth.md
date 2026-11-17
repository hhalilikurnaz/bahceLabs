# Tanıtım sitesi (landing, blog, KVKK) ve giriş

Kamuya açık tanıtım sayfaları ve kimlik akışı. Kaynak: `bahcelab-frontend/src/features/marketing/` ve `src/features/auth/`. Bu belge L1 işinden (landing P0/P1 düzeltmeleri) sonraki durumu anlatır; gerekçeler için [docs/design/landing-inceleme.md](../design/landing-inceleme.md), ölçümler için [docs/design/landing-l1-rapor.md](../design/landing-l1-rapor.md).

## Rotalar (`src/App.tsx`)

| Yol | Sayfa | Giriş |
|---|---|---|
| `/` | `LandingPage` | Hayır |
| `/blog`, `/blog/:slug` | Blog | Hayır |
| `/kvkk` | `KvkkPage`: erken erişim listesi aydınlatma metni | Hayır |
| `/login` | `LoginPage` | Hayır |
| `/register` | Kayıt açıksa hesap formu, kapalıysa erken erişim (bekleme listesi) formu | Hayır |
| `/bahceler/*`, `/asistan`, … | Uygulama | Evet |

Kayıt bayrağı: `VITE_REGISTRATION_ENABLED` (arayüz) ve `REGISTRATION_ENABLED` (sunucu). Kapalıyken `/register` aynı adreste `BeklemeFormu` gösterir.

## Landing akışı

Görünüm **L2** işinde son arayüz turunda baştan tasarlanacak ([roadmap](../roadmap.md)); bu bölüm L1 sonrası geçici durumdur.

1. **Hero** (`journey/`): kaydırmalı sahne, giriş + 3 durak. CTA: «Erken erişime katıl» → `/register`, «Nasıl çalışır» → `#nasil-calisir`. Sahne anlatım içindir (sayı, kimlik ya da ölçüm değeri yok); sahnede bunu söyleyen not durur. `prefers-reduced-motion`: statik tek görsel.
2. **Kanıt şeridi** (`sections/KanitSeridi`): kurucu hikâyesi + kullanılan veri kaynakları adıyla. Sayı, logo ya da alıntı yok.
3. **Nasıl çalışır** (`id=nasil-calisir`): üç adım.
4. **Dürüstlük**: «Ön değerdir, karar üreticinindir.»
5. **Erken erişim çağrısı + footer** (`ErkenErisimSection`, `MarketingFooter`).

**Ürün ekranı görseli yok:** L1'de eklenen gerçek bahçe ekran görüntüleri (sahibi bilinmeyen arazi) kaldırıldı; yenisi eklenmedi. Yeni görsel yalnız sahibi belli ve onaylı bir bahçeden ya da demo bahçeden gelmelidir.

Üst çubuk: Nasıl çalışır · Blog · Giriş yap · [Erken erişime katıl]. 390 px'te CTA tek satır, menü `md` altında açılır liste (`aria-expanded`, Escape kapatır). Sosyal bağlantılar yalnız footer'da. Sayfa içi bağlantılar (`/#nasil-calisir`) `ScrollToTopOnNavigate` ile kaydırılır.

## Medya

| Dosya | Boyut | Üretim |
|---|---|---|
| `public/media/hero/hero-1920.webp`, `hero-1000.webp` | ≈366 KB, ≈128 KB | `scripts/landing-gorsel-optimize.py hero <kaynak>` |

`index.html` içindeki statik ilk kare (`#boot`) yalnız `/` için hero fotoğrafını ve başlığı JS'ten bağımsız basar; React hero görseli çözümleyince kabuğu kaldırır. `tests/journey.test.ts` bütçeyi (masaüstü ≤ 1,5 MB, mobil ≤ 800 KB) ve kabuk metinlerinin `journeyMessages.ts` ile aynı kaldığını denetler. Hero kare dizisi (120 WebP, 14,6 MB) kodda hiç kullanılmadığı için silindi.

## Tasarım dili

Renkler `styles/tokens.css` içindeki `mk-*` setinden (`@theme static`); ham hex yok, `tests/tokens.test.ts` tanıtım ve giriş dosyalarını da denetler. Köşe: düğme ve alan `rounded-md` (6 px), kart/pencere `rounded-mk`, hero üstüne kayan içerik `rounded-t-sheet`. Düğme görünümü tek kaynaktan: `components/ui/buttonClass.ts` (`<Button>` ve `<Link>` aynı sınıfları kullanır). Tek logo: `components/ui/BrandLogo` (uygulama üst çubuğundaki yaprak işaretiyle aynı çizim); `public/favicon.svg` aynı çizimdir (`scripts/favicon-uret.mjs` PNG'leri üretir).

Yazı tipleri: Fraunces (başlık), Source Sans 3 (metin); self-host (`styles/fonts.css`). Yazı en az 12 px.

## Erken erişim (bekleme listesi)

`POST /bekleme-listesi` (genel uç nokta): e-posta, il, ürün (limon, portakal, mandalina, diğer), açık rıza. Tablo `bekleme_listesi` (migration 048): e-posta benzersiz, rıza zamanı ve aydınlatma sürümü saklanır, IP saklanmaz. Yeni ve yinelenen e-posta aynı yanıtı alır (liste dışarıdan yoklanamaz). Hız sınırı süreç içi kayan penceredir (varsayılan 10 dakikada 5; `BEKLEME_LIMIT_*`); çok işçili dağıtımda sınır işçi sayısıyla çarpılır. Ters vekil arkasında `BEKLEME_VEKIL_GUVEN=true`. Aydınlatma metni sürümü iki yerde aynı tutulur: `src/features/auth/bekleme.ts` ve `domain/bekleme/schemas.py` (`tests/bekleme.test.ts` denetler).

**KVKK taslak bayrağı:** aydınlatma metni hukuki onay beklerken (`VITE_KVKK_TASLAK` ≠ `false`, sunucuda `KVKK_TASLAK=true`) bekleme listesi **canlıda kapalıdır**: canlı derlemede `/register` «başvurular şu an alınmıyor» gösterir, sunucu `POST /bekleme-listesi` isteğini `API_DEBUG=false` iken 403 ile reddeder (veri yazılmaz). Geliştirme sunucusunda ve `API_DEBUG=true` iken form çalışır. `/kvkk` sayfası bayrak açıkken «Taslak, hukuki onay bekliyor» uyarısı gösterir. Onaydan sonra iki bayrak `false` yapılır (`bahcelab-backend/.env`, `bahcelab-frontend/.env`).

Liste şu an yalnız veritabanından okunur (yönetim ekranı yok):

```sql
SELECT email, il, urun, created_at FROM bekleme_listesi ORDER BY created_at;
```

## Kimlik doğrulama

Gerçek backend auth'a bağlı (`/auth/*`, argon2 + JWT). Token'lar httpOnly çerezdir, frontend token saklamaz. Şifre kuralı tek sabitten: `MIN_PASSWORD_LENGTH` (`authConfig.ts`); sunucudaki `MIN_PASSWORD_LENGTH` ile eşitliği `tests/bekleme.test.ts` denetler. «Şifremi unuttum» akışı yoktur: e-posta gönderim altyapısı kurulu değil; roadmap Adım 18'de.

## Testler

- `tests/journey.test.ts`, `tests/bekleme.test.ts`, `tests/tokens.test.ts` (vitest)
- `e2e/landing.spec.ts`: axe (0 ciddi/kritik; masaüstü, mobil, azaltılmış hareket), CTA, gezinme, LCP görseli, KVKK taslak uyarısı
- `e2e/bekleme-listesi.spec.ts`: ikinci web derlemesinde (`VITE_REGISTRATION_ENABLED=false`, `E2E_WEB_PORT+1`) form, rıza, yinelenen e-posta, hız sınırı
- Backend: `tests/test_bekleme_listesi.py`, `tests/test_alembic_heads.py` (tek alembic başı)
