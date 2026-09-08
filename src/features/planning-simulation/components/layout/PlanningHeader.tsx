import type { SimulationPlan } from '../../types'
import { DataField } from '../shared/DataField'

interface PlanningHeaderProps {
  plan: SimulationPlan
}

function formatArea(areaM2: number | null): string | null {
  if (areaM2 === null) return null
  return `${(areaM2 / 10_000).toFixed(2)} ha`
}

export function PlanningHeader({ plan }: PlanningHeaderProps) {
  const area = formatArea(plan.draftLand.areaM2)

  return (
    <header className="flex items-start justify-between gap-4 border-b border-planning-border px-6 py-4">
      <div>
        <h1 className="text-sm font-semibold tracking-wide text-planning-text">
          DİJİTAL BAHÇE PLANLAMA &amp; SİMÜLASYON
        </h1>
        <p className="mt-1 text-xs text-planning-text-muted">
          Boş araziden hasada kadar akıllı planlama, dikim, bakım ve sonuç
          simülasyonu.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-planning-text-dim">
            Bahçe Adı
          </p>
          <p className="text-sm font-medium">{plan.name}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-planning-text-dim">
            Alan
          </p>
          <DataField
            label=""
            value={area}
            availability={area ? 'available' : 'no_data'}
          />
        </div>
        <button
          type="button"
          className="rounded-lg border border-planning-border px-3 py-2 text-xs text-planning-text-muted"
          aria-label="Paylaş"
        >
          Paylaş
        </button>
        <button
          type="button"
          className="rounded-lg border border-planning-border px-3 py-2 text-xs text-planning-text-muted"
          aria-label="Daha fazla"
        >
          ⋯
        </button>
        <button
          type="button"
          className="rounded-lg bg-planning-accent px-4 py-2 text-xs font-semibold text-planning-bg"
        >
          ▶ Simülasyonu Başlat
        </button>
      </div>
    </header>
  )
}
