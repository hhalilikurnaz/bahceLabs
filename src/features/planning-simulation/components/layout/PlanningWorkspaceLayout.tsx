import type { WorkspaceMapOverlay } from '../../fixtures/workspaceDemo.fixture'
import type { PlanningStepId, PlanningToolId, PlantingSubStepId, SimulationPlan, VisualizationMode } from '../../types'
import { PlanningCard } from '../shared/PlanningCard'
import { ContextPanel } from './ContextPanel'
import { FeatureFooter } from './FeatureFooter'
import { GrowthSimulationTimeline } from './GrowthSimulationTimeline'
import { MetricsBar } from './MetricsBar'
import { PlanningNavbar } from './PlanningNavbar'
import { PlanningSidebar } from './PlanningSidebar'
import { SpatialCanvas } from '../map/SpatialCanvas'

interface PlanningWorkspaceLayoutProps {
  plan: SimulationPlan
  currentStep: PlanningStepId
  completedSteps: PlanningStepId[]
  activePlantingSubStep: PlantingSubStepId
  activeTool: PlanningToolId
  visualizationMode: VisualizationMode
  onSubStepChange: (subStep: PlantingSubStepId) => void
  onToolChange: (tool: PlanningToolId) => void
  onModeChange: (mode: VisualizationMode) => void
  onSave: () => void
  mapOverlay?: WorkspaceMapOverlay
}

export function PlanningWorkspaceLayout({
  plan,
  currentStep,
  completedSteps,
  activePlantingSubStep,
  activeTool,
  visualizationMode,
  onSubStepChange,
  onToolChange,
  onModeChange,
  onSave,
  mapOverlay,
}: PlanningWorkspaceLayoutProps) {
  return (
    <div className="flex h-screen flex-col bg-planning-bg">
      <PlanningNavbar
        plan={plan}
        currentStep={currentStep}
        completedSteps={completedSteps}
      />

      <div className="flex min-h-0 flex-1">
        <PlanningSidebar
          currentStep={currentStep}
          completedSteps={completedSteps}
          activePlantingSubStep={activePlantingSubStep}
          activeTool={activeTool}
          productSelection={plan.productSelection}
          isDirty={plan.isDirty}
          onSubStepChange={onSubStepChange}
          onToolChange={onToolChange}
          onSave={onSave}
        />

        <main className="flex min-w-0 flex-1 flex-col gap-3 overflow-hidden p-3">
          <PlanningCard className="min-h-0 flex-1" bodyClassName="relative h-full min-h-0 p-0">
            <SpatialCanvas
              mode={visualizationMode}
              onModeChange={onModeChange}
              hasGeometry={plan.draftLand.geometry !== null}
              plantingPlan={plan.plantingPlan}
              mapOverlay={mapOverlay}
            />
          </PlanningCard>

          <PlanningCard bodyClassName="p-0">
            <MetricsBar summary={plan.plantingPlan?.summary ?? null} />
          </PlanningCard>

          <PlanningCard bodyClassName="p-0">
            <GrowthSimulationTimeline />
          </PlanningCard>
        </main>

        <ContextPanel plan={plan} />
      </div>

      <FeatureFooter />
    </div>
  )
}
