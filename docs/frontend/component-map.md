# Component Map

## Hiyerarşi (güncel routing)

```
App
└── Routes
    ├── LandingPage                    /
    ├── BlogPage                       /blog
    ├── LoginPage                      /login
    ├── RegisterPage                   /register
    │
    ├── ProtectedRoute
    │   ├── PlanningListPage           /planning
    │   └── PlanningWorkspacePage      /planning/:planId
    │
    └── Navigate * → /

AuthProvider (main.tsx) → useAuth, ProtectedRoute

PlanningListPage
└── PlanningEntryShell
    ├── BahcelabBrandLogo → /
    ├── PlanningGuideIntro
    ├── PlanningStartSection
    ├── ContinuePlansSection
    └── GardenListPanel

PlanningWorkspacePage
└── PlanningWorkspaceLayout
    ├── PlanningNavbar (BahcelabBrandLogo → /)
    ├── PlanningSidebar
    │   ├── SidebarStepList
    │   ├── SidebarToolPalette
    │   └── SidebarSaveButton
    ├── <main>
    │   ├── SpatialCanvas
    │   ├── MetricsBar
    │   └── GrowthSimulationTimeline
    └── ContextPanel
        ├── ProductCard
        ├── PlantingSummaryCard
        └── MaintenanceSummaryCard

LandingPage
├── MarketingNavbar
├── Hero (BahcelabBrandLogo, HeroScrollCue)
├── DiagonalStripSection × N
│   └── MissionOutcomeCards (misyon şeridi)
└── MarketingFooter
```

Detay: [marketing-and-auth.md](./marketing-and-auth.md)

## Shared Components

| Component | Props | Kullanım |
|-----------|-------|----------|
| `DataField` | label, value, availability, unit | Sağ panel, KPI |
| `EmptyState` | title, description | Veri yokken |
| `BahcelabBrandLogo` | tone, height | Marketing + planlama navbar |
| `PlanningCard` | title, children | Workspace kart sarmalayıcı |

## Gelecek Bileşenler (henüz oluşturulmadı)

| Component | Aşama | Açıklama |
|-----------|-------|----------|
| `LandBoundaryLayer` | B2 | Polygon overlay |
| `PlantingGridLayer` | B4 | Dikim noktaları |
| `SpacingAnnotationLayer` | B4 | Ölçüm çizgileri |
| `ProductSelector` | B3 | Ürün seçim modal/panel |
| `SpacingInput` | B4 | Dikim mesafesi formu |
| `MaintenanceForm` | B6 | Bakım planı formları |
| `SimulationPlayer` | B7 | Timeline play/pause |
| `SavePlanDialog` | B9 | Kaydetme onayı |
| `ApplyToGardenDialog` | B10 | Garden entegrasyon onayı |

## Dosya Boyutu Kuralı

- Tek component dosyası **max ~150 satır**
- 150+ satır → alt component'lere böl
- Logic → hook'a taşı
- Constants → `constants/` klasörüne
