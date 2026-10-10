import { createContext } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'
import type { BasemapId, BasemapProviderId } from './mapStyles'

export interface MapContextValue {
  /** Harita hazır olana kadar null */
  map: MapLibreMap | null
  basemap: BasemapId
  setBasemap: (basemap: BasemapId) => void
  /** Seçili altlık sağlayıcısı (anahtar yoksa/401 ise fiilen kullanılan `effectiveProvider` farklı olabilir) */
  provider: BasemapProviderId
  setProvider: (provider: BasemapProviderId) => void
  /** Anahtarı tanımlı sağlayıcılar */
  providers: BasemapProviderId[]
  /**
   * Stil yüklenince artar (0 = henüz yüklenmedi). Altlık değişince (setStyle) eklenen katmanlar
   * silinir; katman/çizim ekleyen kod `styleVersion > 0` iken ekler ve bunu efekt bağımlılığı yapar.
   */
  styleVersion: number
  /** Hiç harita anahtarı yoksa true: OSM yedek altlığı gösterilir */
  usingFallback: boolean
}

export const MapContext = createContext<MapContextValue | null>(null)
