import { PlanningWorkspaceLayout } from '../components/layout/PlanningWorkspaceLayout'
import { planningApi } from '../api'
import { isPlanningApiMock } from '../api/config'
import {
  applyWorkspaceDemoFixture,
  WORKSPACE_DEMO_COMPLETED_STEPS,
  WORKSPACE_DEMO_MAP_OVERLAY,
} from '../fixtures/workspaceDemo.fixture'
import { usePlanningStore } from '../stores/planningStore'
import { deriveCompletedSteps } from '../utils/deriveCompletedSteps'
import { useEffect } from 'react'
import { useParams } from 'react-router-dom'

export function PlanningWorkspacePage() {
  const { planId } = useParams<{ planId: string }>()
  const useMock = isPlanningApiMock()
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
      setPlan(useMock ? applyWorkspaceDemoFixture(loaded) : loaded)
    })
  }, [planId, setPlan, useMock])

  if (!plan) {
    return (
      <div className="flex h-full items-center justify-center text-planning-text-muted">
        Plan yükleniyor...
      </div>
    )
  }

  const completedSteps = useMock
    ? [...WORKSPACE_DEMO_COMPLETED_STEPS]
    : deriveCompletedSteps(plan)

  return (
    <PlanningWorkspaceLayout
      plan={plan}
      currentStep={currentStep}
      completedSteps={completedSteps}
      activePlantingSubStep={activePlantingSubStep}
      activeTool={activeTool}
      visualizationMode={visualizationMode}
      onSubStepChange={setActivePlantingSubStep}
      onToolChange={setActiveTool}
      onModeChange={setVisualizationMode}
      onSave={() => planningApi.updatePlan(plan.id, plan)}
      mapOverlay={useMock ? WORKSPACE_DEMO_MAP_OVERLAY : undefined}
    />
  )
}
