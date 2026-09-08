# Phase 1 B — Backend Implementasyon Planı

> Son güncelleme: 2026-09-08  
> Frontend planı: [plan.md](../plan.md)  
> API contract: [planning-api-contract.md](../api/planning-api-contract.md)  
> Domain model: [planning-domain-model.md](../architecture/planning-domain-model.md)

## Amaç

Phase 1 B frontend'inin ihtiyaç duyduğu **tüm hesaplama, doğrulama ve persistence** katmanını sağlamak. Backend, Planning & Simulation domain'inin tek otoritesidir — KPI, grid, alan, simülasyon çıktıları buradan gelir.

```
Frontend (React)  →  API Adapter  →  Planning Backend  →  PostGIS / DB
                                              ↓ (read-only, B1/B10)
                                        Phase 1 A — Garden Core
```

## Temel Kurallar

1. **Tüm KPI'lar backend'den gelir** — frontend asla hesaplamaz
2. **PlantingPoint ≠ Tree** — dikim noktaları planning domain'inde kalır
3. **Save ≠ Apply** — plan kaydetmek Garden'ı değiştirmez
4. **Apply sadece explicit user action** — `POST /apply-to-garden`, onay + validation
5. **Workspace isolation** — her endpoint workspace-scoped, IDOR koruması zorunlu
6. **Deterministic planting** — `area / spacing²` yasak; gerçek spatial grid algoritması
7. **Simülasyon etiketli** — yield/tahmin çıktıları "simülasyon" olarak işaretlenir, garanti değil

---

## PASS Kriteri (Backend)

Frontend PASS senaryosunu destekleyecek minimum backend:

- [ ] Plan CRUD çalışıyor
- [ ] Polygon geometry validate + area/perimeter hesabı
- [ ] Ürün kataloğu (citrus seed data)
- [ ] Planting grid engine deterministik ve testli
- [ ] Maintenance plan persist
- [ ] Growth simulation endpoint (stages + tahmini çıktı)
- [ ] Plan save/load tam aggregate
- [ ] Apply-to-garden kontrollü mutation (B10)

---

## Teknoloji Kararı ✅

| Katman | Seçim | Gerekçe |
|--------|-------|---------|
| Workspace | **Monorepo `bahcelab-web`** | `bahcelab-frontend` + `bahcelab-backend` aynı repo |
| Runtime | **Python 3.12+** | BE4 planting engine için Shapely + geo ekosistemi |
| Framework | **FastAPI** | Typed API, otomatik OpenAPI, async destek |
| Veritabanı | **PostgreSQL 16+** | JSONB + PostGIS |
| Geospatial | **PostGIS** + **Shapely** | Polygon validation, buffer, row/grid hesabı |
| ORM | **SQLAlchemy 2.0** + Alembic | Migration desteği |
| Auth | Phase 1 A ile aynı JWT/workspace model | *(bekliyor — ekip bilgilendirecek)* |
| Test | **pytest** + integration tests | Grid engine determinism testleri kritik |
| Frontend contract | **OpenAPI → TypeScript codegen** | `openapi-typescript` ile tip senkronizasyonu |

### Neden Python, Node değil?

Projenin değer üreten çekirdeği **BE4 Planting Engine** — irregular polygon içinde oriented row + point placement. Bu computational geometry işi; Shapely (GEOS wrapper) bu alanda endüstri standardı. Node/Turf.js BE2'yi (alan, validation) rahat yapar ama BE4'te çok daha fazla custom, kırılgan kod gerekir. Ürünün fark yaratan kısmı doğru grid hesabı — burada Python kazanır.

Monorepo'da tip paylaşımı: FastAPI otomatik OpenAPI üretir → frontend `openapi-typescript` ile tipleri çeker. Manuel senkron gerekmez.

---

## Aşama Sırası (Frontend ile Hizalı)

### BE0 — Foundation

**Amaç:** Proje scaffold, DB, auth middleware, temel plan CRUD

| Görev | Durum |
|-------|-------|
| Backend repo / modül scaffold | ⬜ |
| PostgreSQL + PostGIS kurulum | ⬜ |
| Migration: `simulation_plans` tablosu | ⬜ |
| Workspace-scoped auth middleware | ⬜ |
| Standart error model (`INVALID_GEOMETRY`, vb.) | ⬜ |
| `POST /planning/plans` | ⬜ |
| `GET /planning/plans/{id}` | ⬜ |
| OpenAPI spec (contract ile uyumlu) | ⬜ |
| Local dev: CORS, env config | ⬜ |

