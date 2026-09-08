# Phase 1 B — Ana Implementasyon Planı

> Branch: `feature/phase-1-b-planning-simulation`  
> Son güncelleme: 2026-09-08  
> **Referans görsel:** [reference-design.md](./reference-design.md) | `docs/assets/reference-planning-workspace.jpg`

## Amaç

Boş araziden hasada kadar akıllı planlama, dikim, bakım ve sonuç simülasyonu akışını **gerçek çalışan full-stack ürün** olarak geliştirmek.

```
Boş arazi / Mevcut bahçe
  → Arazi tanımı
  → Ürün seçimi
  → Dikim planı
  → Dikim özeti
  → Bakım planı
  → Gelişim & hasat simülasyonu
  → 2D/3D görselleştirme
  → Plan kaydetme
  → (Opsiyonel) Gerçek Garden'a aktarım
```

## PASS Kriteri

Tarayıcıda şu senaryo gerçekten çalışıyorsa B tamamlanmış sayılır:

1. Boş arazi oluştur
2. Ürün seç
3. Gerçek polygon üzerinde gerçek dikim grid'i oluştur
4. Ağaç/sıra sayılarını hesapla
5. Bakım planını oluştur
6. Simülasyonu başlat, timeline'ı oynat
7. 2D/3D görselleştirmeyi çalıştır
8. Planı kaydet, tekrar aç
9. Gerekiyorsa kullanıcı onayıyla gerçek Garden'a uygula

---

## Aşama Sırası

### B0 — Foundation ✅ (başlandı)

**Amaç:** Scaffold, domain types, API abstraction, layout shell

| Görev | Durum |
|-------|-------|
| Vite + React + TypeScript scaffold | ✅ |
| Tailwind + design tokens | ✅ |
| Zustand + TanStack Query | ✅ |
| React Router (`/planning`, `/planning/:id`) | ✅ |
| B domain TypeScript types | ✅ |
| API interface + mock adapter | ✅ |
| Planning workspace layout shell | ✅ |
| Empty/no-data states | ✅ |
| Docs klasörü | ✅ |

**Çıkış kriterleri:**
- [x] Scaffold çalışıyor
- [x] Layout referans görsele uygun iskelet
- [x] Hard-coded KPI yok
- [x] Typecheck + build geçiyor
- [x] Feature branch oluşturuldu

---

### B1 — Garden vs Draft Land Girişi

**Amaç:** Kullanıcıya iki seçenek sun — mevcut bahçe veya yeni arazi

