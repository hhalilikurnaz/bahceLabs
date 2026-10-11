import { useEffect, useRef, useState } from 'react'
import { FileUp, PencilRuler, Plus } from 'lucide-react'
import { Button } from '@/components/ui'
import { useGardenNav } from '../../hooks/useGardenNav'
import { geometryBounds, unionBounds } from '../../lib/geo'
import { ImportError, parseGardenFile } from '../../lib/importFile'
import { useFocusPadding } from '../../map/useFocusGarden'
import { useMap } from '../../map/useMap'
import { useBahcemStore } from '../../stores/bahcemStore'
import { useToast } from '../layout/toastContext'

interface AddGardenMenuProps {
  /** "primary": limon birincil düğme (boş durum); "compact": liste başlığındaki ikincil düğme */
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
  const nav = useGardenNav()

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
        const all = unionBounds(polygons.map((p) => geometryBounds(p.geometry)))
        if (all) map?.fitBounds(all, { padding: padding(), maxZoom: 17, duration: 1000 })
        startImportPick(polygons)
      }
    } catch (err) {
      toast.show(err instanceof ImportError ? err.message : 'Dosya okunamadı. Başka bir dosya deneyin.')
    } finally {
      setReading(false)
    }
  }

  const item =
    'flex min-h-11 w-full items-start gap-3 rounded-sm px-3 py-2 text-left transition-colors hover:bg-app-card-hover focus-visible:bg-app-card-hover disabled:opacity-50'

  return (
    <div ref={rootRef} className="relative inline-block">
      <Button
        variant={variant === 'primary' ? 'primary' : 'secondary'}
        onClick={() => setOpen((v) => !v)}
        disabled={busy || reading}
        aria-haspopup="menu"
        aria-expanded={open}
        icon={<Plus className="h-4 w-4" strokeWidth={2.25} aria-hidden />}
      >
        {reading ? 'Dosya okunuyor…' : 'Bahçe ekle'}
      </Button>

      {open && (
        <div
          role="menu"
          className={`absolute z-30 mt-2 w-72 rounded-md border border-app-border bg-app-panel p-1.5 shadow-e3 ${
            variant === 'primary' ? 'left-0' : 'right-0'
          }`}
        >
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => {
              setOpen(false)
              nav.close() // çizim, bahçe listesi görünümünde başlar
              startDrawing()
            }}
          >
            <PencilRuler className="mt-0.5 h-4 w-4 shrink-0 text-app-accent" aria-hidden />
            <span>
              <span className="block text-body font-semibold text-app-text">Haritada çiz</span>
              <span className="block text-caption text-app-text-muted">Sınırı uydu görüntüsü üzerinde çizin</span>
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
              <span className="block text-body font-semibold text-app-text">Dosya yükle</span>
              <span className="block text-caption text-app-text-muted">KML, KMZ, GeoJSON</span>
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
