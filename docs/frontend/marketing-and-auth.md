# Kurumsal site (marketing) ve giriş

Phase 1 B planlama modülüne ek olarak, kamuya açık tanıtım sitesi ve planlama erişimi için **frontend-only** kimlik akışı eklendi.

## Routing (`bahcelab-frontend/src/App.tsx`)

| Path | Sayfa | Auth |
|------|--------|------|
| `/` | `LandingPage` | Hayır |
| `/blog` | `BlogPage` (CMS öncesi placeholder) | Hayır |
| `/login` | `LoginPage` | Hayır |
| `/register` | `RegisterPage` | Hayır |
| `/planning` | `PlanningListPage` | **Evet** (`ProtectedRoute`) |
| `/planning/:planId` | `PlanningWorkspacePage` | **Evet** |
| `*` | `/` yönlendirme | — |

Giriş yapılmadan `/planning` isteği → `/login` (state: `from` geri dönüş yolu).

## Marketing feature (`src/features/marketing/`)

| Alan | Açıklama |
|------|----------|
| **Hero** | Tam ekran sabit görsel, wordmark, başlık/alt metin, scroll cue |
| **Şerit bölümler** | `DiagonalStripSection` — çapraz üst kenar, tonlar (cream/sage/paper/forest), dar alan glyph |
| **Misyon** | Problem odaklı metin + `MissionOutcomeCards` (3 kart, örnek önce/hedef çubukları) |
| **Footer** | `MarketingFooter` — copyright, blog linki, yayvan watermark wordmark |
| **Navbar** | `MarketingNavbar` — misyon anchor, blog, giriş/kayıt linkleri |

### Tasarım notları

- Fontlar: **Inter** (gövde), **Plus Jakarta Sans** (başlıklar) — `index.html` Google Fonts.
- Krem yüzey token: `--color-marketing-cream` (`#f7f4ee`) → `bg-marketing-cream`.
- Şerit bindirme: `index.css` — `--marketing-strip-slant`, `marketing-strip-overlap` (clip-path + negatif margin).
- Ana içerik paneli: ilk şeritte `rounded-t` + gölge; `main` üzerinde `overflow-x-clip` (çapraz şeritler kesilmez).

### Varlıklar (`src/assets/marketing/`)

- `bahcelab-logo.png` — navbar/hero wordmark (şeffaf)
- `bahcelab-logo-wordmark.png`, `bahcelab-footer-wordmark.png` — footer watermark
- `hero-orchard-drones.jpg` — hero ve auth sol panel

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
features/marketing/components/
  BahcelabBrandLogo.tsx
  MarketingNavbar.tsx
  MarketingFooter.tsx
  DiagonalStripSection.tsx
  MissionOutcomeCards.tsx
  HeroScrollCue.tsx
  Reveal.tsx
  StripNarrowGlyph.tsx
```
