import { createContext } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'
import type { BasemapId } from './mapStyles'

export interface MapContextValue {
  /** Harita hazır olana kadar null */
  map: MapLibreMap | null
  basemap: BasemapId
  setBasemap: (basemap: BasemapId) => void
  /**
   * Altlık değişince (setStyle) eklenen katmanlar silinir. Katman/çizim ekleyen sonraki adımlar
   * bu sayacı efekt bağımlılığı yapıp katmanlarını yeniden ekler.
   */
  styleVersion: number
  /** MapTiler anahtarı yoksa true: OSM yedek altlığı gösterilir */
  usingFallback: boolean
}

export const MapContext = createContext<MapContextValue | null>(null)
