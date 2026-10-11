import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'
import '../bahcem.css'
import { MapContext } from './MapContext'
import { getApiBaseUrl } from '@/lib/apiClient'
import { loadMapLibre } from './maplibre'
import {
  availableProviders,
  buildStyle,
  effectiveProvider,
  warnOnce,
  type BasemapId,
  type BasemapProviderId,
} from './mapStyles'
import { loadView, saveView } from './viewStorage'

interface MapProviderProps {
  /** Konum ve altlık seçimi kullanıcı bazında saklanır */
  userId: string
  children: ReactNode
}

/**
 * Tek harita örneğini yönetir: kapsayıcıyı hemen çizer, MapLibre tembel yüklenir (panel haritayı beklemez).
 * Çocuklar `useMap()` ile haritaya katman ekler; harita hazır olana kadar `map` null'dır.
 */
export function MapProvider({ userId, children }: MapProviderProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const [initialView] = useState(() => loadView(userId))
  const basemapRef = useRef<BasemapId>(initialView.basemap)
  const providerRef = useRef<BasemapProviderId>(initialView.provider ?? 'mapbox')

  const [map, setMap] = useState<MapLibreMap | null>(null)
  const [basemap, setBasemapState] = useState<BasemapId>(initialView.basemap)
  const [provider, setProviderState] = useState<BasemapProviderId>(initialView.provider ?? 'mapbox')
  // 'style.load' sayacı harita örneğine bağlı tutulur; yeni harita 0'dan başlar
  const [styleLoads, setStyleLoads] = useState<{ map: MapLibreMap | null; n: number }>({
    map: null,
    n: 0,
  })
  const styleVersion = styleLoads.map !== null && styleLoads.map === map ? styleLoads.n : 0
  const [unauthorized, setUnauthorized] = useState(false)
  const providers = useMemo(() => availableProviders(), [])
  const preferred = effectiveProvider(provider)
  // Fiilen kullanılan altlık: 401 alındıysa Mapbox yerine MapTiler
  const activeProvider = preferred === 'mapbox' && unauthorized ? 'maptiler' : preferred
  const usingFallback = activeProvider === 'osm'

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let disposed = false
    let instance: MapLibreMap | null = null
    let saveTimer: number | undefined

    void loadMapLibre().then((lib) => {
      if (disposed) return
      const view = initialView
      const created = new lib.Map({
        container,
        style: buildStyle(view.basemap, view.provider ?? 'mapbox'),
        center: view.center,
        zoom: view.zoom,
        attributionControl: false, // atıflar `MapAttribution` bileşeninde (logo + metin, mobilde de okunur)
        // İndeks PNG'leri yetkili uç noktadan gelir: çerez (httpOnly oturum) her koşulda gönderilsin
        transformRequest: (url) =>
          url.includes(`${getApiBaseUrl()}/gardens/`) ? { url, credentials: 'include' } : undefined,
        dragRotate: false,
        pitchWithRotate: false,
      })
      created.touchZoomRotate.disableRotation()

      const persist = () => {
        window.clearTimeout(saveTimer)
        saveTimer = window.setTimeout(() => {
          const { lng, lat } = created.getCenter()
          saveView(userId, {
            center: [lng, lat],
            zoom: created.getZoom(),
            basemap: basemapRef.current,
            provider: providerRef.current,
          })
        }, 400)
      }
      created.on('moveend', persist)
      // Mapbox token'ı geçersiz/yetkisizse (401/403) oturum boyunca MapTiler'a düşülür; tercih kaydı değişmez
      created.on('error', (event) => {
        const status = (event.error as { status?: number } | undefined)?.status
        if ((status === 401 || status === 403) && providerRef.current === 'mapbox' && availableProviders().includes('maptiler')) {
          warnOnce('mapbox-401', 'Mapbox yetkilendirme hatası (401); MapTiler altlığına geçildi.')
          created.setStyle(buildStyle(basemapRef.current, 'maptiler'))
          setUnauthorized(true)
        }
      })
      created.on('style.load', () =>
        setStyleLoads((prev) => ({ map: created, n: prev.map === created ? prev.n + 1 : 1 })),
      )

      instance = created
      mapRef.current = created
      setMap(created)
    })

    return () => {
      disposed = true
      window.clearTimeout(saveTimer)
      instance?.remove()
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
      instance.setStyle(buildStyle(next, providerRef.current))
      const { lng, lat } = instance.getCenter()
      saveView(userId, { center: [lng, lat], zoom: instance.getZoom(), basemap: next, provider: providerRef.current })
    },
    [userId],
  )

  const setProvider = useCallback(
    (next: BasemapProviderId) => {
      providerRef.current = next
      setProviderState(next)
      setUnauthorized(false)
      const instance = mapRef.current
      if (!instance) return
      instance.setStyle(buildStyle(basemapRef.current, next))
      const { lng, lat } = instance.getCenter()
      saveView(userId, { center: [lng, lat], zoom: instance.getZoom(), basemap: basemapRef.current, provider: next })
    },
    [userId],
  )

  const value = useMemo(
    () => ({ map, basemap, setBasemap, provider, setProvider, providers, activeProvider, styleVersion, usingFallback }),
    [map, basemap, setBasemap, provider, setProvider, providers, activeProvider, styleVersion, usingFallback],
  )

  return (
    <MapContext.Provider value={value}>
      {/* maplibre-gl.css kapsayıcıya position:relative verir; bu yüzden yerleşimi dış sarmalayıcı yapar */}
      <div className="surface-dark absolute inset-0 bg-app-bg">
        <div ref={containerRef} className="h-full w-full" />
      </div>
      {children}
    </MapContext.Provider>
  )
}
