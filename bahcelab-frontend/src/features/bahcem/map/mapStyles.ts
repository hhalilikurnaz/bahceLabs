import type { StyleSpecification } from 'maplibre-gl'

export type BasemapId = 'satellite' | 'hybrid' | 'streets'
export type BasemapProviderId = 'mapbox' | 'maptiler'

export const BASEMAPS: { id: BasemapId; label: string; maptilerStyle: string; mapboxStyle: string | null }[] = [
  { id: 'satellite', label: 'Uydu', maptilerStyle: 'satellite', mapboxStyle: null },
  { id: 'hybrid', label: 'Uydu + etiketler', maptilerStyle: 'hybrid', mapboxStyle: 'satellite-streets-v12' },
  { id: 'streets', label: 'Harita', maptilerStyle: 'streets-v2', mapboxStyle: 'streets-v12' },
]

export const BASEMAP_PROVIDERS: { id: BasemapProviderId; label: string; hint: string }[] = [
  { id: 'mapbox', label: 'Mapbox', hint: 'Daha net uydu görüntüsü' },
  { id: 'maptiler', label: 'MapTiler', hint: 'Yedek altlık' },
]

/**
 * Mapbox uydu görüntüsünün bu bölgede gerçek ayrıntı verdiği en yüksek yakınlaştırma (ölçüldü: z19'dan
 * sonra bir önceki seviyenin büyütülmüşü ile aynı). Ötesinde MapLibre yumuşak büyütür, boş/bulanık karo istenmez.
 */
export const MAPBOX_NATIVE_MAX_ZOOM = 19
/** Mapbox karoları @2x (512 px) istenir; MapLibre karoyu 512 px'lik şemada gösterir */
const MAPBOX_TILE_SIZE = 512

/** Anahtarlar yalnızca .env.local içinde tutulur; kodda ve repoda yer almaz. */
export function getMaptilerKey(): string | undefined {
  const key = import.meta.env.VITE_MAPTILER_KEY?.trim()
  return key ? key : undefined
}

export function getMapboxToken(): string | undefined {
  const token = import.meta.env.VITE_MAPBOX_TOKEN?.trim()
  return token ? token : undefined
}

/** Kullanılabilir sağlayıcılar (anahtarı tanımlı olanlar) */
export function availableProviders(): BasemapProviderId[] {
  const list: BasemapProviderId[] = []
  if (getMapboxToken()) list.push('mapbox')
  if (getMaptilerKey()) list.push('maptiler')
  return list
}

const warned = new Set<string>()
/** Aynı uyarı oturum boyunca yalnızca bir kez yazılır (anahtar/token asla yazılmaz) */
export function warnOnce(id: string, message: string): void {
  if (warned.has(id)) return
  warned.add(id)
  console.warn(`[BahçeLab harita] ${message}`)
}

/** İstenen sağlayıcının anahtarı yoksa sıradakine, hiç anahtar yoksa OpenStreetMap yedeğine düşer. */
export function effectiveProvider(preferred: BasemapProviderId): BasemapProviderId | 'osm' {
  const available = availableProviders()
  if (available.includes(preferred)) return preferred
  const fallback = available[0]
  if (fallback) {
    warnOnce(`missing-${preferred}`, `${preferred} anahtarı tanımlı değil; ${fallback} altlığı kullanılıyor.`)
    return fallback
  }
  warnOnce('missing-all', 'Hiç harita anahtarı tanımlı değil; OpenStreetMap yedeği kullanılıyor.')
  return 'osm'
}

const OSM_FALLBACK: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap katkıda bulunanlar',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
}

const MAPBOX_ATTRIBUTION =
  '© <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noreferrer">Mapbox</a> ' +
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> ' +
  '© <a href="https://www.maxar.com/" target="_blank" rel="noreferrer">Maxar</a> ' +
  '<a href="https://www.mapbox.com/map-feedback/" target="_blank" rel="noreferrer"><strong>Improve this map</strong></a>'

function mapboxStyle(kind: BasemapId, token: string): StyleSpecification {
  const entry = BASEMAPS.find((b) => b.id === kind) ?? BASEMAPS[0]
  const retina = MAPBOX_TILE_SIZE === 512 ? '@2x' : ''
  const tile = entry.mapboxStyle
    ? `https://api.mapbox.com/styles/v1/mapbox/${entry.mapboxStyle}/tiles/256/{z}/{x}/{y}${retina}?access_token=${encodeURIComponent(token)}`
    : `https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}${retina}.jpg90?access_token=${encodeURIComponent(token)}`
  return {
    version: 8,
    sources: {
      basemap: {
        type: 'raster',
        tiles: [tile],
        tileSize: MAPBOX_TILE_SIZE,
        maxzoom: kind === 'streets' ? 22 : MAPBOX_NATIVE_MAX_ZOOM,
        attribution: MAPBOX_ATTRIBUTION,
      },
    },
    layers: [{ id: 'basemap', type: 'raster', source: 'basemap', paint: { 'raster-resampling': 'linear' } }],
  }
}

/** Altlık stilini üretir. Sağlayıcının anahtarı yoksa yedeğe düşer (bkz. `effectiveProvider`). */
export function buildStyle(
  kind: BasemapId,
  provider: BasemapProviderId = 'mapbox',
  keys: { mapbox?: string; maptiler?: string } = { mapbox: getMapboxToken(), maptiler: getMaptilerKey() },
): string | StyleSpecification {
  let chosen: BasemapProviderId | 'osm' = provider
  if (chosen === 'mapbox' && !keys.mapbox) chosen = keys.maptiler ? 'maptiler' : 'osm'
  if (chosen === 'maptiler' && !keys.maptiler) chosen = keys.mapbox ? 'mapbox' : 'osm'
  if (chosen === 'mapbox' && keys.mapbox) return mapboxStyle(kind, keys.mapbox)
  if (chosen === 'maptiler' && keys.maptiler) {
    const style = BASEMAPS.find((b) => b.id === kind)?.maptilerStyle ?? 'satellite'
    return `https://api.maptiler.com/maps/${style}/style.json?key=${encodeURIComponent(keys.maptiler)}`
  }
  return OSM_FALLBACK
}
