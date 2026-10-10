import { useEffect, useRef, useState } from 'react'
import { FileUp, PencilRuler, Plus } from 'lucide-react'
import { geometryBounds } from '../../lib/geo'
import { ImportError, parseGardenFile } from '../../lib/importFile'
import { useFocusPadding } from '../../map/useFocusGarden'
import { useMap } from '../../map/useMap'
import { useBahcemStore } from '../../stores/bahcemStore'
import { useToast } from '../layout/toastContext'

interface AddGardenMenuProps {
  /** "primary": dolu yeşil düğme (boş durum); "compact": liste başlığındaki küçük düğme */
  variant?: 'primary' | 'compact'
}

export function AddGardenMenu({ variant = 'primary' }: AddGardenMenuProps) {
  const { map } = useMap()
  const toast = useToast()
  const padding = useFocusPadding()
  const startDrawing = useBahcemStore((s) => s.startDrawing)
  const startImportPick = useBahcemStore((s) => s.startImportPick)
  const openForm = useBahcemStore((s) => s.openForm)
  const busy = useBahcemStore((s) => s.mode !== 'idle')

  const [open, setOpen] = useState(false)
  const [reading, setReading] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function handleFile(file: File) {
    setReading(true)
    try {
      const polygons = await parseGardenFile(file)
      if (polygons.length === 1) {
        const only = polygons[0]
        map?.fitBounds(geometryBounds(only.geometry), { padding: padding(), maxZoom: 18, duration: 1000 })
        openForm({ geometry: only.geometry, source: 'file', suggestedName: only.name })
      } else {
        startImportPick(polygons)
      }
    } catch (err) {
      toast.show(err instanceof ImportError ? err.message : 'Dosya okunamadı. Başka bir dosya deneyin.')
    } finally {
      setReading(false)
    }
  }

  const trigger =
    variant === 'primary'
      ? 'h-10 gap-2 bg-app-accent px-4 text-[14px] font-semibold text-app-bg hover:bg-app-accent-strong'
      : 'h-9 gap-1.5 border border-app-border bg-app-card px-3 text-[13px] font-medium text-app-text hover:bg-app-card-hover'

  const item =
    'flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-app-card disabled:opacity-50'

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy || reading}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`inline-flex items-center justify-center rounded-xl transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent disabled:cursor-not-allowed disabled:opacity-60 ${trigger}`}
      >
        <Plus className="h-4 w-4" strokeWidth={2.25} aria-hidden />
        {reading ? 'Dosya okunuyor…' : 'Bahçe ekle'}
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute z-30 mt-2 w-72 rounded-2xl border border-app-border bg-app-panel p-1.5 shadow-2xl ${
            variant === 'primary' ? 'left-1/2 -translate-x-1/2' : 'right-0'
          }`}
        >
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => {
              setOpen(false)
              startDrawing()
            }}
          >
            <PencilRuler className="mt-0.5 h-4 w-4 shrink-0 text-app-accent" aria-hidden />
            <span>
              <span className="block text-[14px] font-medium text-app-text">Haritada çiz</span>
              <span className="block text-[12px] text-app-text-muted">Sınırı uydu görüntüsü üzerinde çizin</span>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => {
              setOpen(false)
              fileRef.current?.click()
            }}
          >
            <FileUp className="mt-0.5 h-4 w-4 shrink-0 text-app-accent" aria-hidden />
            <span>
              <span className="block text-[14px] font-medium text-app-text">Dosya yükle</span>
              <span className="block text-[12px] text-app-text-muted">KML, KMZ, GeoJSON</span>
            </span>
          </button>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".kml,.kmz,.geojson,.json,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz,application/geo+json"
        className="sr-only"
        tabIndex={-1}
        aria-label="Bahçe dosyası seç"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = '' // aynı dosya tekrar seçilebilsin
          if (file) void handleFile(file)
        }}
      />
    </div>
  )
}
