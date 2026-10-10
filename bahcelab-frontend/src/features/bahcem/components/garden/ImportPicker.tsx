import { ArrowLeft } from 'lucide-react'
import { formatDecare } from '../../lib/geo'
import { useBahcemStore } from '../../stores/bahcemStore'
import { useMap } from '../../map/useMap'
import { geometryBounds } from '../../lib/geo'
import { useFocusPadding } from '../../map/useFocusGarden'

/** Dosyada birden fazla poligon varsa hangisinin bahçe olacağını seçtirir. */
export function ImportPicker() {
  const { map } = useMap()
  const padding = useFocusPadding()
  const imported = useBahcemStore((s) => s.imported)
  const resetFlow = useBahcemStore((s) => s.resetFlow)
  const openForm = useBahcemStore((s) => s.openForm)
  const previewDraft = useBahcemStore((s) => s.previewDraft)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-app-border px-3 py-3">
        <button
          type="button"
          onClick={resetFlow}
          aria-label="Vazgeç ve listeye dön"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-app-text-muted transition-colors hover:bg-app-card hover:text-app-text"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </button>
        <h2 className="text-[15px] font-semibold text-app-text">Poligon seçin</h2>
      </div>

      <p className="px-4 pt-3 text-[13px] leading-relaxed text-app-text-muted">
        Dosyada {imported.length} poligon bulundu. Bahçe olarak eklemek istediğinizi seçin; üzerine gelince
        haritada görürsünüz. Alanlar yaklaşıktır, kayıtta sunucu yeniden hesaplar.
      </p>

      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {imported.map((polygon) => (
          <li key={polygon.id}>
            <button
              type="button"
              onMouseEnter={() => {
                previewDraft({ geometry: polygon.geometry, source: 'file' })
                map?.fitBounds(geometryBounds(polygon.geometry), { padding: padding(), maxZoom: 18, duration: 600 })
              }}
              onFocus={() => previewDraft({ geometry: polygon.geometry, source: 'file' })}
              onClick={() =>
                openForm({ geometry: polygon.geometry, source: 'file', suggestedName: polygon.name })
              }
              className="flex w-full items-center justify-between gap-3 rounded-xl bg-app-card px-3.5 py-3 text-left transition-colors hover:bg-app-card-hover focus-visible:outline-2 focus-visible:outline-app-accent"
            >
              <span className="min-w-0 truncate text-[14px] font-medium text-app-text">{polygon.name}</span>
              <span className="shrink-0 text-[12px] text-app-text-muted">≈ {formatDecare(polygon.areaDekar)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
