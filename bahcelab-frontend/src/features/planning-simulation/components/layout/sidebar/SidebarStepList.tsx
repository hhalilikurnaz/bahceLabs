import { Check } from 'lucide-react'
import type { PlantingSubStepId, PlanningStepId, ProductSelection } from '../../../types'

interface SidebarStepDefinition {
  id: PlanningStepId
  label: string
  subSteps?: { id: PlantingSubStepId; label: string }[]
}

const SIDEBAR_STEPS: SidebarStepDefinition[] = [
  { id: 'land', label: 'Arazi Tanımı' },
  { id: 'product', label: 'Ürün Seçimi' },
  {
    id: 'planting',
    label: 'Dikim Planı',
    subSteps: [
      { id: 'spacing', label: 'Dikim Mesafesi' },
      { id: 'irrigation', label: 'Sulama Planı' },
      { id: 'fertilization', label: 'Besleme Planı' },
    ],
  },
  { id: 'maintenance', label: 'Bakım Planı' },
  { id: 'simulation', label: 'Simülasyon' },
]

type StepStatus = 'completed' | 'active' | 'pending'

interface SidebarStepListProps {
  currentStep: PlanningStepId
  completedSteps: PlanningStepId[]
  activePlantingSubStep: PlantingSubStepId
  productSelection: ProductSelection
  onSubStepChange: (subStep: PlantingSubStepId) => void
}

function getStepStatus(
  stepId: PlanningStepId,
  currentStep: PlanningStepId,
  completedSteps: PlanningStepId[],
): StepStatus {
  if (completedSteps.includes(stepId)) return 'completed'
  if (stepId === currentStep) return 'active'
  return 'pending'
}

function getProductLabel(selection: ProductSelection): string | null {
  if (!selection.productName) return null
  if (selection.varietyName) {
    return `${selection.productName} (${selection.varietyName})`
  }
  return selection.productName
}

function getStepSubtitle(
  step: SidebarStepDefinition,
  status: StepStatus,
  productSelection: ProductSelection,
): string {
  if (status === 'completed') {
    if (step.id === 'product') {
      return getProductLabel(productSelection) ?? 'Tamamlandı'
    }
    return 'Tamamlandı'
  }
  if (status === 'active') return 'Devam Ediyor'
  return 'Bekliyor'
}

export function SidebarStepList({
  currentStep,
  completedSteps,
  activePlantingSubStep,
  productSelection,
  onSubStepChange,
}: SidebarStepListProps) {
  return (
    <ul className="flex flex-col">
      {SIDEBAR_STEPS.map((step, index) => {
        const status = getStepStatus(step.id, currentStep, completedSteps)
        const isLast = index === SIDEBAR_STEPS.length - 1
        const subtitle = getStepSubtitle(step, status, productSelection)
        const hasSubSteps = status === 'active' && Boolean(step.subSteps)

        return (
          <li key={step.id} className="flex gap-2.5">
            <div className="flex w-6 flex-col items-center self-stretch">
              <StepNumberCircle status={status} order={index + 1} />
              {!isLast && (
                <div
                  className={`my-1.5 w-0.5 flex-1 rounded-full ${
                    status === 'completed'
                      ? 'bg-planning-accent/55'
                      : status === 'active'
                        ? 'bg-planning-accent/25'
                        : 'bg-planning-border'
                  }`}
                />
              )}
            </div>

            <div className={`min-w-0 flex-1 ${isLast ? 'pb-0' : 'pb-4'}`}>
              <div className="flex items-start justify-between gap-2">
                <p
                  className={`text-[11px] font-semibold leading-tight ${
                    status === 'pending'
                      ? 'text-planning-text-dim'
                      : 'text-planning-text'
                  }`}
                >
                  {step.label}
                </p>

                {status === 'completed' && (
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-planning-border bg-planning-surface"
                    aria-hidden
                  >
                    <Check
                      className="h-3 w-3 text-planning-accent"
                      strokeWidth={2.5}
                    />
                  </span>
                )}
              </div>

              <p
                className={`mt-0.5 text-[10px] leading-snug ${
                  status === 'active'
                    ? 'text-planning-accent'
                    : status === 'completed'
                      ? 'text-planning-text-muted'
                      : 'text-planning-text-dim'
                }`}
              >
                {subtitle}
              </p>

              {hasSubSteps && step.subSteps && (
                <ul className="mt-2 space-y-0.5">
                  {step.subSteps.map((sub) => {
                    const isSubActive = activePlantingSubStep === sub.id
                    return (
                      <li key={sub.id}>
                        <button
                          type="button"
                          onClick={() => onSubStepChange(sub.id)}
                          className={`relative w-full rounded-md py-1.5 pl-3 pr-2 text-left text-[10px] leading-snug transition-colors ${
                            isSubActive
                              ? 'bg-planning-accent/12 font-medium text-planning-accent'
                              : 'text-planning-text-muted hover:bg-planning-surface/50 hover:text-planning-text'
                          }`}
                        >
                          <span aria-hidden className="mr-1.5">•</span>
                          {sub.label}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function StepNumberCircle({
  status,
  order,
}: {
  status: StepStatus
  order: number
}) {
  if (status === 'completed' || status === 'active') {
    return (
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-planning-accent text-[11px] font-bold leading-none text-planning-bg"
        aria-hidden
      >
        {order}
      </span>
    )
  }

  return (
    <span
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-planning-border bg-planning-surface text-[11px] font-semibold leading-none text-planning-text-dim"
      aria-hidden
    >
      {order}
    </span>
  )
}
