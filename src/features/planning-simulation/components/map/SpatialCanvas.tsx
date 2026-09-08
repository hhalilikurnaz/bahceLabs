import type { VisualizationMode } from '../../types'
import { EmptyState } from '../shared/DataField'

interface SpatialCanvasProps {
  mode: VisualizationMode
  onModeChange: (mode: VisualizationMode) => void
  hasGeometry: boolean
}

export function SpatialCanvas({
  mode,
  onModeChange,
  hasGeometry,
}: SpatialCanvasProps) {
  return (
    <div className="relative flex-1 overflow-hidden bg-[#0d120d]">
      <div className="absolute left-4 top-4 z-10 flex flex-col gap-1">
        {(['2d', '3d'] as VisualizationMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onModeChange(m)}
            className={`rounded-lg border px-3 py-1.5 text-xs uppercase ${
              mode === m
                ? 'border-planning-accent bg-planning-accent/15 text-planning-accent'
                : 'border-planning-border bg-planning-panel text-planning-text-muted'
            }`}
          >
            {m}
          </button>
        ))}
        <button
          type="button"
          className="rounded-lg border border-planning-border bg-planning-panel px-3 py-1.5 text-xs text-planning-text-muted"
        >
          +
        </button>
        <button
          type="button"
          className="rounded-lg border border-planning-border bg-planning-panel px-3 py-1.5 text-xs text-planning-text-muted"
        >
          −
        </button>
      </div>

      <div className="absolute right-4 top-4 z-10 rounded-lg border border-planning-border bg-planning-panel px-2 py-1 text-[10px] text-planning-text-muted">
        N
      </div>

      <div className="flex h-full items-center justify-center p-8">
        {hasGeometry ? (
          <p className="text-sm text-planning-text-muted">
            Harita görselleştirmesi — MapLibre entegrasyonu B8 aşamasında
          </p>
        ) : (
          <EmptyState
            title="Arazi tanımlanmadı"
            description="Haritada polygon çizerek veya mevcut bahçe seçerek başlayın."
          />
        )}
      </div>
    </div>
  )
}
