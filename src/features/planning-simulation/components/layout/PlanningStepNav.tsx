import { PLANNING_STEPS } from '../../constants/planningSteps'
import type { PlanningStepId } from '../../types'

interface PlanningStepNavProps {
  currentStep: PlanningStepId
  completedSteps: PlanningStepId[]
  onStepClick?: (step: PlanningStepId) => void
}

export function PlanningStepNav({
  currentStep,
  completedSteps,
  onStepClick,
}: PlanningStepNavProps) {
  return (
    <nav className="flex items-center justify-center gap-2 border-b border-planning-border px-4 py-3">
      {PLANNING_STEPS.map((step, index) => {
        const isActive = step.id === currentStep
        const isCompleted = completedSteps.includes(step.id)
        const isLast = index === PLANNING_STEPS.length - 1

        return (
          <div key={step.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onStepClick?.(step.id)}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-planning-accent/15 text-planning-accent'
                  : isCompleted
                    ? 'text-planning-success'
                    : 'text-planning-text-dim'
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                  isActive
                    ? 'bg-planning-accent text-planning-bg'
                    : isCompleted
                      ? 'bg-planning-success/20 text-planning-success'
                      : 'bg-planning-border text-planning-text-dim'
                }`}
              >
                {isCompleted && !isActive ? '✓' : step.order}
              </span>
              <span>{step.label}</span>
            </button>
            {!isLast && (
              <span className="text-planning-border">›</span>
            )}
          </div>
        )
      })}
    </nav>
  )
}