| Görev | Durum |
|-------|-------|
| Giriş ekranı: "Mevcut bahçe" / "Yeni arazi" | ⬜ |
| Garden listesi (A API'den read-only) | ⬜ |
| Draft land oluşturma akışı | ⬜ |
| `garden_id` optional model desteği | ⬜ |

---

### B2 — Arazi Tanımı

**Amaç:** Haritada polygon çizimi, validation, alan hesabı

| Görev | Durum |
|-------|-------|
| MapLibre entegrasyonu (2D) | ⬜ |
| Polygon draw tool | ⬜ |
| Geometry validation UI | ⬜ |
| Alan gösterimi (backend'den) | ⬜ |
| Self-intersection error state | ⬜ |
| North indicator, zoom controls | ⬜ |

---

### B3 — Ürün Seçimi

**Amaç:** Product / Variety / Rootstock seçimi

| Görev | Durum |
|-------|-------|
| Ürün listesi UI | ⬜ |
| Çeşit / anaç seçimi | ⬜ |
| Sağ panel ProductCard doldurma | ⬜ |
| `GET /planning/products` API bağlantısı | ⬜ |

---

### B4 — Dikim Planı Engine

**Amaç:** Gerçek spatial grid hesabı — en kritik bölüm

| Görev | Durum |
|-------|-------|
| Spacing input (sıra arası × sıra üzeri) | ⬜ |
| Orientation seçimi (auto / manual) | ⬜ |
| `POST /planting/calculate` API | ⬜ |
| Planting points haritada gösterim | ⬜ |
| Row lines, spacing annotations | ⬜ |
| Deterministic grid (area/spacing² YASAK) | ⬜ |

---

### B5 — Dikim Plan Özeti

**Amaç:** Sağ panel + alt KPI bar gerçek verilerle

| Görev | Durum |
|-------|-------|
| MetricsBar backend verisi | ⬜ |
| PlantingSummaryCard backend verisi | ⬜ |
| "Simülasyon verimi" etiketleme | ⬜ |
| Empty / loading / error states | ⬜ |

---

### B6 — Bakım Planı

**Amaç:** Sulama, besleme, budama planlama (otomasyon değil)

| Görev | Durum |
|-------|-------|
| Sulama planı formu | ⬜ |
| Besleme planı formu | ⬜ |
| Budama planı formu | ⬜ |
| MaintenanceSummaryCard | ⬜ |
| "Detaylı Bakım Planı" sayfası/modal | ⬜ |

---

### B7 — Gelişim & Hasat Simülasyonu

**Amaç:** Timeline, growth stages, play/pause

| Görev | Durum |
|-------|-------|
| Interactive timeline slider | ⬜ |
| Play / pause / jump to month | ⬜ |
| Growth stage markers | ⬜ |
| Tree visual progression | ⬜ |
| Simulation result labeling | ⬜ |
| `POST /simulation/run` API | ⬜ |

---

### B8 — 2D / 3D Görselleştirme

**Amaç:** Profesyonel spatial visualization

| Görev | Durum |
|-------|-------|
| 2D: boundary, grid, points, measurements | ⬜ |
| 3D: stylized trees, instanced rendering | ⬜ |
| 2D/3D toggle | ⬜ |
| Camera controls (zoom, rotate) | ⬜ |
| Selected point tooltip | ⬜ |
| Performance: WebGL layers, no heavy DOM | ⬜ |

---

### B9 — Plan Persistence

**Amaç:** Kaydet, yükle, listele

| Görev | Durum |
|-------|-------|
| Save flow (dirty state, saving, saved, error) | ⬜ |
| Plan listesi sayfası | ⬜ |
| Plan yükleme (`/planning/:id`) | ⬜ |
| Unsaved changes warning | ⬜ |
| CRUD API bağlantısı | ⬜ |

---

### B10 — Garden Integration + Final Gate

**Amaç:** Kontrollü Garden'a aktarım + hardening

| Görev | Durum |
|-------|-------|
| "Gerçek Bahçeye Uygula" confirmation dialog | ⬜ |
| `POST /apply-to-garden` API | ⬜ |
| Responsive (1440 → 390) | ⬜ |
| Accessibility (keyboard, aria, contrast) | ⬜ |
| Unit + integration + E2E tests | ⬜ |
| Lint + typecheck + build CI | ⬜ |
| Browser runtime E2E verification | ⬜ |

---

## Dosya Yapısı

```
src/features/planning-simulation/
├── api/           # API client + mock
├── components/
│   ├── layout/    # Shell bileşenleri
│   ├── map/       # Harita + layer'lar
│   ├── panels/    # Sağ panel kartları
│   ├── steps/     # Adım içerikleri
│   └── shared/    # DataField, EmptyState, vb.
├── constants/
├── hooks/
├── pages/
├── stores/
└── types/
```

## Anti-Fabrication Listesi

Bu değerler **asla** production component'lerde hard-code edilmez:

- 652 (ağaç sayısı)
- 8.2 (ton verim)
- 23 (sıra sayısı)
- 2.35 (hektar)
- 125 m, 188 m (ölçüler)
- 6.0 × 6.0 m (KPI olarak — spacing input default olabilir)

Test fixture'ları `tests/fixtures/` altında, production'dan ayrı tutulur.
