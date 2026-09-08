import { Crosshair, Globe, Minus, Plus } from 'lucide-react'
import type { VisualizationMode } from '../../types'

interface MapControlsProps {
  mode: VisualizationMode
  onModeChange: (mode: VisualizationMode) => void
}

export function MapControls({ mode, onModeChange }: MapControlsProps) {
  return (
    <div className="absolute left-4 top-4 z-20 flex flex-col gap-1">
      {(['2d', '3d'] as VisualizationMode[]).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onModeChange(m)}
          aria-label={`${m.toUpperCase()} görünüm`}
          className={`flex h-9 w-9 items-center justify-center rounded-lg border text-[11px] font-semibold uppercase transition-colors ${
            mode === m
              ? 'border-planning-accent bg-planning-accent/15 text-planning-accent'
              : 'border-planning-border bg-planning-card/90 text-planning-text-muted hover:text-planning-text'
          }`}
        >
          {m}
        </button>
      ))}

      <button
        type="button"
        aria-label="Küre görünümü"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-planning-border bg-planning-card/90 text-planning-text-muted hover:text-planning-text"
      >
        <Globe className="h-4 w-4" strokeWidth={1.75} />
      </button>

      <button
        type="button"
        aria-label="Merkeze al"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-planning-border bg-planning-card/90 text-planning-text-muted hover:text-planning-text"
      >
        <Crosshair className="h-4 w-4" strokeWidth={1.75} />
      </button>

      <button
        type="button"
        aria-label="Yakınlaştır"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-planning-border bg-planning-card/90 text-planning-text-muted hover:text-planning-text"
      >
        <Plus className="h-4 w-4" strokeWidth={1.75} />
      </button>

      <button
        type="button"
        aria-label="Uzaklaştır"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-planning-border bg-planning-card/90 text-planning-text-muted hover:text-planning-text"
      >
        <Minus className="h-4 w-4" strokeWidth={1.75} />
      </button>
    </div>
  )
}
