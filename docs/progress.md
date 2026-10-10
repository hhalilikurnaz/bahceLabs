# Phase 1 B — İlerleme & Backlog

> Günlük güncellenir. Agent'lar ve ekip için canlı durum takibi.

**Branch (aktif):** `main` (marketing + auth `main`’e merge edildi)  
**Feature branch:** `feature/phase-1-b-planning-simulation` (planlama geçmişi)  
**Başlangıç:** 2026-09-08

---

## Güncel Durum Özeti

| Metrik | Değer |
|--------|-------|
| Aktif aşama | **B1 tamamlandı → B2 sırada** |
| Tamamlanan aşamalar | B0 ✅, workspace UI (Faz 1–3) ✅, B1 ✅ |
| Sonraki aşama | **B2 — Arazi tanımı (MapLibre + polygon)** |
| Backend durumu | **BE0 çalışır** — Docker + migrate + real API (`8001`) |
| Frontend API | Real mod varsayılan — Vite `/api` → backend |
| Planlama giriş sayfası | `/planning` — Planlama Merkezi (giriş gerekli) |
| Kurumsal site | `/` landing, `/blog` placeholder — `docs/frontend/marketing-and-auth.md` |
| Auth | Gerçek: `/auth/*` (argon2 + JWT httpOnly cookie), `/login`, `/register`, `/bahcem` — bkz. `docs/PLAN-FAZ1.md` Adım 2 ✅ |
| Referans UI (workspace) | Layout shell hazır — `docs/reference-design.md` |

### Nerede kaldık?

```
/                  → Kurumsal landing (marketing) ✅
/blog              → Blog placeholder ✅
/login, /register  → Giriş / kayıt (gerçek backend auth) ✅
/bahcem            → Giriş sonrası: tam ekran uydu haritası, bahçe ekleme/düzenleme, Sentinel-2 NDVI izleme (Adım 3–5) ✅
/planning          → Planlama Merkezi (B1) ✅ — ProtectedRoute
/planning/:planId  → Workspace shell (B0) ✅ — harita/polygon henüz yok (B2)
Backend            → Plan CRUD + land endpoint hazır; BE4 planting engine sırada
```

**Bir sonraki iş:** B2 — MapLibre entegrasyonu, haritada polygon çizimi, `POST /planning/plans/{id}/land` bağlantısı. Paralel: Phase 1 A backend auth → `AuthContext` gerçek API.

---

## 2026-09-29 — Landing Journey hero (bahceLabs)

### Yapılanlar ✅

- [x] **Kaydırmalı hero** — bahceLabs `Journey` portu (`features/marketing/journey/`); drone kare dizisi + kuşbakışı bahçe hikâyesi
- [x] **Medya** — `public/media/hero-frames/`, `public/media/orchard/` (~17 MB)
- [x] **Navbar / şeritler** — yalnızca hero değişti; `MarketingNavbar`, `DiagonalStripSection`, footer aynı
- [x] **Misyon bindirmesi** — animasyon sonunda sabit sahne + `main -mt-[100dvh]` ile misyon hero üzerine kayar
- [x] **Metin** — hero başlığı eski slogan; CTA `/register` ve `#misyon`
- [x] **Idle önizleme** — scroll öncesi kısa drone döngüsü; öncelikli kare yükleme ve tempo ayarı (`FrameSequence`)
- [x] Dokümantasyon: [frontend/marketing-and-auth.md](./frontend/marketing-and-auth.md) (Journey bölümü)

### Notlar

- Referans klonu geliştirme için `.reference-bahceLabs/` (`.gitignore`’da); üretimde kullanılmaz.
- `HeroScrollCue` landing’den kaldırıldı; dosya repoda duruyor.

---

## 2026-09-28 — Kurumsal site + auth + marka

### Yapılanlar ✅

- [x] **Marketing landing** — hero, diagonal şeritler, misyon (problem + `MissionOutcomeCards`), footer watermark
- [x] **Routing** — `/` landing; `/blog`; planlama `/planning` altında
- [x] **Auth UI** — `/login`, `/register` (split layout: sol görsel, sağ form); `ProtectedRoute` planlama rotaları
- [x] **Navbar** — marketing’te giriş/kayıt; planlama shell’de çıkış + `BahcelabBrandLogo`
- [x] **Marka** — sekme başlığı, `favicon.png`, tüm navbar’larda `BahcelabBrandLogo`
- [x] **Tasarım token** — `--color-marketing-cream`; şerit clip/overlap CSS değişkenleri
- [x] Dokümantasyon: [frontend/marketing-and-auth.md](./frontend/marketing-and-auth.md)

