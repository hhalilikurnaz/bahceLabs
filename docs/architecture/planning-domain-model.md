# Planning Domain Model

## Entity İlişkileri

```
SimulationPlan (aggregate root)
├── id: string
├── name: string
├── workspaceId: string
├── gardenId?: string          ← optional, draft land için null
├── status: draft | saved | applied
│
├── draftLand: PlanningLand
│   ├── geometry: GeoJSON Polygon
│   ├── areaM2: number
│   ├── perimeterM: number
│   ├── locationLabel: string
│   └── validationStatus: valid | invalid | pending | not_set
│
├── productSelection: ProductSelection
│   ├── productId, productName
│   ├── varietyId, varietyName
│   ├── rootstockId, rootstockName
│   ├── imageUrl
│   ├── recommendedPlantingPeriod
│   └── yieldStartPeriod
│
├── plantingPlan?: PlantingPlan
│   ├── spacing: { rowSpacingM, plantSpacingM }
│   ├── orientationMode: auto | manual
│   ├── orientationDegrees?: number
│   ├── boundaryMarginM?: number
│   ├── rows: PlantingRow[]
│   ├── points: PlantingPoint[]
│   └── summary: PlantingSummary
│
├── maintenancePlan?: MaintenancePlan
│   ├── irrigation: { method, frequency }
│   ├── fertilization: { schedule }
│   └── pruning: { schedule }
│
├── growthSimulation?: GrowthSimulation
│   ├── currentMonth: number
│   ├── stages: GrowthStage[]
│   ├── activeStageId: string
│   └── result: SimulationResult
│
├── createdAt, updatedAt
└── isDirty: boolean
```

## Alt Entity'ler

### PlantingPoint

```typescript
{
  id: string
  coordinates: [lng, lat]
  rowNumber: number
  pointIndex: number
}
```

**Önemli:** `PlantingPoint` ≠ `Tree`. B domain'ine ait planning object.

### PlantingRow

```typescript
{
  id: string
  rowNumber: number
  points: PlantingPoint[]
}
```

### GrowthStage

```typescript
{
  id: string
  name: string           // "Dikim", "Köklenme", "Gelişim", ...
  relativeMonth: number  // 0, 6, 12, 18, 24, 36, 48
  description?: string
}
```

### Product Hierarchy

```
Product (Limon, Portakal, ...)
  └── ProductVariety (Meyer, Eureka, ...)
        └── Rootstock (Carrizo, Volkameriana, ...)
```

## DataAvailability

Her nullable/agronomik alan bir availability state taşır:

```typescript
type DataAvailability =
  | 'available'        // Gerçek veri var
  | 'no_data'          // Henüz hesaplanmadı / girilmedi
  | 'not_configured'   // Model henüz yapılandırılmadı
  | 'unavailable'      // Veri kaynağında bulunamadı
```

## Plan Lifecycle

```
Draft ──save──► Saved ──apply (user confirmed)──► Applied
```

- `Draft`: İlk oluşturma, henüz kaydedilmedi
- `Saved`: Persist edildi
- `Applied`: Gerçek Garden'a aktarıldı (B14, explicit user action)

## Domain Concept ≠ Database Table

Persistence ihtiyacı olan yapılar DB'ye konur. Hesaplama sonuçları (planting points) JSONB veya ayrı tablo olarak tutulabilir — B4'te karar verilecek.
