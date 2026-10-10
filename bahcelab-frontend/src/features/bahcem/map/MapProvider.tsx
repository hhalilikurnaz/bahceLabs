import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AttributionControl, Map as MapLibreMap, setWorkerUrl } from 'maplibre-gl'
// Worker dosyası paketlenirken otomatik bulunamaz; Vite'a varlık olarak yayımlatıp adresini veriyoruz
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import 'maplibre-gl/dist/maplibre-gl.css'
import { MapContext } from './MapContext'
import { buildStyle, getMaptilerKey, type BasemapId } from './mapStyles'
import { loadView, saveView } from './viewStorage'

setWorkerUrl(workerUrl)

interface MapProviderProps {
  /** Konum ve altlık seçimi kullanıcı bazında saklanır */
  userId: string
  children: ReactNode
}

/**
 * Tek harita örneğini yönetir: tam ekran kapsayıcıyı çizer, çocuklar üstüne yüzer.
 * Sonraki adımlar `useMap()` ile haritaya katman ve çizim ekler.
 */
export function MapProvider({ userId, children }: MapProviderProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const [initialView] = useState(() => loadView(userId))
  const basemapRef = useRef<BasemapId>(initialView.basemap)

  const [map, setMap] = useState<MapLibreMap | null>(null)
  const [basemap, setBasemapState] = useState<BasemapId>(initialView.basemap)
  // 'style.load' sayacı harita örneğine bağlı tutulur; yeni harita 0'dan başlar
  const [styleLoads, setStyleLoads] = useState<{ map: MapLibreMap | null; n: number }>({
    map: null,
    n: 0,
  })
  const styleVersion = styleLoads.map !== null && styleLoads.map === map ? styleLoads.n : 0
  const usingFallback = !getMaptilerKey()

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const view = initialView
    const instance = new MapLibreMap({
      container,
      style: buildStyle(view.basemap),
      center: view.center,
      zoom: view.zoom,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    })
    instance.touchZoomRotate.disableRotation()
    // Sol alt köşe ikon şeridi ve panelle çakışmaması için sağ altta
    instance.addControl(new AttributionControl({ compact: true }), 'bottom-right')

    let saveTimer: number | undefined
    const persist = () => {
      window.clearTimeout(saveTimer)
      saveTimer = window.setTimeout(() => {
        const { lng, lat } = instance.getCenter()
        saveView(userId, { center: [lng, lat], zoom: instance.getZoom(), basemap: basemapRef.current })
      }, 400)
    }
    instance.on('moveend', persist)
    instance.on('style.load', () =>
      setStyleLoads((prev) => ({ map: instance, n: prev.map === instance ? prev.n + 1 : 1 })),
    )

    mapRef.current = instance
    setMap(instance)

    return () => {
      window.clearTimeout(saveTimer)
      instance.remove()
      mapRef.current = null
      setMap(null)
    }
  }, [userId, initialView])

  const setBasemap = useCallback(
    (next: BasemapId) => {
      basemapRef.current = next
      setBasemapState(next)
      const instance = mapRef.current
      if (!instance) return
      instance.setStyle(buildStyle(next))
      const { lng, lat } = instance.getCenter()
      saveView(userId, { center: [lng, lat], zoom: instance.getZoom(), basemap: next })
    },
    [userId],
  )

  const value = useMemo(
    () => ({ map, basemap, setBasemap, styleVersion, usingFallback }),
    [map, basemap, setBasemap, styleVersion, usingFallback],
  )

  return (
    <MapContext.Provider value={value}>
      {/* maplibre-gl.css kapsayıcıya position:relative verir; bu yüzden yerleşimi dış sarmalayıcı yapar */}
      <div className="absolute inset-0 bg-app-bg">
        <div ref={containerRef} className="h-full w-full" />
      </div>
      {children}
    </MapContext.Provider>
  )
}