**DB — `simulation_plans` (minimum):**
```sql
id              UUID PK
workspace_id    UUID NOT NULL
name            TEXT
status          ENUM(draft, saved, applied)
garden_id       UUID NULL          -- optional, Phase 1 A referansı
current_step    TEXT
draft_land      JSONB              -- geometry, area, validation
product_selection JSONB
planting_plan   JSONB NULL
maintenance_plan JSONB NULL
growth_simulation JSONB NULL
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

**Çıkış kriterleri:**
- [ ] Frontend `VITE_PLANNING_API_MODE=real` ile plan oluşturup okuyabilir
- [ ] Workspace dışı plan erişimi 403 döner

---

### BE1 — Garden Read Integration

**Amaç:** Mevcut bahçe seçimi için Phase 1 A'dan geometry okuma

| Görev | Durum |
|-------|-------|
| `GET /gardens` (veya A API proxy) | ⬜ |
| `GET /gardens/{id}` — geometry dahil | ⬜ |
| Plan oluştururken `garden_id` bağlama | ⬜ |
| Garden geometry → `draft_land` populate | ⬜ |
| Cross-workspace garden erişimi engelle | ⬜ |

**Not:** Phase 1 A henüz bu repoda değil. BE1'de stub/mock Garden API veya A merge sonrası gerçek bağlantı.

---

### BE2 — Land & Geometry Service

**Amaç:** Polygon kaydetme, validation, alan/çevre hesabı

| Görev | Durum |
|-------|-------|
| `POST /planning/plans/{id}/land` | ⬜ |
| `PATCH /planning/plans/{id}/land` | ⬜ |
| GeoJSON Polygon validation | ⬜ |
| Self-intersection kontrolü | ⬜ |
| Minimum alan kontrolü (configurable threshold) | ⬜ |
| Area (m²) ve perimeter (m) hesabı — PostGIS | ⬜ |
| `validationStatus` + `validationMessage` response | ⬜ |

**Validation error örneği:**
```json
{
  "error": {
    "code": "INVALID_GEOMETRY",
    "message": "Arazi sınırı geçersiz: self-intersection detected",
    "details": { "intersection_point": [28.97, 41.01] }
  }
}
```

---

### BE3 — Product Catalog

**Amaç:** Ürün / çeşit / anaç hiyerarşisi

| Görev | Durum |
|-------|-------|
| Migration: `products`, `varieties`, `rootstocks` | ⬜ |
| Citrus seed data (Limon → Meyer → Carrizo, vb.) | ⬜ |
| `GET /planning/products` | ⬜ |
| `GET /planning/products/{id}` (varieties + rootstocks) | ⬜ |
| `recommended_planting_period`, `yield_start_period` alanları | ⬜ |
| Veri yoksa boş liste — frontend `no_data` gösterir | ⬜ |

---

### BE4 — Planting Calculation Engine ⚠️ KRİTİK

**Amaç:** Gerçek spatial dikim grid hesabı — projenin en zor parçası

| Görev | Durum |
|-------|-------|
| `POST /planning/plans/{id}/planting/calculate` | ⬜ |
| Input: spacing_x, spacing_y, orientation_mode, orientation_degrees, boundary_margin | ⬜ |
| Polygon içinde offset (boundary margin) | ⬜ |
| Row orientation: auto (optimal) / manual (degrees) | ⬜ |
| Deterministic row + point placement | ⬜ |
| Output: rows[], planting_points[], summary | ⬜ |
| `total_area_ha`, `usable_area_ha`, `row_count`, `planting_point_count` | ⬜ |
| Sonucu `planting_plan` JSONB'ye persist | ⬜ |
| Unit test: bilinen polygon + spacing → beklenen point count | ⬜ |
| Unit test: aynı input → aynı output (determinism) | ⬜ |

**Yasak:**
- `point_count = area / (spacing_x * spacing_y)` — bu yaklaşık tahmin, gerçek grid değil
- Random koordinat üretimi

**Algoritma taslağı:**
```
1. Validate plan has valid draft_land geometry
2. Apply boundary_margin → inner polygon (buffer inward)
3. Determine row direction (auto: longest edge / manual: degrees)
4. Generate parallel row lines across inner polygon
5. Place points along each row at spacing_y intervals
6. Clip points inside polygon (discard outside)
7. Assign row_number, point_index
8. Compute summary metrics
9. Persist + return
```

---

### BE5 — Planting Summary (Backend-Side)

**Amaç:** KPI ve özet verileri API response'ta hazır

| Görev | Durum |
|-------|-------|
| `PlantingSummary` hesaplama (BE4 output'tan) | ⬜ |
| `estimated_yield` — simülasyon öncesi rough estimate veya `not_configured` | ⬜ |
| `first_harvest_month` — variety'ye bağlı veya `no_data` | ⬜ |
| `DataAvailability` flag'leri doğru set | ⬜ |

---

### BE6 — Maintenance Plan

**Amaç:** Bakım planı CRUD — otomasyon değil, plan düzeyinde

| Görev | Durum |
|-------|-------|
| `POST /planning/plans/{id}/maintenance` | ⬜ |
| Irrigation: method, frequency | ⬜ |
| Fertilization: schedule | ⬜ |
| Pruning: schedule | ⬜ |
| `maintenance_plan` JSONB persist | ⬜ |
| Validation: plan must have planting_plan | ⬜ |

---

### BE7 — Growth Simulation Service

**Amaç:** Gelişim timeline ve tahmini hasat senaryosu

| Görev | Durum |
|-------|-------|
| `POST /planning/plans/{id}/simulation/run` | ⬜ |
| `GET /planning/plans/{id}/simulation` | ⬜ |
| Growth stages: Dikim → Köklenme → Gelişim → ... → Hasat | ⬜ |
| `relativeMonth` markers (0, 6, 12, 18, 24, 36, 48) | ⬜ |
| Tahmini verim hesabı (variety + point count bazlı, basit model) | ⬜ |
| `resultLabel` + `resultAvailability` — her zaman "simülasyon" etiketi | ⬜ |
| `growth_simulation` JSONB persist | ⬜ |

**Simülasyon sınırı:**
- Hava durumu modeli yok
- Hastalık kaybı tahmini yok
- Bilimsel yield garantisi yok
- Basit katsayı tabanlı tahmin + `not_configured` fallback

---

### BE8 — Visualization Data API

**Amaç:** Frontend 2D/3D render için gerekli veriyi sağla (hesaplama BE4'te)

| Görev | Durum |
|-------|-------|
| Plan detay response'ta `planting_plan.rows` + `points` tam geometri | ⬜ |
| Row line coordinates (start/end per row) | ⬜ |
| Boundary polygon response'ta | ⬜ |
| Measurement annotations (row length, spacing) — BE4 output'a ekle | ⬜ |

> BE8 ayrı endpoint gerektirmeyebilir — `GET /planning/plans/{id}` zengin response yeterli.

---

### BE9 — Plan Persistence (Full CRUD)

**Amaç:** Kaydet, listele, güncelle, sil

| Görev | Durum |
|-------|-------|
| `GET /planning/plans` — workspace plan listesi | ⬜ |
| `PATCH /planning/plans/{id}` — partial update (name, step, selections) | ⬜ |
| `DELETE /planning/plans/{id}` | ⬜ |
| Dirty state: frontend `isDirty` yönetir, backend `updated_at` döner | ⬜ |
| Status lifecycle: `draft` → `saved` → `applied` | ⬜ |
| Applied plan'lar immutable (veya yeni versiyon) | ⬜ |

---

### BE10 — Apply to Garden

**Amaç:** Kontrollü Phase 1 A mutation — son aşama

| Görev | Durum |
|-------|-------|
| `POST /planning/plans/{id}/apply-to-garden` | ⬜ |
| Ön koşul: plan `saved`, valid planting_plan, user confirmation token | ⬜ |
| Garden ownership + workspace validation | ⬜ |
| `PlantingPoint` → `Tree` dönüşümü (kontrollü) | ⬜ |
| Parcel/Block oluşturma (A domain modeline uygun) | ⬜ |
| Plan status → `applied` | ⬜ |
| Audit log (kim, ne zaman, hangi plan) | ⬜ |
| Rollback stratejisi (transaction) | ⬜ |

---

## Paralel Geliştirme Takvimi

Frontend aşamalarıyla backend'in ne zaman hazır olması gerektiği:

| Frontend | Backend | Blocker? |
|----------|---------|----------|
| B0 Foundation | BE0 Foundation | Hayır — mock devam |
| B1 Garden entry | BE1 Garden read | Kısmen — stub ile devam |
| B2 Land draw | BE2 Geometry | **Evet** — alan hesabı backend'den |
| B3 Product select | BE3 Catalog | **Evet** — ürün listesi |
| B4 Planting grid | BE4 Engine | **Evet** — en kritik blocker |
| B5 Summary KPI | BE5 Summary | BE4'e bağlı |
| B6 Maintenance | BE6 Maintenance | Orta |
| B7 Simulation | BE7 Simulation | Orta |
| B8 Visualization | BE8 Data | BE4'e bağlı |
| B9 Save/load | BE9 CRUD | **Evet** — persistence |
| B10 Apply | BE10 Integration | Phase 1 A gerekli |

**Öncelik sırası:** BE0 → BE2 → BE3 → BE4 → BE9 → BE7 → BE6 → BE1 → BE10

---

## Test Stratejisi

| Katman | Ne test edilir |
|--------|----------------|
| Unit | Geometry validation, planting grid determinism, summary math |
| Integration | Plan CRUD lifecycle, workspace isolation |
| Contract | OpenAPI ↔ frontend types uyumu |
| E2E | Frontend PASS senaryosu (tarayıcı) |

**Kritik test fixture'ları:**
- Bilinen dikdörtgen polygon + 6×6 spacing → exact point count
- L-shaped polygon → margin sonrası point clipping
- Self-intersecting polygon → `INVALID_GEOMETRY`
- Cross-workspace access → 403

---

## İlk Sprint (Bu Hafta)

1. **Monorepo workspace** — `bahcelab-web` root, `bahcelab-backend` scaffold
2. **BE0** — FastAPI + `simulation_plans` migration + create/get plan
3. **BE2** — geometry validation + area (frontend B2'ye paralel)
4. **BE3** — product seed data (frontend B3'e paralel)
5. Frontend'de `planningApi.real.ts` adapter başlangıcı

---

## Açık Kararlar

| # | Karar | Durum | Not |
|---|-------|-------|-----|
| 1 | Monorepo yapısı | ✅ **Kararlı** | `bahcelab-web` workspace, frontend + backend |
| 2 | Runtime / framework | ✅ **Kararlı** | Python 3.12 + FastAPI |
| 3 | Planting points storage | ✅ **Kararlı** | JSONB (B4 MVP), sonra normalize |
| 4 | Phase 1 A entegrasyonu | ⏳ Bekliyor | Ekip arkadaşından bilgi gelecek |
| 5 | Auth modeli | ⏳ Bekliyor | Ekip arkadaşından bilgi gelecek |

---

## Dosya Yapısı (Monorepo)

```
bahcelab-web/                          # workspace root
├── package.json                       # npm/pnpm workspaces
├── docker-compose.yml                 # PostgreSQL + PostGIS
├── bahcelab-frontend/                 # React (mevcut)
│   └── src/features/planning-simulation/
├── bahcelab-backend/                  # FastAPI (yeni)
│   ├── src/
│   │   ├── domain/
│   │   │   └── planning/
│   │   │       ├── models/
│   │   │       ├── services/
│   │   │       │   ├── geometry.py
│   │   │       │   ├── planting_calculator.py
│   │   │       │   ├── maintenance.py
│   │   │       │   └── growth_simulation.py
│   │   │       └── repositories/
│   │   ├── api/
│   │   │   └── planning/
│   │   ├── integrations/
│   │   │   └── garden_core/
│   │   └── shared/
│   │       ├── auth/
│   │       └── errors/
│   ├── migrations/                    # Alembic
│   ├── tests/
│   │   ├── unit/
│   │   │   └── test_planting_calculator.py
│   │   └── integration/
│   ├── pyproject.toml
│   └── Dockerfile
└── docs/                              # paylaşılan dokümantasyon
```
