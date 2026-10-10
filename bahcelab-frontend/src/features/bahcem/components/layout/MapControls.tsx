import { useEffect, useRef, useState } from 'react'
import { Marker } from 'maplibre-gl'
import { Check, Layers, LocateFixed, Loader2, Minus, Plus } from 'lucide-react'
import { BASEMAPS } from '../../map/mapStyles'
import { useMap } from '../../map/useMap'
import { useBahcemStore } from '../../stores/bahcemStore'
import { useToast } from './toastContext'

const controlButton =
  'flex h-10 w-10 items-center justify-center text-app-text-muted transition-colors hover:bg-app-card-hover hover:text-app-text focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-app-accent disabled:opacity-50'

function LayerSwitcher() {
  const { basemap, setBasemap } = useMap()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Katmanlar"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex h-10 w-10 items-center justify-center rounded-xl border border-app-border bg-app-panel shadow-lg transition-colors hover:bg-app-card-hover focus-visible:outline-2 focus-visible:outline-app-accent ${
          open ? 'text-app-accent' : 'text-app-text-muted hover:text-app-text'
        }`}
      >
        <Layers className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute bottom-0 right-full mr-2 w-56 rounded-2xl border border-app-border bg-app-panel p-1.5 shadow-2xl"
        >
          <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-app-text-dim">
            Harita katmanı
          </p>
          {BASEMAPS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="menuitemradio"
              aria-checked={basemap === option.id}
              onClick={() => {
                setBasemap(option.id)
                setOpen(false)
              }}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-[13px] text-app-text transition-colors hover:bg-app-card"
            >
              {option.label}
              {basemap === option.id && <Check className="h-4 w-4 text-app-accent" aria-hidden />}
            </button>
          ))}
          <div className="my-1 h-px bg-app-border" />
          <button
            type="button"
            role="menuitemradio"
            aria-checked={false}
            disabled
            className="flex w-full cursor-not-allowed items-center justify-between rounded-xl px-3 py-2 text-left text-[13px] text-app-text-dim"
          >
            <span>
              NDVI
              <span className="block text-[11px]">Bahçe ekleyince</span>
            </span>
          </button>
        </div>
      )}
    </div>
  )
}

export function MapControls() {
  const { map } = useMap()
  const copilotOpen = useBahcemStore((s) => s.copilotOpen)
  const toast = useToast()
  const [locating, setLocating] = useState(false)
  const markerRef = useRef<Marker | null>(null)

  useEffect(() => () => void markerRef.current?.remove(), [])

  function locate() {
    if (!map) return
    if (!('geolocation' in navigator)) {
      toast.show('Tarayıcınız konum özelliğini desteklemiyor.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false)
        const center: [number, number] = [coords.longitude, coords.latitude]
        const dot = document.createElement('div')
        dot.className = 'h-4 w-4 rounded-full border-2 border-white bg-app-accent shadow-[0_0_0_6px_rgb(124_198_90/0.3)]'
        markerRef.current?.remove()
        markerRef.current = new Marker({ element: dot }).setLngLat(center).addTo(map)
        map.flyTo({ center, zoom: Math.max(map.getZoom(), 15), duration: 1600 })
      },
      (err) => {
        setLocating(false)
        toast.show(
          err.code === err.PERMISSION_DENIED
            ? 'Konum izni verilmedi. Tarayıcı ayarlarından izin verebilirsiniz.'
            : 'Konumunuz alınamadı.',
        )
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  return (
    <div
      className={`absolute bottom-12 z-20 flex flex-col items-end gap-2 transition-[right] duration-300 ease-out ${
        copilotOpen ? 'right-3 md:right-[calc(380px+0.75rem)]' : 'right-3'
      }`}
    >
      <LayerSwitcher />

      <button
        type="button"
        aria-label="Konumuma git"
        onClick={locate}
        disabled={!map || locating}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-app-border bg-app-panel text-app-text-muted shadow-lg transition-colors hover:bg-app-card-hover hover:text-app-text focus-visible:outline-2 focus-visible:outline-app-accent disabled:opacity-60"
      >
        {locating ? (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        ) : (
          <LocateFixed className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        )}
      </button>

      <div className="flex flex-col divide-y divide-app-border overflow-hidden rounded-xl border border-app-border bg-app-panel shadow-lg">
        <button type="button" aria-label="Yakınlaştır" onClick={() => map?.zoomIn()} className={controlButton}>
          <Plus className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        </button>
        <button type="button" aria-label="Uzaklaştır" onClick={() => map?.zoomOut()} className={controlButton}>
          <Minus className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        </button>
      </div>
    </div>
  )
}
