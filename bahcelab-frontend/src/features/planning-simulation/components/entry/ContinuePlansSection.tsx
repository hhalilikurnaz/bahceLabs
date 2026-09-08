import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Loader2 } from 'lucide-react'
import { isPlanningApiMock } from '../../api/config'
import { planningApiReal } from '../../api/planningApi.real'
import { PLANNING_STEPS } from '../../constants/planningSteps'
import type { SimulationPlan, SimulationPlanStatus } from '../../types'

const STATUS_LABELS: Record<SimulationPlanStatus, string> = {
  draft: 'Taslak',
  saved: 'Kaydedildi',
  applied: 'Uygulandı',
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function getStepLabel(stepId: SimulationPlan['currentStep']): string {
  const step = PLANNING_STEPS.find((item) => item.id === stepId)
  if (!step) return stepId
  return `${step.order}. ${step.label}`
}

interface PlanRowProps {
  plan: SimulationPlan
}

function PlanRow({ plan }: PlanRowProps) {
  const navigate = useNavigate()

  return (
    <button
      type="button"
      onClick={() => navigate(`/planning/${plan.id}`)}
      className="group flex h-full w-full flex-1 items-center gap-3 border-b border-planning-border-subtle px-4 py-4 text-left transition-colors last:border-b-0 hover:bg-planning-surface/50 sm:px-5"
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[14px] font-medium text-planning-text">
            {plan.name}
          </span>
          <span className="shrink-0 rounded border border-planning-border bg-planning-bg px-1.5 py-0.5 text-[10px] font-medium text-planning-text-muted">
            {STATUS_LABELS[plan.status]}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-[12px] text-planning-text-muted">
          {getStepLabel(plan.currentStep)} · {formatUpdatedAt(plan.updatedAt)}
        </span>
      </span>

      <ChevronRight
        className="h-4 w-4 shrink-0 text-planning-text-dim transition-colors group-hover:text-planning-accent"
        strokeWidth={1.75}
        aria-hidden
      />
    </button>
  )
}

function SectionShell({ children }: { children: ReactNode }) {
  return (
    <section
      aria-labelledby="continue-plans-heading"
      className="flex h-full flex-col overflow-hidden rounded-xl border border-planning-border bg-planning-card shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_12px_40px_rgba(0,0,0,0.18)]"
    >
      <div className="border-b border-planning-border-subtle bg-planning-panel/50 px-4 py-3.5 sm:px-5">
        <h2
          id="continue-plans-heading"
          className="text-[14px] font-semibold text-planning-text"
        >
          Kaldığınız yerden devam edin
        </h2>
        <p className="mt-1 text-[12px] text-planning-text-muted">
          Kayıtlı planlarınız listelenir.
        </p>
      </div>
      {children}
    </section>
  )
}

function SectionMessage({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 py-3.5 sm:px-5">
      <p className="text-[13px] leading-relaxed text-planning-text-muted">
        {children}
      </p>
    </div>
  )
}

export function ContinuePlansSection() {
  const useMock = isPlanningApiMock()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['planning', 'plans', 'real'],
    queryFn: () => planningApiReal.listPlans(),
    enabled: !useMock,
  })

  if (useMock) {
    return (
      <SectionShell>
        <SectionMessage>
          Plan geçmişi canlı API modunda gösterilir (
          <code className="rounded bg-planning-bg px-1 py-0.5 text-[12px] text-planning-text-dim">
            VITE_PLANNING_API_MODE=real
          </code>
          ).
        </SectionMessage>
      </SectionShell>
    )
  }

  if (isLoading) {
    return (
      <SectionShell>
        <div className="flex items-center gap-2 px-4 py-3.5 text-[13px] text-planning-text-muted sm:px-5">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Planlar yükleniyor...
        </div>
      </SectionShell>
    )
  }

  if (isError) {
    return (
      <SectionShell>
        <SectionMessage>
          <span className="text-planning-error">
            Plan listesi alınamadı. Backend servisinin çalıştığından emin olun.
          </span>
        </SectionMessage>
      </SectionShell>
    )
  }

  const plans = [...(data ?? [])]
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    .slice(0, 4)

  if (plans.length === 0) {
    return (
      <SectionShell>
        <SectionMessage>Henüz kayıtlı plan bulunmuyor.</SectionMessage>
      </SectionShell>
    )
  }

  return (
    <SectionShell>
      <ul className="flex min-h-0 flex-1 flex-col">
        {plans.map((plan) => (
          <li key={plan.id} className="flex flex-1 flex-col">
            <PlanRow plan={plan} />
          </li>
        ))}
      </ul>
    </SectionShell>
  )
}
