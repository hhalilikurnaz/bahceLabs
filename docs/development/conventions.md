# Geliştirme Kuralları

## Genel

- **TypeScript strict mode** — `any` kullanma
- **React functional components** — class component yok
- **Named exports** — default export sadece page/route entry
- **Dosya boyutu** — max ~150 satır/component, büyükse böl

## Klasör Kuralları

```
bahcelab-frontend/src/features/planning-simulation/   ← B domain, izole
src/shared/                         ← Ortak UI primitives
src/lib/                            ← Utility fonksiyonlar
```

- Feature-specific kod `features/` altında
- Cross-feature shared kod `shared/` altında
- A domain koduna (`garden-core/`) dokunma

## Import Kuralları

```typescript
// ✅ Doğru
import { usePlanningStore } from '@/features/planning-simulation/stores/planningStore'
import type { SimulationPlan } from '@/features/planning-simulation/types'

// ❌ Yanlış — relative path derinliği
import { usePlanningStore } from '../../../stores/planningStore'
```

`@/` alias kullan (`vite.config.ts` + `tsconfig`).

## State Kuralları

| Ne | Nerede |
|----|--------|
| Server data (API) | TanStack Query hooks |
| Client UI state | Zustand stores |
| Form state | Component local state veya Zustand |
| Map viewport/layers | `mapStore` (ayrı) |

Map state ↔ planning state **karışmaz**.

## Component Kuralları

- Props interface tanımla
- `aria-label` icon-only butonlarda zorunlu
- Loading/empty/error state her data-driven component'te
- Hard-coded KPI yasak (anti-fabrication)

## API Kuralları

- Component'ler doğrudan `fetch` çağırmaz — `planningApi` üzerinden
- Mock/real swap env variable ile
- Response type'ları `types/` altında

## Styling

- Tailwind utility classes
- Design token'lar: `bg-planning-*`, `text-planning-*`
- Inline style yasak (token exception hariç)
- Magic number yasak — token veya constant kullan

## Commit Mesajları

```
feat(planning): add polygon draw tool
fix(planning): correct spacing annotation position
docs: update B4 progress in progress.md
```

## Test

- Unit: geometry, grid, validation logic
- Component: step navigation, empty states
- E2E: full planning flow
- Mock fixture'lar `tests/fixtures/` altında, production'dan ayrı
