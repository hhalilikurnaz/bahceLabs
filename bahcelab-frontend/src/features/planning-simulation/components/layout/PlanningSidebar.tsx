import type { PlantingSubStepId, PlanningStepId, PlanningToolId, ProductSelection } from '../../types'
import { PlanningCard } from '../shared/PlanningCard'
import { SidebarSaveButton } from './sidebar/SidebarSaveButton'
import { SidebarStepList } from './sidebar/SidebarStepList'
import { SidebarToolPalette } from './sidebar/SidebarToolPalette'

interface PlanningSidebarProps {
  currentStep: PlanningStepId
  completedSteps: PlanningStepId[]
  activePlantingSubStep: PlantingSubStepId
  activeTool: PlanningToolId
  productSelection: ProductSelection
  isDirty?: boolean
  onSubStepChange: (subStep: PlantingSubStepId) => void
  onToolChange: (tool: PlanningToolId) => void
  onSave: () => void
}

export function PlanningSidebar({
  currentStep,
  completedSteps,
  activePlantingSubStep,
  activeTool,
  productSelection,
  isDirty,
  onSubStepChange,
  onToolChange,
  onSave,
}: PlanningSidebarProps) {
  return (
    <aside className="flex h-full min-h-0 w-[260px] shrink-0 flex-col gap-2 overflow-hidden rounded-xl border border-planning-border bg-planning-panel p-2.5">
      <PlanningCard
        compact
        fill
        title="Planlama Adımları"
        className="flex-[1.35]"
        bodyClassName="flex min-h-0 flex-1 flex-col px-3 py-3"
      >
        <SidebarStepList
          currentStep={currentStep}
          completedSteps={completedSteps}
          activePlantingSubStep={activePlantingSubStep}
          productSelection={productSelection}
          onSubStepChange={onSubStepChange}
        />
      </PlanningCard>

      <PlanningCard
        compact
        fill
        title="Araçlar"
        className="flex-1"
        bodyClassName="flex min-h-0 flex-1 flex-col p-2.5"
      >
        <SidebarToolPalette activeTool={activeTool} onToolChange={onToolChange} />
      </PlanningCard>

      <SidebarSaveButton onSave={onSave} isDirty={isDirty} />
    </aside>
  )
}
