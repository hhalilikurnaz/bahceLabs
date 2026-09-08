import type { SimulationPlan } from '../../types'

interface PlanningHeaderProps {
  plan: SimulationPlan
}

function formatArea(areaM2: number | null): string | null {
  if (areaM2 === null) return null
  return `${(areaM2 / 10_000).toFixed(2)} ha`
}

function HeaderMeta({
  label,
  value,
}: {
  label: string
  value: string | null
}) {
  return (
    <div className="rounded-md border border-planning-border bg-planning-card px-2.5 py-1 text-right">
      <p className="text-[9px] uppercase tracking-[0.1em] text-planning-text-dim">
        {label}
      </p>
      <p className="text-[12px] font-medium leading-tight text-planning-text">
        {value ?? '—'}
      </p>
    </div>
  )
}

export function PlanningHeader({ plan }: PlanningHeaderProps) {
  const area = formatArea(plan.draftLand.areaM2)

  return (
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-planning-border bg-planning-panel px-4 py-2">
      <div className="min-w-0">
        <h1 className="text-[12px] font-semibold tracking-wide text-planning-text">
          DİJİTAL BAHÇE PLANLAMA &amp; SİMÜLASYON
        </h1>
        <p className="mt-0.5 truncate text-[10px] text-planning-text-muted">
          Boş araziden hasada kadar akıllı planlama, dikim, bakım ve sonuç
          simülasyonu.
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <HeaderMeta label="Bahçe Adı" value={plan.name} />
        <HeaderMeta label="Alan" value={area} />

        <button
          type="button"
          className="rounded-md border border-planning-border bg-planning-card px-2 py-1 text-[10px] text-planning-text-muted transition-colors hover:text-planning-text"
          aria-label="Paylaş"
        >
          Paylaş
        </button>
        <button
          type="button"
          className="rounded-md border border-planning-border bg-planning-card px-2 py-1 text-[10px] text-planning-text-muted transition-colors hover:text-planning-text"
          aria-label="Daha fazla"
        >
          ⋯
        </button>
        <button
          type="button"
          className="rounded-md bg-planning-accent px-3 py-1.5 text-[10px] font-semibold text-planning-bg shadow-[0_0_12px_rgba(146,196,100,0.2)]"
        >
          ▶ Simülasyonu Başlat
        </button>
      </div>
    </header>
  )
}
