import { useEffect, useMemo, useRef } from 'react'
import type { CanvasSource } from 'maplibre-gl'
import { useGrid } from '../api/indeksApi'
import { useGardens } from '../api/useGardens'
import type { GardenGeometry } from '../api/types'
import { useIndexView } from '../hooks/useIndexView'
import { RASTER } from '../lib/config'
import { isIndexId } from '../lib/indices'
import { renderScene, sceneGeometry, type Rings } from '../lib/rasterRender'
import { useBahcemStore } from '../stores/bahcemStore'
import { useMap } from './useMap'

const SOURCE = 'index-canvas'
const LAYER = 'index-raster'

const ringsOf = (geometry: GardenGeometry): Rings => (geometry.type === 'Polygon' ? geometry.coordinates : geometry.coordinates.flat())

/** MapLibre canvas kaynağı yalnızca "oynatılırken" yeniden okunur: içerik değişince bir kare oynat. */
function refreshCanvas(source: CanvasSource) {
  source.play()
  requestAnimationFrame(() => requestAnimationFrame(() => source.pause()))
}

/**
 * Seçili bahçenin EN GÜNCEL geçerli görüntüsünü (seçili parametre) bahçe sınırına oturtulmuş katman olarak çizer.
 * Tarih seçimi yoktur; geçmiş görüntüler Arşiv sayfasındadır. Çizim `lib/rasterRender.ts` ile arşivle ortaktır.
 */
export function IndexLayer() {
  const { map, styleVersion } = useMap()
  const { gardenId, katman, active, shown } = useIndexView()
  const { data: gardens } = useGardens()
  const skala = useBahcemStore((s) => s.skala)
  const cizim = useBahcemStore((s) => s.cizim)
  const renkKorlugu = useBahcemStore((s) => s.renkKorlugu)
  const verimlilik = useBahcemStore((s) => s.verimlilik)
  const setRenderInfo = useBahcemStore((s) => s.setRenderInfo)

  const garden = gardens?.find((g) => g.id === gardenId)
  const rings = useMemo<Rings>(() => (garden ? ringsOf(garden.geometry) : []), [garden])
  const gridLayer = isIndexId(katman) ? katman : null
  const grid = useGrid(gardenId, active, gridLayer).data
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (!map || styleVersion === 0) return
    let cancelled = false

    const hide = () => {
      if (map.getLayer(LAYER)) map.setLayoutProperty(LAYER, 'visibility', 'none')
      setRenderInfo(null)
    }
    if (!shown || !active || !gardenId || verimlilik || !sceneGeometry(active)) {
      hide()
      return
    }
    // Ham ızgara hazır olana kadar (indeks katmanı) bekle; eski kayıtta ızgara hiç yoksa PNG yedeği çizilir
    if (gridLayer && active.indeksler[gridLayer]?.veriVar && !grid) return

    void (async () => {
      try {
        const result = await renderScene({ gardenId, scene: active, layer: katman, grid, settings: { skala, cizim, renkKorlugu }, rings })
        if (cancelled) return
        if (!result) return hide()
        const geo = sceneGeometry(active)
        if (!geo) return hide()
        const { image } = result
        const canvas = (canvasRef.current ??= document.createElement('canvas'))
        canvas.width = image.width
        canvas.height = image.height
        canvas.getContext('2d')?.putImageData(image.data, 0, 0)

        let source = map.getSource(SOURCE) as CanvasSource | undefined
        if (!source) {
          map.addSource(SOURCE, { type: 'canvas', canvas, coordinates: geo.corners as never, animate: false })
          source = map.getSource(SOURCE) as CanvasSource
          map.addLayer(
            { id: LAYER, type: 'raster', source: SOURCE, paint: { 'raster-resampling': 'nearest', 'raster-opacity': RASTER.opacity, 'raster-fade-duration': 0 } },
            map.getLayer('gardens-fill') ? 'gardens-fill' : undefined,
          )
        }
        source.setCoordinates(geo.corners as never)
        map.setLayoutProperty(LAYER, 'visibility', 'visible')
        refreshCanvas(source)
        setRenderInfo(result.info)
      } catch {
        if (!cancelled) hide()
      }
    })()

    return () => {
      cancelled = true
    }
  }, [map, styleVersion, shown, active, gardenId, katman, skala, cizim, renkKorlugu, grid, gridLayer, rings, verimlilik, setRenderInfo])

  return null
}

