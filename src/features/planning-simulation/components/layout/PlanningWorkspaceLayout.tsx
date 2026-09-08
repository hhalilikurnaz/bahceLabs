import type { PlanningStepId, PlanningToolId, SimulationPlan, VisualizationMode } from '../../types'
import { ContextPanel } from './ContextPanel'
import { FeatureFooter } from './FeatureFooter'
import { GrowthSimulationTimeline } from './GrowthSimulationTimeline'
import { MetricsBar } from './MetricsBar'
import { PlanningHeader } from './PlanningHeader'
import { PlanningSidebar } from './PlanningSidebar'
import { PlanningStepNav } from './PlanningStepNav'
import { SpatialCanvas } from '../map/SpatialCanvas'

interface PlanningWorkspaceLayoutProps {
  plan: SimulationPlan
  currentStep: PlanningStepId
  completedSteps: PlanningStepId[]
  activeTool: PlanningToolId
  visualizationMode: VisualizationMode
  onToolChange: (tool: PlanningToolId) => void
  onModeChange: (mode: VisualizationMode) => void
  onSave: () => void
}

export function PlanningWorkspaceLayout({
  plan,
  currentStep,
  completedSteps,
  activeTool,
  visualizationMode,
  onToolChange,
  onModeChange,
  onSave,
}: PlanningWorkspaceLayoutProps) {
  return (
    <div className="flex h-screen flex-col bg-planning-bg">
      <PlanningHeader plan={plan} />
      <PlanningStepNav currentStep={currentStep} completedSteps={completedSteps} />
      <div className="flex min-h-0 flex-1">
        <PlanningSidebar
          currentStep={currentStep}
          completedSteps={completedSteps}
          activeTool={activeTool}
          onToolChange={onToolChange}
          onSave={onSave}
        />
        <main className="flex min-w-0 flex-1 flex-col">
          <SpatialCanvas
            mode={visualizationMode}
            onModeChange={onModeChange}
            hasGeometry={plan.draftLand.geometry !== null}
          />
          <MetricsBar summary={plan.plantingPlan?.summary ?? null} />
          <GrowthSimulationTimeline />
        </main>
        <ContextPanel plan={plan} />
      </div>
      <FeatureFooter />
    </div>
  )
}
