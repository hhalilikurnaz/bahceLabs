import { PlanningWorkspaceLayout } from '../components/layout/PlanningWorkspaceLayout'
import { planningApi } from '../api'
import {
  applyWorkspaceDemoFixture,
  WORKSPACE_DEMO_COMPLETED_STEPS,
  WORKSPACE_DEMO_MAP_OVERLAY,
} from '../fixtures/workspaceDemo.fixture'
import { usePlanningStore } from '../stores/planningStore'
import { useEffect } from 'react'
import { useParams } from 'react-router-dom'

export function PlanningWorkspacePage() {
  const { planId } = useParams<{ planId: string }>()
  const {
    plan,
    setPlan,
    currentStep,
    activePlantingSubStep,
    activeTool,
    visualizationMode,
    setActivePlantingSubStep,
    setActiveTool,
    setVisualizationMode,
  } = usePlanningStore()

  useEffect(() => {
    if (!planId) return
    planningApi.getPlan(planId).then((loaded) => {
      setPlan(applyWorkspaceDemoFixture(loaded))
    })
  }, [planId, setPlan])

  if (!plan) {
    return (
      <div className="flex h-full items-center justify-center text-planning-text-muted">
        Plan yükleniyor...
      </div>
    )
  }

  return (
    <PlanningWorkspaceLayout
      plan={plan}
      currentStep={currentStep}
      completedSteps={[...WORKSPACE_DEMO_COMPLETED_STEPS]}
      activePlantingSubStep={activePlantingSubStep}
      activeTool={activeTool}
      visualizationMode={visualizationMode}
      onSubStepChange={setActivePlantingSubStep}
      onToolChange={setActiveTool}
      onModeChange={setVisualizationMode}
      onSave={() => planningApi.updatePlan(plan.id, plan)}
      mapOverlay={WORKSPACE_DEMO_MAP_OVERLAY}
    />
  )
}
