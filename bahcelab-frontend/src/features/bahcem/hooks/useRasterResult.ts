import { useEffect, useState } from 'react'
import { useGrid, type Scene } from '../api/indeksApi'
import { isIndexId, type LayerId } from '../lib/indices'
import type { ViewSettings } from '../lib/raster'
import { renderScene, type RasterResult, type Rings } from '../lib/rasterRender'

export interface RasterState {
  result: RasterResult | null
  loading: boolean
  failed: boolean
}

/** Bir sahneyi (ızgarayı indirip) bahçe sınırıyla kırpılmış görüntüye çevirir. Arşiv görüntüleyicisi kullanır. */
export function useRasterResult(gardenId: string, scene: Scene | null, layer: LayerId, settings: ViewSettings, rings: Rings): RasterState {
  const gridLayer = isIndexId(layer) ? layer : null
  const grid = useGrid(gardenId, scene, gridLayer)
  const [state, setState] = useState<RasterState>({ result: null, loading: false, failed: false })
  const waitingForGrid = Boolean(scene && gridLayer && scene.indeksler[gridLayer]?.veriVar && !grid.data && !grid.isError)

  useEffect(() => {
    if (!scene) return
    if (waitingForGrid) return
    let cancelled = false
    renderScene({ gardenId, scene, layer, grid: grid.data, settings, rings })
      .then((result) => !cancelled && setState({ result, loading: false, failed: result === null }))
      .catch(() => !cancelled && setState({ result: null, loading: false, failed: true }))
    return () => {
      cancelled = true
    }
  }, [gardenId, scene, layer, grid.data, waitingForGrid, settings.skala, settings.cizim, settings.renkKorlugu, rings]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!scene) return { result: null, loading: false, failed: false }
  return { ...state, loading: waitingForGrid || (!state.result && !state.failed) }
}
