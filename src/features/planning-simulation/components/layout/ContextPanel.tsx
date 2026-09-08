import type { SimulationPlan } from '../../types'
import { MaintenanceSummaryCard } from './context-panel/MaintenanceSummaryCard'
import { PlantingSummaryCard } from './context-panel/PlantingSummaryCard'
import { ProductCard } from './context-panel/ProductCard'

interface ContextPanelProps {
  plan: SimulationPlan
  onChangeProduct?: () => void
  onOpenMaintenanceDetail?: () => void
}

export function ContextPanel({
  plan,
  onChangeProduct,
  onOpenMaintenanceDetail,
}: ContextPanelProps) {
  return (
    <aside className="flex h-full min-h-0 w-[260px] shrink-0 flex-col gap-2 overflow-hidden border-l border-planning-border bg-planning-panel p-2">
      <ProductCard
        className="flex-[1.05]"
        productSelection={plan.productSelection}
        onChangeProduct={onChangeProduct}
      />
      <PlantingSummaryCard
        className="flex-1"
        plantingPlan={plan.plantingPlan}
      />
      <MaintenanceSummaryCard
        className="flex-[1.1]"
        maintenancePlan={plan.maintenancePlan}
        onOpenDetail={onOpenMaintenanceDetail}
      />
    </aside>
  )
}
