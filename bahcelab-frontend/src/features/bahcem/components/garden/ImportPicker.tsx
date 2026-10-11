import { ArrowLeft } from 'lucide-react'
import { IconButton } from '@/components/ui'
import { formatDecare } from '../../lib/geo'
import { useBahcemStore } from '../../stores/bahcemStore'

/** Dosyada birden fazla poligon varsa hangisinin bahçe olacağını seçtirir. */
export function ImportPicker() {
  const imported = useBahcemStore((s) => s.imported)
  const resetFlow = useBahcemStore((s) => s.resetFlow)
  const openForm = useBahcemStore((s) => s.openForm)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-app-border px-3 py-3">
        <IconButton label="Vazgeç ve listeye dön" onClick={resetFlow}>
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </IconButton>
        <h2 className="font-display text-h2 text-app-text">Poligon seçin</h2>
      </div>

      <p className="px-4 pt-3 text-body text-app-text-muted">
        Dosyada {imported.length} poligon bulundu. Bahçe olarak eklemek istediğinizi seçin; poligonlar haritada kesikli çizgiyle görünür. Alanlar
        yaklaşıktır, kayıtta sunucu yeniden hesaplar.
      </p>

      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {imported.map((polygon) => (
          <li key={polygon.id}>
            <button
              type="button"
              onClick={() => openForm({ geometry: polygon.geometry, source: 'file', suggestedName: polygon.name })}
              className="flex min-h-14 w-full items-center justify-between gap-3 rounded-md border border-app-border bg-app-card px-4 text-left transition-colors hover:bg-app-card-hover"
            >
              <span className="min-w-0 truncate text-body font-semibold text-app-text">{polygon.name}</span>
              <span className="tabular shrink-0 text-small text-app-text-muted">≈ {formatDecare(polygon.areaDekar)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
