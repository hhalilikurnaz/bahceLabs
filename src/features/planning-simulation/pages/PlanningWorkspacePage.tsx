import { PlanningWorkspaceLayout } from '../components/layout/PlanningWorkspaceLayout'
import { planningApi } from '../api'
import { usePlanningStore } from '../stores/planningStore'
import { useEffect } from 'react'
import { useParams } from 'react-router-dom'

export function PlanningWorkspacePage() {
  const { planId } = useParams<{ planId: string }>()
  const { plan, setPlan, currentStep, activeTool, visualizationMode, setActiveTool, setVisualizationMode } =
    usePlanningStore()

  useEffect(() => {
    if (!planId) return
    planningApi.getPlan(planId).then(setPlan)
  }, [planId, setPlan])

  if (!plan) {
    return (
      <div className="flex h-full items-center justify-center text-planning-text-muted">
        Plan yükleniyor...
      </div>
    )
  }

  const completedSteps = ['land', 'product'] as const

  return (
    <PlanningWorkspaceLayout
      plan={plan}
      currentStep={currentStep}
      completedSteps={[...completedSteps]}
      activeTool={activeTool}
      visualizationMode={visualizationMode}
      onToolChange={setActiveTool}
      onModeChange={setVisualizationMode}
      onSave={() => planningApi.updatePlan(plan.id, plan)}
    />
  )
}