### Bilinen sınırlamalar ⬜

- [x] Backend kullanıcı auth (JWT httpOnly cookie, refresh döndürme) — 2026-10-10
- [x] Blog — repo içi markdown (`src/content/blog/`, 6 yazı)
- [ ] Blog CMS / admin paneli (isteğe bağlı, ileride)
- [ ] Landing’den planlama CTA (ürün hazır olunca)

---

## 2026-09-08 — Gün 1 (Foundation)

### Yapılanlar ✅

- [x] **Faz 3 — Sağ Panel + Card Layout**
  - `PlanningCard` shared component: tutarlı border, radius, header/footer
  - `ProductCard`: dairesel limon görseli, çeşit/anaç, önerilen dikim, "Ürünü Değiştir"
  - `PlantingSummaryCard`: alan, mesafe, ağaç, sıra, tahmini verim
  - `MaintenanceSummaryCard`: sulama/sıklık/besleme/budama ikonları, "Detaylı Bakım Planı"
  - Sol sidebar: Planlama Adımları + Araçlar ayrı kartlara alındı
  - Orta alan: harita, KPI bar, gelişim simülasyonu ayrı kartlara sarıldı
  - Header: Bahçe Adı / Alan mini kartları
  - Stepper: card içinde merkezi navigasyon
  - `lemon-meyer.jpg` referans görselden çıkarıldı
- [x] **Faz 2 — Orta Alan pixel-perfect**
  - MapControls: 2D/3D, globe, recenter, zoom (lucide)
  - MapCompass: kuzey göstergesi
  - PlantingMapOverlay: kesikli sınır, ölçüler, spacing tooltip
  - SpatialCanvas: aerial terrain placeholder
  - MetricsBar: 5 KPI, divider, uppercase labels
  - GrowthSimulationTimeline: referans görseldeki 7 limon ağacı aşaması (0, 6, 12, 18, 24, 36, 48. Ay+) referanstan birebir korundu; 4x süper-çözünürlük, solid opak taç yapısı, micro-contrast unsharp masking ve `-webkit-optimize-contrast` ile kristal netliğine kavuşturuldu, bulanıklık ve yarı saydamlık tamamen giderildi
  - workspaceDemo.fixture genişletildi (planting + maintenance + map overlay)
