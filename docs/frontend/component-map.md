# Component Map

## Hiyerarşi

```
App
└── Routes
    ├── PlanningListPage
    │   └── [Yeni Plan Oluştur button]
    │
    └── PlanningWorkspacePage
        └── PlanningWorkspaceLayout
            ├── PlanningHeader
            ├── PlanningStepNav
            ├── PlanningSidebar
            │   ├── StepList (inline)
            │   └── ToolPalette (inline)
            ├── <main>
            │   ├── SpatialCanvas
            │   │   ├── MapControls (B8)
            │   │   └── MapLayers (B8)
            │   │       ├── LandBoundaryLayer
            │   │       ├── PlantingGridLayer
            │   │       └── SpacingAnnotationLayer
            │   ├── MetricsBar
            │   └── GrowthSimulationTimeline
            ├── ContextPanel
            │   ├── ProductCard (B3 — extract)
            │   ├── PlantingSummaryCard (B5 — extract)
            │   └── MaintenanceSummaryCard (B6 — extract)
            └── FeatureFooter
```

## Shared Components

| Component | Props | Kullanım |
|-----------|-------|----------|
| `DataField` | label, value, availability, unit | Sağ panel, KPI |
| `EmptyState` | title, description | Veri yokken |
| `StepIndicator` | step, status | Stepper (gelecek) |

## Gelecek Bileşenler (henüz oluşturulmadı)

| Component | Aşama | Açıklama |
|-----------|-------|----------|
| `MapControls` | B8 | 2D/3D, zoom, compass |
| `LandBoundaryLayer` | B2 | Polygon overlay |
| `PlantingGridLayer` | B4 | Dikim noktaları |
| `SpacingAnnotationLayer` | B4 | Ölçüm çizgileri |
| `ProductCard` | B3 | Ürün detay kartı |
| `ProductSelector` | B3 | Ürün seçim modal/panel |
| `SpacingInput` | B4 | Dikim mesafesi formu |
| `MaintenanceForm` | B6 | Bakım planı formları |
| `SimulationPlayer` | B7 | Timeline play/pause |
| `SavePlanDialog` | B9 | Kaydetme onayı |
| `ApplyToGardenDialog` | B10 | Garden entegrasyon onayı |
| `LandEntryChoice` | B1 | Bahçe vs yeni arazi |

## Dosya Boyutu Kuralı

- Tek component dosyası **max ~150 satır**
- 150+ satır → alt component'lere böl
- Logic → hook'a taşı
- Constants → `constants/` klasörüne
