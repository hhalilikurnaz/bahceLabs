import { createContext } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'
import type { BasemapId } from './mapStyles'

export interface MapContextValue {
  /** Harita hazır olana kadar null */
  map: MapLibreMap | null
  basemap: BasemapId
  setBasemap: (basemap: BasemapId) => void
  /**
   * Stil yüklenince artar (0 = henüz yüklenmedi). Altlık değişince (setStyle) eklenen katmanlar
   * silinir; katman/çizim ekleyen kod `styleVersion > 0` iken ekler ve bunu efekt bağımlılığı yapar.
   */
  styleVersion: number
  /** MapTiler anahtarı yoksa true: OSM yedek altlığı gösterilir */
  usingFallback: boolean
}

export const MapContext = createContext<MapContextValue | null>(null)
