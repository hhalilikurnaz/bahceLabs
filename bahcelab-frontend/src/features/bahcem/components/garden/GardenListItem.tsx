import { formatDecare, silhouettePath, type Ring } from '../../lib/geo'

export interface GardenListEntry {
  id: string
  name: string
  areaM2: number | null
  /** Dış halka, [boylam, enlem] */
  ring?: Ring
  /** Son geçerli NDVI ortalaması (Adım 5); yoksa null */
  ndvi?: number | null
}

interface GardenListItemProps {
  garden: GardenListEntry
  selected?: boolean
  onSelect?: (id: string) => void
}

function NdviBadge({ value }: { value: number | null | undefined }) {
  if (value == null) {
    return (
      <span className="rounded-md bg-app-bg/60 px-2 py-0.5 text-[11px] font-medium text-app-text-dim">
        NDVI —
      </span>
    )
  }
  return (
    <span className="rounded-md bg-app-accent-soft px-2 py-0.5 text-[11px] font-semibold text-app-accent">
      NDVI {value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  )
}

export function GardenListItem({ garden, selected = false, onSelect }: GardenListItemProps) {
  const path = garden.ring ? silhouettePath(garden.ring) : ''

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect?.(garden.id)}
        aria-current={selected}
        className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-app-accent ${
          selected
            ? 'border-app-accent/50 bg-app-card-hover'
            : 'border-transparent bg-app-card hover:bg-app-card-hover'
        }`}
      >
        <svg viewBox="0 0 40 40" className="h-12 w-12 shrink-0 rounded-lg bg-app-bg/70" aria-hidden>
          {path && (
            <path d={path} className="fill-app-accent/25 stroke-app-accent" strokeWidth={1.5} strokeLinejoin="round" />
          )}
        </svg>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-medium text-app-text">{garden.name}</span>
          <span className="mt-1 flex items-center gap-2">
            <span className="text-[12px] text-app-text-muted">{formatDecare(garden.areaM2)}</span>
            <NdviBadge value={garden.ndvi} />
          </span>
        </span>
      </button>
    </li>
  )
}
