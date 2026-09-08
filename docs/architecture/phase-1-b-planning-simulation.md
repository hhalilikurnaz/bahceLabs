# Phase 1 B — Planning & Simulation Mimarisi

## Genel Bakış

Phase 1 B, Phase 1 A'daki **Digital Garden Core**'dan tamamen ayrı bir domain olarak tasarlanmıştır.

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                      │
│  ┌─────────────────────────────────────────────────┐    │
│  │  features/planning-simulation/                   │    │
│  │  ├── components/  stores/  hooks/  api/  types/ │    │
│  └─────────────────────────────────────────────────┘    │
│                          │                               │
│                    API Adapter Layer                     │
│              (mock ↔ real swap via env)                  │
└──────────────────────────┼──────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────┐
│                    BACKEND (gelecek)                     │
│  ┌─────────────────────────────────────────────────┐    │
│  │  domain/planning/                                │    │
│  │  ├── SimulationPlan                              │    │
│  │  ├── PlantingCalculator                          │    │
│  │  ├── MaintenanceService                          │    │
│  │  └── GrowthSimulationService                     │    │
│  └─────────────────────────────────────────────────┘    │
│                          │                               │
│              ┌───────────┴───────────┐                  │
│              │  Phase 1 A (read-only)  │                  │
│              │  Garden, Parcel, Tree     │                  │
│              └─────────────────────────┘                  │
└─────────────────────────────────────────────────────────┘
```

## State Ayrımı

| Store | Sorumluluk | Dosya |
|-------|------------|-------|
| `planningStore` | Step, product, spacing, maintenance, simulation, dirty/save | `stores/planningStore.ts` |
| `mapStore` (gelecek) | Viewport, layers, draw mode, selected point | `stores/mapStore.ts` |

**Kural:** Map state ve planning state asla karışmaz.

## Routing

| Route | Sayfa | Açıklama |
|-------|-------|----------|
| `/planning` | PlanningListPage | Plan listesi / yeni plan |
| `/planning/:planId` | PlanningWorkspacePage | Ana workspace |

## API Adapter Pattern

```typescript
// env: VITE_PLANNING_API_MODE=mock|real
export const planningApi = useMock ? planningApiMock : planningApiReal
```

Backend hazır olduğunda sadece adapter swap edilir; component'ler değişmez.

## Kritik Domain Sınırı

```
SimulationPlan  ──read──►  Garden (opsiyonel, read-only)
SimulationPlan  ──write──►  Garden  ❌ YASAK (B14 hariç, explicit user action)
PlantingPoint   ≠          Tree
```

## Katmanlar

1. **Pages** — route entry, data fetching
2. **Layout components** — shell, header, sidebar, panels
3. **Feature components** — step content, map layers, forms
4. **Stores** — client state (Zustand)
5. **Hooks** — TanStack Query wrappers
6. **API** — typed client + mock/real adapter
7. **Types** — domain contracts
