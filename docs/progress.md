# Phase 1 B — İlerleme & Backlog

> Günlük güncellenir. Agent'lar ve ekip için canlı durum takibi.

**Branch:** `feature/phase-1-b-planning-simulation`  
**Başlangıç:** 2026-09-08

---

## Güncel Durum Özeti

| Metrik | Değer |
|--------|-------|
| Aktif aşama | **B0 — Foundation** |
| Tamamlanan aşamalar | B0 (kısmen) |
| Sonraki aşama | B0 verify → B1 |
| Backend durumu | **BE0 scaffold hazır** — Docker + migrate ile çalışır |
| Referans UI | Layout shell hazır — mockup: `docs/reference-design.md` |

---

## 2026-09-08 — Gün 1

### Yapılanlar ✅

- [x] Repo audit tamamlandı (greenfield tespit edildi)
- [x] Phase 1 B implementasyon planı yazıldı (`docs/plan.md`)
- [x] Vite + React 19 + TypeScript scaffold kuruldu
- [x] Tailwind CSS v4 + planning design tokens tanımlandı
- [x] Zustand + TanStack Query + React Router entegre edildi
- [x] B domain TypeScript types oluşturuldu
- [x] Mock API adapter (`planningApi.mock.ts`) yazıldı
- [x] Planning workspace layout shell (referans görsele uygun)
  - Header, stepper, sol sidebar, orta canvas, sağ panel
  - Alt KPI bar, growth timeline, feature footer
- [x] Empty/no-data state'ler (KPI alanları `—` gösteriyor)
- [x] Referans görsel repoya eklendi (`docs/assets/reference-planning-workspace.jpg`)
- [x] `docs/reference-design.md` oluşturuldu
- [x] Route'lar: `/planning`, `/planning/:planId`

### Devam Eden 🔄

- [x] `npm run build` verify
- [x] Feature branch oluşturma (`feature/phase-1-b-planning-simulation`)
- [ ] İlk commit

### Kalanlar (B0 tamamlama) ⬜

- [ ] Build + typecheck hatasız geçmeli
- [ ] README güncelleme
- [ ] `.env.example` oluşturma

### Sonraki Sprint (B1) ⬜

- [ ] Giriş ekranı: Mevcut bahçe vs Yeni arazi
- [ ] Garden listesi placeholder (A API hazır olunca bağlanacak)
- [ ] Draft land oluşturma akışı

---

## Backlog — Öncelik Sırası

### P0 — Kritik (B0–B4)

| # | Görev | Aşama | Durum | Not |
|---|-------|-------|-------|-----|
| 1 | Layout shell referans görsele uygun | B0 | ✅ | |
| 2 | Domain types + mock API | B0 | ✅ | |
| 3 | Build verify | B0 | 🔄 | |
| 4 | MapLibre 2D entegrasyonu | B2 | ⬜ | |
| 5 | Polygon draw + validation | B2 | ⬜ | |
| 6 | Ürün seçimi UI | B3 | ⬜ | |
| 7 | Dikim spacing input | B4 | ⬜ | |
| 8 | Planting grid calculation (backend) | B4 | ⬜ | BE4 |
| 9 | Planting points haritada | B4 | ⬜ | |

### P1 — Önemli (B5–B8)

| # | Görev | Aşama | Durum | Not |
|---|-------|-------|-------|-----|
| 10 | KPI bar gerçek veri | B5 | ⬜ | |
| 11 | Bakım planı formları | B6 | ⬜ | |
| 12 | Growth timeline interactive | B7 | ⬜ | |
| 13 | 2D visualization layers | B8 | ⬜ | |
| 14 | 3D stylized trees | B8 | ⬜ | |

### P2 — Tamamlama (B9–B10)

| # | Görev | Aşama | Durum | Not |
|---|-------|-------|-------|-----|
| 15 | Plan save/load | B9 | ⬜ | |
| 16 | Plan listesi | B9 | ⬜ | |
| 17 | Garden integration UI | B10 | ⬜ | |
| 18 | Responsive design | B10 | ⬜ | |
| 19 | Accessibility | B10 | ⬜ | |
| 20 | E2E tests | B10 | ⬜ | |

### Backend (ekip — paralel)

> Detaylı plan: [backend/plan.md](./backend/plan.md)

| # | Görev | Aşama | Durum | Not |
|---|-------|-------|-------|-----|
| BE0 | Foundation: scaffold, migration, plan CRUD | BE0 | ✅ | FastAPI + Alembic |
| BE1 | Garden read integration (Phase 1 A) | BE1 | ⬜ | A merge sonrası |
| BE2 | Geometry validation + area/perimeter | BE2 | ✅ | Shapely + pyproj WGS84 |
| BE3 | Product/Variety/Rootstock catalog | BE3 | ✅ | Citrus seed data |
| BE4 | Planting calculation engine | BE4 | ⬜ | **En kritik — sıradaki** |
| BE5 | Planting summary / KPI | BE5 | ⬜ | BE4'e bağlı |
| BE6 | Maintenance plan API | BE6 | ⬜ | |
| BE7 | Growth simulation API | BE7 | ⬜ | |
| BE8 | Visualization data (plan response) | BE8 | ⬜ | |
| BE9 | Plan full CRUD | BE9 | 🔄 | PATCH/DELETE hazır, list test bekliyor |
| BE10 | Apply-to-garden endpoint | BE10 | ⬜ | Son aşama |

---

## Blocker'lar

| Blocker | Etki | Çözüm |
|---------|------|-------|
| Backend henüz bağlı değil (frontend) | Hesaplamalar yapılamaz | BE0 hazır — `make docker-up && make db-migrate && make backend-dev` |
| Docker Desktop kapalı | DB + integration test çalışmaz | Docker'ı başlat |
| Phase 1 A kodu bu repoda yok | Garden seçimi yapılamaz | B1'de placeholder, A merge sonrası bağlanacak |
| MapLibre henüz kurulmadı | Harita görselleştirme yok | B2'de kurulacak |

---

## Kararlar Logu

| Tarih | Karar | Gerekçe |
|-------|-------|---------|
| 2026-09-08 | React + TypeScript + Vite | Sağlam, güvenli, rahat geliştirme |
| 2026-09-08 | Tailwind CSS v4 | Hızlı styling, design token desteği |
| 2026-09-08 | Zustand (planning) + ayrı map store (gelecek) | State ayrımı |
| 2026-09-08 | Monorepo `bahcelab-web` | `bahcelab-frontend/` + `bahcelab-backend/` yan yana |
| 2026-09-08 | Backend: Python + FastAPI | BE4 geo engine için Shapely + pyproj |
| 2026-09-08 | Hard-code KPI yasak | Anti-fabrication kuralı |

---

## Notlar

- Referans görseldeki sayılar (652, 8.2 ton, 2.35 ha) **sadece tasarım referansı**
- Simülasyon çıktıları "Simülasyon" / "Tahmini senaryo" olarak etiketlenmeli
- Bakım planı otomasyon değil — plan düzeyinde kalır
- `PlantingPoint` ≠ `Tree` — B domain A'dan izole
