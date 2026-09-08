import { PLANNING_STEPS } from '../constants/planningSteps'
import type { PlanningStepId, SimulationPlan } from '../types'

export function deriveCompletedSteps(plan: SimulationPlan): PlanningStepId[] {
  const completed: PlanningStepId[] = []
  const stepOrder = PLANNING_STEPS.map((step) => step.id)
  const currentIndex = stepOrder.indexOf(plan.currentStep)

  for (const stepId of stepOrder) {
    if (stepId === plan.currentStep) break

    if (stepId === 'land') {
      if (
        plan.draftLand.validationStatus === 'valid' &&
        plan.draftLand.geometry !== null
      ) {
        completed.push(stepId)
      }
      continue
    }

    if (stepId === 'product') {
      if (plan.productSelection.productId) {
        completed.push(stepId)
      }
      continue
    }

    if (stepId === 'planting') {
      if (plan.plantingPlan) {
        completed.push(stepId)
      }
      continue
    }

    if (stepId === 'maintenance') {
      if (plan.maintenancePlan) {
        completed.push(stepId)
      }
      continue
    }

    if (currentIndex > stepOrder.indexOf(stepId)) {
      completed.push(stepId)
    }
  }

  return completed
}
