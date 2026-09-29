# Kurumsal site (marketing) ve giriş

Phase 1 B planlama modülüne ek olarak, kamuya açık tanıtım sitesi ve planlama erişimi için **frontend-only** kimlik akışı eklendi.

## Routing (`bahcelab-frontend/src/App.tsx`)

| Path | Sayfa | Auth |
|------|--------|------|
| `/` | `LandingPage` | Hayır |
| `/blog` | `BlogPage` — yazı listesi | Hayır |
| `/blog/:slug` | `BlogPostPage` — markdown yazı | Hayır |
| `/login` | `LoginPage` | Hayır |
| `/register` | `RegisterPage` | Hayır |
| `/planning` | `PlanningListPage` | **Evet** (`ProtectedRoute`) |
| `/planning/:planId` | `PlanningWorkspacePage` | **Evet** |
| `*` | `/` yönlendirme | — |

Giriş yapılmadan `/planning` isteği → `/login` (state: `from` geri dönüş yolu).

## Marketing feature (`src/features/marketing/`)

| Alan | Açıklama |
|------|----------|
| **Hero** | Kaydırmalı **Journey** (bahceLabs referansı) — drone kare dizisi, kuşbakışı bahçe, tarama ve özellik durakları; navbar ve alt şeritler aynı |
| **Şerit bölümler** | `DiagonalStripSection` — çapraz üst kenar, tonlar (cream/sage/paper/forest), dar alan glyph |
| **Misyon** | Problem odaklı metin + `MissionOutcomeCards` (3 kart, örnek önce/hedef çubukları) |
| **Footer** | `MarketingFooter` — copyright, blog linki, yayvan watermark wordmark |
| **Navbar** | `MarketingNavbar` — misyon anchor, blog, giriş/kayıt linkleri |

### Tasarım notları

- Fontlar: **Inter** (gövde), **Plus Jakarta Sans** (başlıklar) — `index.html` Google Fonts.
- Journey hero ek fontlar: **Manrope** (UI), **Fraunces** (hero başlık) — yalnızca `.bahce-journey` altında (`journey.css`).
- Krem yüzey token: `--color-marketing-cream` (`#f7f4ee`) → `bg-marketing-cream`.
- Şerit bindirme: `index.css` — `--marketing-strip-slant`, `marketing-strip-overlap` (clip-path + negatif margin).
- Ana içerik paneli: animasyon bittikten sonra misyon şeridi hero üzerine kayar (`main` `z-20`, `-mt-[100dvh]`); ilk şeritte `rounded-t` + gölge; `main` üzerinde `overflow-x-clip`.
- Landing sayfa arka planı (hero sonrası boşluklar): `#0e1a12` (journey `--night` ile uyumlu).

### Journey hero (`src/features/marketing/journey/`)

Kaynak: [hhalilikurnaz/bahceLabs](https://github.com/hhalilikurnaz/bahceLabs) `Journey` bileşeni; Next.js / next-intl yerine Vite + React Router + sabit Türkçe metinler (`journeyMessages.ts`).

| Dosya | Rol |
|-------|-----|
| `JourneyHero.tsx` | Uzun sticky bölüm, scroll → `frameAt()` zaman çizelgesi, UI/metin katmanları |
| `FrameSequence.tsx` | WebP kare dizisini canvas’a çizer (kaydırmaya bağlı video) |
| `journeyTimeline.ts` | Kamera durakları, ağaç koordinatları, `TOTAL_LEN` |
| `journeySite.ts` | Medya yolları (`public/media/…`) |
| `journeyMessages.ts` | Hero metinleri, özellik adımları, journey kartları |
| `journey.css` | Journey’ye özel stiller (`.bahce-journey` kapsamı) |

**Scroll akışı**

1. Sayfa üstünde kaydırma ilerledikçe drone kareleri → kuşbakışı fotoğraf → tarama → ağaç durakları.
2. `s >= PIN_AT` iken sahne `position: fixed` (`journey-sticky--pinned`, `z-index: 5`); son kare donar, metin/kartlar ve `j-shade` gizlenir.
3. Bölüm sonunda `main` (misyon) son **100dvh** hero üzerine biner; eski sabit hero + spacer davranışı.

**Boşta önizleme (scroll öncesi)**

- `FrameSequence` `idle={0.22}`: ilk ~%22 karede ileri–geri döngü (~7 sn tur).
- Idle aralığındaki kareler öncelikli yüklenir; sabit hızlı ping-pong (cosine yavaşlatması kullanılmaz).
- İlk kare: poster + `journey-stage` `background-image` (canvas hazır olana kadar boş ekran önlenir).

**Hero metinleri**

- Başlık: *«Üretim verimini yükseltmek, bitkiyi anlamaktan geçer.»*
- CTA: Kayıt ol → `/register`; ikincil → `#misyon`

**Medya** (`bahcelab-frontend/public/media/`)

- `hero-frames/desktop/` — 120 × webp (1280 px genişlik)
- `hero-frames/mobile/` — 80 × webp (768 px)
- `orchard/master-3344.webp`, `master-1920.webp` — kuşbakışı ana fotoğraf

Kare üretimi için referans repo: `scripts/extract-frames.sh`, `docs/VIDEO.md`.

**Kullanılmayan (eski hero)**

- `HeroScrollCue.tsx` — artık landing’de import edilmez; journey kendi scroll hint’ini kullanır.
- `hero-orchard-drones.jpg` — yalnızca `AuthShell` sol panelinde.

### Varlıklar (`src/assets/marketing/`)

- `bahcelab-logo.png` — navbar wordmark (şeffaf)
- `bahcelab-logo-wordmark.png`, `bahcelab-footer-wordmark.png` — footer watermark
- `hero-orchard-drones.jpg` — auth sol panel (landing hero artık journey medyası)

## Auth feature (`src/features/auth/`)

| Dosya | Rol |
|-------|-----|
| `AuthContext.tsx` | Oturum, `login` / `register` / `logout` |
| `authStorage.ts` | `localStorage` — kullanıcı listesi + oturum |
| `AuthShell.tsx` | Sol panel (görsel + metin) / sağ form düzeni |
| `ProtectedRoute.tsx` | Planlama rotaları koruması |
| `LoginPage.tsx`, `RegisterPage.tsx` | Formlar |

### Önemli sınırlama

Kimlik doğrulama **henüz backend’e bağlı değil**. Kayıt bilgileri yalnızca tarayıcıda saklanır (geliştirme / erken erişim). Phase 1 A gerçek auth entegrasyonu geldiğinde `AuthContext` ve API client güncellenecek.

## Marka ve site meta

- Sekme başlığı: **BahçeLab | Tarımda Akıllı Üretim** (`index.html`).
- Favicon: `public/favicon.png` (yuvarlatılmış köşeli wordmark görseli).
- Planlama giriş ve workspace navbar: `BahcelabBrandLogo` (ana sayfa ile aynı PNG).

## İlgili bileşenler

```
features/marketing/
  journey/
    JourneyHero.tsx
    FrameSequence.tsx
    journeyTimeline.ts
    journeySite.ts
    journeyMessages.ts
    journey.css
  components/
    BahcelabBrandLogo.tsx
    MarketingNavbar.tsx
    MarketingFooter.tsx
    DiagonalStripSection.tsx
    MissionOutcomeCards.tsx
    HeroScrollCue.tsx      # eski hero; journey’de kullanılmıyor
    Reveal.tsx
    StripNarrowGlyph.tsx
  pages/
    LandingPage.tsx        # JourneyHero + misyon şeritleri
```
