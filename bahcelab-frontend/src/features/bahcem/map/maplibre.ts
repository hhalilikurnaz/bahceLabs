import type * as MapLibre from 'maplibre-gl'
// Yalnızca varlık adresi (küçük); worker dosyasının kendisi harita açılınca indirilir
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'

export type MapLibreModule = typeof MapLibre

let loading: Promise<MapLibreModule> | null = null

/**
 * MapLibre ve CSS'i tembel yükler (ilk açılışta panel/liste haritayı beklemeden görünür).
 * Sınıf gerektiren yerler (Map, Popup, Marker) bunu çağırır; yalnızca tür gerekiyorsa `import type` yeterlidir.
 */
export function loadMapLibre(): Promise<MapLibreModule> {
  if (!loading) {
    loading = (async () => {
      const [lib] = await Promise.all([import('maplibre-gl'), import('maplibre-gl/dist/maplibre-gl.css')])
      lib.setWorkerUrl(workerUrl)
      return lib
    })()
    // Yükleme başarısızsa yeniden denenebilsin
    loading.catch(() => {
      loading = null
    })
  }
  return loading
}
