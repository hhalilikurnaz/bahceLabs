import {
  BarChart3,
  ChevronRight,
  Droplets,
  LayoutGrid,
  Leaf,
  MapPinned,
  MoreHorizontal,
  Pencil,
  Play,
  Share2,
} from 'lucide-react'
import { PLANNING_STEPS } from '../../constants/planningSteps'
import type { PlanningStepId, SimulationPlan } from '../../types'

interface PlanningNavbarProps {
  plan: SimulationPlan
  currentStep: PlanningStepId
  completedSteps: PlanningStepId[]
  onStepClick?: (step: PlanningStepId) => void
}

const STEP_ICONS = {
  land: MapPinned,
  product: Leaf,
  planting: LayoutGrid,
  maintenance: Droplets,
  simulation: BarChart3,
} as const

function formatArea(areaM2: number | null): string | null {
  if (areaM2 === null) return null
  return `${(areaM2 / 10_000).toFixed(2)} ha`
}

function HeaderField({
  label,
  value,
  editable,
}: {
  label: string
  value: string | null
  editable?: boolean
}) {
  return (
    <div className="min-w-[108px] rounded-lg border border-planning-border bg-planning-card px-3 py-1.5">
      <p className="text-[9px] uppercase tracking-[0.12em] text-planning-text-dim">
        {label}
      </p>
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <p className="truncate text-[12px] font-medium text-planning-text">
          {value ?? '—'}
        </p>
        {editable && (
          <Pencil
            className="h-3 w-3 shrink-0 text-planning-text-dim"
            strokeWidth={1.75}
          />
        )}
      </div>
    </div>
  )
}

function StepArrow() {
  return (
    <span
      className="flex shrink-0 items-center px-2.5 text-planning-text-dim/50"
      aria-hidden
    >
      <span className="h-px w-8 bg-current opacity-70" />
      <ChevronRight className="-ml-1 h-3 w-3" strokeWidth={1.5} />
    </span>
  )
}

export function PlanningNavbar({
  plan,
  currentStep,
  completedSteps,
  onStepClick,
}: PlanningNavbarProps) {
  const area = formatArea(plan.draftLand.areaM2)

  return (
    <header className="shrink-0 rounded-xl border border-planning-border bg-planning-panel">
      {/* Üst satır: başlık + bahçe meta */}
      <div className="flex items-center justify-between gap-4 px-5 py-2.5">
        <div className="min-w-0">
          <h1 className="text-[15px] font-bold tracking-[0.05em] text-planning-text">
            DİJİTAL BAHÇE PLANLAMA &amp; SİMÜLASYON
          </h1>
          <p className="mt-0.5 text-[10px] text-planning-text-muted">
            Boş araziden hasada kadar akıllı planlama, dikim, bakım ve sonuç
            simülasyonu.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <HeaderField label="Bahçe Adı" value={plan.name} editable />
          <HeaderField label="Alan" value={area} />

          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-planning-border bg-planning-card text-planning-text-muted transition-colors hover:text-planning-text"
            aria-label="Paylaş"
          >
            <Share2 className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-planning-border bg-planning-card text-planning-text-muted transition-colors hover:text-planning-text"
            aria-label="Daha fazla"
          >
            <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Alt satır: stepper + simülasyon butonu */}
      <div className="flex items-center justify-between gap-4 border-t border-planning-border-subtle px-5 py-2">
        <nav className="flex min-w-0 flex-1 items-center overflow-x-auto">
          {PLANNING_STEPS.map((step, index) => {
            const isActive = step.id === currentStep
            const isCompleted = completedSteps.includes(step.id)
            const isLast = index === PLANNING_STEPS.length - 1
            const Icon = STEP_ICONS[step.id]

            return (
              <div key={step.id} className="flex items-center">
                <button
                  type="button"
                  onClick={() => onStepClick?.(step.id)}
                  className="flex items-center gap-2 rounded-lg px-1 py-0.5 transition-colors hover:bg-planning-card/60"
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${
                      isCompleted || isActive
                        ? 'border-planning-accent bg-planning-accent/10 text-planning-accent'
                        : 'border-planning-border bg-planning-surface text-planning-text-dim'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </span>

                  <span className="text-left">
                    <span
                      className={`block text-[11px] font-semibold leading-tight ${
                        isActive
                          ? 'text-planning-accent'
                          : isCompleted
                            ? 'text-planning-text'
                            : 'text-planning-text-dim'
                      }`}
                    >
                      {step.order}. {step.label}
                    </span>
                    <span className="block text-[9px] leading-tight text-planning-text-dim">
                      {step.description}
                    </span>
                  </span>
                </button>

                {!isLast && <StepArrow />}
              </div>
            )
          })}
        </nav>

        <button
          type="button"
          className="flex shrink-0 items-stretch overflow-hidden rounded-lg border border-planning-accent/80 bg-planning-card text-planning-accent transition-colors hover:bg-planning-accent/10"
        >
          <span className="flex items-center px-3 py-1.5 text-[11px] font-semibold">
            Simülasyonu Başlat
          </span>
          <span className="flex items-center border-l border-planning-accent/50 bg-planning-accent/10 px-2.5">
            <Play className="h-3.5 w-3.5 fill-current" />
          </span>
        </button>
      </div>
    </header>
  )
}
