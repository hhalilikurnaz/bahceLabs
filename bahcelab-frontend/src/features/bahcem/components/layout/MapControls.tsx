import { useEffect, useRef, useState } from 'react'
import type { Marker } from 'maplibre-gl'
import { loadMapLibre } from '../../map/maplibre'
import { Check, Layers, LocateFixed, Loader2, Minus, Plus } from 'lucide-react'
import { BASEMAPS, BASEMAP_PROVIDERS } from '../../map/mapStyles'
import { useIndexView } from '../../hooks/useIndexView'
import { useMap } from '../../map/useMap'
import { usePanelLayout } from '../../hooks/usePanelLayout'
import { useBahcemStore } from '../../stores/bahcemStore'
import { useToast } from './toastContext'

const controlButton =
  'flex h-11 w-11 items-center justify-center text-app-text-muted transition-colors hover:bg-app-card-hover hover:text-app-text focus-visible:-outline-offset-2 disabled:opacity-50'

function LayerSwitcher() {
  const { basemap, setBasemap, provider, setProvider, providers } = useMap()
  const { gardenId, available, data } = useIndexView()
  const layerVisible = useBahcemStore((s) => s.layerVisible)
  const setLayerVisible = useBahcemStore((s) => s.setLayerVisible)
  const processing = data?.isleme?.durum === 'bekliyor' || data?.isleme?.durum === 'isleniyor'
  const hint = available
    ? 'Seçili bahçenin uydu görüntüsü'
    : !gardenId
      ? 'Bir bahçe seçin'
      : processing
        ? 'Görüntüler işleniyor…'
        : 'Kullanılabilir görüntü yok'
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
        className={`flex h-11 w-11 items-center justify-center rounded-md border border-app-border bg-app-panel shadow-lg transition-colors hover:bg-app-card-hover focus-visible:outline-2 focus-visible:outline-app-accent ${
          open ? 'text-app-accent' : 'text-app-text-muted hover:text-app-text'
        }`}
      >
        <Layers className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute bottom-0 right-full mr-2 w-56 rounded-lg border border-app-border bg-app-panel p-1.5 shadow-e3"
        >
          <p className="px-3 pb-1 pt-2 text-caption font-semibold uppercase tracking-wider text-app-text-dim">
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
              className="flex min-h-11 w-full items-center justify-between rounded-sm px-3 text-body text-app-text transition-colors hover:bg-app-card-hover"
            >
              {option.label}
              {basemap === option.id && <Check className="h-4 w-4 text-app-accent" aria-hidden />}
            </button>
          ))}
          {providers.length > 1 && (
            <>
              <div className="my-1 h-px bg-app-border" />
              <p className="px-3 pb-1 pt-1 text-caption font-semibold uppercase tracking-wider text-app-text-dim">
                Altlık sağlayıcı
              </p>
              {BASEMAP_PROVIDERS.filter((p) => providers.includes(p.id)).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={provider === option.id}
                  onClick={() => setProvider(option.id)}
                  className="flex min-h-11 w-full items-center justify-between rounded-sm px-3 text-left text-body text-app-text transition-colors hover:bg-app-card-hover"
                >
                  <span>
                    {option.label}
                    <span className="block text-caption text-app-text-dim">{option.hint}</span>
                  </span>
                  {provider === option.id && <Check className="h-4 w-4 text-app-accent" aria-hidden />}
                </button>
              ))}
            </>
          )}
          <div className="my-1 h-px bg-app-border" />
          <p className="px-3 pb-1 pt-1 text-caption font-semibold uppercase tracking-wider text-app-text-dim">
            Bahçe katmanı
          </p>
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={available && layerVisible}
            disabled={!available}
            onClick={() => setLayerVisible(!layerVisible)}
            className={`flex min-h-11 w-full items-center justify-between rounded-sm px-3 text-left text-body transition-colors ${
              available ? 'text-app-text hover:bg-app-card' : 'cursor-not-allowed text-app-text-dim'
            }`}
          >
            <span>
              Göster
              <span className="block text-caption text-app-text-dim">{hint}</span>
            </span>
            {available && layerVisible && <Check className="h-4 w-4 text-app-accent" aria-hidden />}
          </button>
        </div>
      )}
    </div>
  )
}

export function MapControls() {
  const { map } = useMap()
  const { listOpen, detailOpen } = usePanelLayout()
  const panelOpen = listOpen || detailOpen
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
      async ({ coords }) => {
        setLocating(false)
        const center: [number, number] = [coords.longitude, coords.latitude]
        const dot = document.createElement('div')
        dot.className = 'h-4 w-4 rounded-full border-2 border-white bg-app-accent shadow-[0_0_0_6px_rgb(124_198_90/0.3)]'
        markerRef.current?.remove()
        const { Marker: MarkerClass } = await loadMapLibre()
        markerRef.current = new MarkerClass({ element: dot }).setLngLat(center).addTo(map)
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
      className={`surface-dark absolute bottom-14 right-[var(--map-right)] z-20 flex-col items-end gap-2 transition-[right] duration-[var(--duration-panel)] ease-[var(--ease-out-soft)] ${
        panelOpen ? 'hidden md:flex' : 'flex'
      }`}
    >
      <LayerSwitcher />

      <button
        type="button"
        aria-label="Konumuma git"
        onClick={locate}
        disabled={!map || locating}
        className="flex h-11 w-11 items-center justify-center rounded-md border border-app-border bg-app-panel text-app-text-muted shadow-lg transition-colors hover:bg-app-card-hover hover:text-app-text focus-visible:outline-2 focus-visible:outline-app-accent disabled:opacity-60"
      >
        {locating ? (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        ) : (
          <LocateFixed className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        )}
      </button>

      <div className="flex flex-col divide-y divide-app-border overflow-hidden rounded-md border border-app-border bg-app-panel shadow-e2">
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