- [x] **Faz 1 — Sol Sidebar pixel-perfect**
  - SidebarStepList: vertical stepper, check icon, alt menü
  - SidebarToolPalette: lucide ikonlar, aktif yeşil border
  - SidebarSaveButton: koyu outlined stil
  - activePlantingSubStep store state
  - Design tokens güncellendi (#4ade80 accent)
  - workspaceDemo.fixture.ts (görsel QA)
- [x] Repo audit tamamlandı (greenfield tespit edildi)
- [x] Phase 1 B implementasyon planı yazıldı (`docs/plan.md`)
- [x] Vite + React 19 + TypeScript scaffold kuruldu
- [x] Tailwind CSS v4 + planning design tokens tanımlandı
- [x] Zustand + TanStack Query + React Router entegre edildi
- [x] B domain TypeScript types oluşturuldu
- [x] Mock API adapter (`planningApi.mock.ts`) yazıldı
- [x] Planning workspace layout shell (referans görsele uygun)
- [x] Empty/no-data state'ler
- [x] Referans görsel + `docs/reference-design.md`
- [x] Route'lar: `/planning`, `/planning/:planId`
- [x] Feature branch oluşturuldu

---

## 2026-09-08 — Gün 1 (Monorepo + Real API + B1)

### Altyapı & Backend bağlantısı ✅

- [x] Monorepo yapısı: `bahcelab-frontend/` + `bahcelab-backend/` + kök `Makefile`
- [x] Backend BE0 çalışır hale getirildi (Docker PostGIS, Alembic migrate, uvicorn)
- [x] Port standardizasyonu: backend **8001**, Vite proxy `/api` → `8001`
- [x] Frontend real API katmanı: `planningApi.real.ts`, `apiClient.ts`, `planningApi.mapper.ts`
- [x] `.env.example` (frontend + backend), `vite-env.d.ts` güncellendi
- [x] README: kök dizinden `make` kullanımı, port 8001, hızlı başlangıç
- [x] Push → `dev` branch

### B1 — Planlama Merkezi (`/planning`) ✅

- [x] Giriş sayfası: modül rehberi + arazi kaynağı seçimi + devam eden planlar
- [x] **Yeni arazi tanımı** → `createPlan` → `/planning/:id` (workspace, `currentStep: land`)
- [x] **Kayıtlı bahçe ile devam** → bahçe listesi → `createPlan(name, gardenId)`
- [x] Garden API stub: `gardenApi.mock.ts`, `stubGardens.fixture.ts` (2 örnek bahçe)
- [x] Garden API real hazır: `GET /gardens` (BE1 gelene kadar backend'de yok)
- [x] `Garden` domain tipi eklendi
- [x] `planningApi.mock` — `createPlan(name, gardenId?)` + stub bahçeden `draftLand` doldurma
- [x] **Kaldığınız yerden devam** — yalnızca **real API** (`planningApiReal.listPlans()`)
- [x] BahçeLab marka: header’da logo (güncel: `BahcelabBrandLogo` — `bahcelab-logo.png`)

### B1 — UI bileşenleri

| Bileşen | Dosya | Açıklama |
|---------|-------|----------|
| Shell | `PlanningEntryShell.tsx` | Header, footer, navbar altı yayvan glow, `h-dvh` scroll yok |
| Rehber | `PlanningGuideIntro.tsx` | Glassmorphism kart, modül tanımı, 5 adım özeti |
| Yeni plan | `PlanningStartSection.tsx` | Yeni arazi / kayıtlı bahçe seçimi |
| Devam | `ContinuePlansSection.tsx` | Real API plan listesi |
| Bahçe listesi | `GardenListPanel.tsx` | Mevcut bahçe seçim ekranı |
| Marka | `BahcelabBrandLogo` (marketing) | Header / navbar logosu |

### UX kararları (bugün)

- Planlama giriş sayfası **dashboard değil, rehber** — 30+ kullanıcı, TÜBİTAK BIGG kalite hedefi
- Mock modda plan geçmişi gösterilmez; canlı API gerekir
- Alt iki kart eşit yükseklikte hizalanır; içerik opak, glow sadece background'da
- Sayfa tek ekrana sığar (`h-dvh`), bahçe listesi görünümünde iç scroll

### Kalan / Bilinen sınırlamalar ⬜

- [ ] Garden listesi gerçek API (BE1 / Phase 1 A) — şimdilik mock stub
- [ ] `createPlan(gardenId)` ile backend `draft_land` otomatik doldurma (BE1)
- [ ] B1 garden list real modda boş/404 — BE1 bekleniyor

---

## Backlog — Öncelik Sırası

### P0 — Kritik (B0–B4)

| # | Görev | Aşama | Durum | Not |
|---|-------|-------|-------|-----|
| 1 | Layout shell referans görsele uygun | B0 | ✅ | |
| 2 | Domain types + mock/real API | B0 | ✅ | |
| 3 | Build verify | B0 | ✅ | |
| 4 | Planlama giriş / arazi kaynağı seçimi | B1 | ✅ | `/planning` |
| 5 | Garden list stub + draft land akışı | B1 | ✅ | BE1 ile gerçek bağlantı bekliyor |
| 6 | Plan devam listesi (home) | B1/B9 | ✅ | Real API only |
| 7 | MapLibre 2D entegrasyonu | B2 | ⬜ | **Sıradaki** |
| 8 | Polygon draw + validation | B2 | ⬜ | |
| 9 | Ürün seçimi UI | B3 | ⬜ | |
| 10 | Dikim spacing input | B4 | ⬜ | |
| 11 | Planting grid calculation (backend) | B4 | ⬜ | BE4 |
| 12 | Planting points haritada | B4 | ⬜ | |

### P1 — Önemli (B5–B8)

| # | Görev | Aşama | Durum | Not |
|---|-------|-------|-------|-----|
| 13 | KPI bar gerçek veri | B5 | ⬜ | |
| 14 | Bakım planı formları | B6 | ⬜ | |
| 15 | Growth timeline interactive | B7 | ⬜ | |
| 16 | 2D visualization layers | B8 | ⬜ | |
| 17 | 3D stylized trees | B8 | ⬜ | |

### P2 — Tamamlama (B9–B10)

| # | Görev | Aşama | Durum | Not |
|---|-------|-------|-------|-----|
| 18 | Plan save/load (workspace) | B9 | 🔄 | PATCH hazır, UI save akışı eksik |
| 19 | Plan listesi (tam B9) | B9 | 🔄 | Home'da kısmi ✅ |
| 20 | Garden integration UI | B10 | ⬜ | |
| 21 | Responsive design | B10 | ⬜ | |
| 22 | Accessibility | B10 | ⬜ | |
| 23 | E2E tests | B10 | ⬜ | |

### Backend (paralel)

> Detaylı plan: [backend/plan.md](./backend/plan.md)

| # | Görev | Aşama | Durum | Not |
|---|-------|-------|-------|-----|
| BE0 | Foundation: scaffold, migration, plan CRUD | BE0 | ✅ | |
| BE1 | Garden read + draft_land populate | BE1 | ⬜ | B1 frontend stub hazır |
| BE2 | Geometry validation + area/perimeter | BE2 | ✅ | |
| BE3 | Product/Variety/Rootstock catalog | BE3 | ✅ | |
| BE4 | Planting calculation engine | BE4 | ⬜ | **En kritik backend** |
| BE5 | Planting summary / KPI | BE5 | ⬜ | |
| BE6 | Maintenance plan API | BE6 | ⬜ | |
| BE7 | Growth simulation API | BE7 | ⬜ | |
| BE8 | Visualization data | BE8 | ⬜ | |
| BE9 | Plan full CRUD | BE9 | 🔄 | List/create/get/patch/delete var |
| BE10 | Apply-to-garden endpoint | BE10 | ⬜ | |

---

## Blocker'lar

| Blocker | Etki | Çözüm |
|---------|------|-------|
| Garden API yok (BE1) | Real modda bahçe listesi boş | Mock modda stub; BE1 sonrası `GET /gardens` |
| MapLibre kurulmadı | Arazi polygon çizilemiyor | B2 |
| Phase 1 A bu repoda yok | Gerçek garden verisi yok | BE1 + A merge |
| BE4 planting engine yok | Grid hesabı yapılamaz | Backend öncelik |

---

## Kararlar Logu

| Tarih | Karar | Gerekçe |
|-------|-------|---------|
| 2026-09-08 | React + TypeScript + Vite | Sağlam, güvenli, rahat geliştirme |
| 2026-09-08 | Tailwind CSS v4 | Hızlı styling, design token desteği |
| 2026-09-08 | Monorepo `bahcelab-web` | Frontend + backend yan yana |
| 2026-09-08 | Backend port 8001 | macOS AirPlay 8000 çakışması |
| 2026-09-08 | `make` yalnızca repo kökünden | Alt klasörde Makefile yok |
| 2026-09-08 | `/planning` = modül rehberi, ayrı landing yok | B1 kapsamında yeterli (2026-09-28’de `/` landing eklendi) |
| 2026-09-28 | `/` kurumsal landing; planlama auth ile korumalı | Yayın öncesi tanıtım + erken erişim |
| 2026-09-28 | Auth frontend stub (localStorage) | Backend Phase 1 A bekleniyor |
| 2026-09-08 | Plan geçmişi yalnızca real API | Mock sahte veri göstermez |
| 2026-09-08 | B1 önce B2'den | Kullanıcı yolunu netleştir, sonra harita |
| 2026-09-08 | Hard-code KPI yasak | Anti-fabrication kuralı |

---

## Dev ortamı — hızlı hatırlatma

```bash
# bahcelab-web kökünden
make docker-up
cp bahcelab-backend/.env.example bahcelab-backend/.env   # ilk sefer
make db-migrate
make backend-dev          # http://localhost:8001

# ayrı terminal
cp bahcelab-frontend/.env.example bahcelab-frontend/.env # ilk sefer
npm run dev               # http://localhost:5173/planning
```

---

## Faz 1 — Adım 5B (çoklu indeks)

Tamamlandı: NDVI/MSAVI/NDRE/NDMI/CIgreen/gerçek renk, kontrastlı mod, değişim haritası, karşılaştırma, zaman atlaması, verimlilik bölgeleri. Ayrıntı: `docs/PLAN-FAZ1.md`.

## Faz 1 — Adım 6 (hava durumu)

Tamamlandı: Open-Meteo (sağlayıcı arayüzü), 1 saat önbellek, 13 aylık geçmiş, ilaçlama penceresi, don/sıcak uyarıları, su dengesi, grafikte hava katmanı, hava özeti paneli. Ayrıntı: `docs/PLAN-FAZ1.md`.

---

## Notlar

- Referans görseldeki sayılar **sadece tasarım referansı** — hard-code yasak
- Simülasyon çıktıları "Tahmini senaryo" olarak etiketlenmeli
- `PlantingPoint` ≠ `Tree` — B domain A'dan izole
