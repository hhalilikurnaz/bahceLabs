import type { StyleSpecification } from 'maplibre-gl'

export type BasemapId = 'satellite' | 'hybrid' | 'streets'

export const BASEMAPS: { id: BasemapId; label: string; maptilerStyle: string }[] = [
  { id: 'satellite', label: 'Uydu', maptilerStyle: 'satellite' },
  { id: 'hybrid', label: 'Uydu + etiketler', maptilerStyle: 'hybrid' },
  { id: 'streets', label: 'Harita', maptilerStyle: 'streets-v2' },
]

/** Anahtar yalnızca .env.local içinde tutulur; kodda ve repoda yer almaz. */
export function getMaptilerKey(): string | undefined {
  const key = import.meta.env.VITE_MAPTILER_KEY?.trim()
  return key ? key : undefined
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

/** Anahtar yoksa OpenStreetMap yedek altlığı döner. */
export function buildStyle(basemap: BasemapId, key = getMaptilerKey()): string | StyleSpecification {
  if (!key) return OSM_FALLBACK
  const style = BASEMAPS.find((b) => b.id === basemap)?.maptilerStyle ?? 'satellite'
  return `https://api.maptiler.com/maps/${style}/style.json?key=${encodeURIComponent(key)}`
}
