import type { WorkspaceMapOverlay } from '../../fixtures/workspaceDemo.fixture'
import type { PlanningStepId, PlanningToolId, PlantingSubStepId, SimulationPlan, VisualizationMode } from '../../types'
import { useLayoutEffect, useRef, useState } from 'react'
import { PlanningCard } from '../shared/PlanningCard'
import { ContextPanel } from './ContextPanel'
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
  const mainRef = useRef<HTMLElement>(null)
  const [mapBleedBottom, setMapBleedBottom] = useState(0)

  useLayoutEffect(() => {
    const main = mainRef.current
    if (!main || main.children.length < 3) return

    const updateBleed = () => {
      const metricsCard = main.children[1] as HTMLElement
      const timelineCard = main.children[2] as HTMLElement
      const sectionGap = 12
      setMapBleedBottom(
        metricsCard.offsetHeight + timelineCard.offsetHeight + sectionGap * 2,
      )
    }

    updateBleed()
    const observer = new ResizeObserver(updateBleed)
    observer.observe(main)
    for (const child of main.children) {
      observer.observe(child)
    }
    return () => observer.disconnect()
  }, [])

  return (
    <div className="box-border flex h-screen flex-col gap-3 overflow-hidden bg-planning-bg p-4">
      <PlanningNavbar
        plan={plan}
        currentStep={currentStep}
        completedSteps={completedSteps}
      />

      <div className="flex min-h-0 flex-1 gap-3">
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

        <main
          ref={mainRef}
          className="relative flex min-w-0 flex-1 flex-col gap-3 overflow-hidden p-3"
        >
          <PlanningCard
            className="relative z-0 min-h-0 flex-1 overflow-visible"
            bodyClassName="relative z-0 h-full min-h-0 overflow-visible p-0"
          >
            <SpatialCanvas
              mode={visualizationMode}
              onModeChange={onModeChange}
              hasGeometry={plan.draftLand.geometry !== null}
              plantingPlan={plan.plantingPlan}
              mapOverlay={mapOverlay}
              bleedBottom={mapBleedBottom}
            />
          </PlanningCard>

          <PlanningCard className="relative z-10" bodyClassName="p-0">
            <MetricsBar summary={plan.plantingPlan?.summary ?? null} />
          </PlanningCard>

          <PlanningCard className="relative z-10" bodyClassName="p-0">
            <GrowthSimulationTimeline />
          </PlanningCard>
        </main>

        <ContextPanel plan={plan} />
      </div>
    </div>
  )
}
