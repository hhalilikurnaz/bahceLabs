import { useEffect, useMemo } from 'react'
import type { CanvasSource } from 'maplibre-gl'
import type { Garden } from '../../api/types'
import { contourStep, paintGrid } from '../../lib/izgara'
import { useMap } from '../../map/useMap'
import { useCalismaStore } from '../calismaStore'
import type { HaritaGorunumu } from '../useHaritaGorunumu'
import { sinirlarUste } from './haritaYardim'

const SRC = 'kg-raster'
/** Tuval büyütmesi: net piksel (10 m) en yakın komşuyla; kontur açıkken çizgi ve etiket için daha yüksek */
const OLCEK = { piksel: 4, kontur: 10 } as const

/** Seçili katmanın ızgarasını net piksel olarak çizer (kontur, opaklık, histogram vurgusu dahil). Bölgeler katmanında gizli. */
export function GorunumKatmani({ garden, view }: { garden: Garden; view: HaritaGorunumu }) {
  const { map, styleVersion } = useMap()
  const kontur = useCalismaStore((s) => s.kontur)
  const opaklik = useCalismaStore((s) => s.opaklik)
  const vurgu = useCalismaStore((s) => s.vurgu)
  const ring = useMemo(() => (garden.geometry.type === 'Polygon' ? garden.geometry.coordinates[0] : garden.geometry.coordinates[0][0]) as number[][], [garden])

  useEffect(() => {
    if (!map || styleVersion === 0) return
    if (!view.izgara || !view.ramp) {
      if (map.getLayer(SRC)) map.setLayoutProperty(SRC, 'visibility', 'none')
      return
    }
    const started = performance.now()
    const canvas = paintGrid(view.izgara, {
      ramp: view.ramp,
      domain: view.alan,
      scale: kontur && view.tanim.id !== 'degisim' ? OLCEK.kontur : OLCEK.piksel,
      contour: kontur && view.tanim.id !== 'degisim' ? contourStep(view.alan) : null,
      clip: ring,
      highlight: vurgu,
    })
    // MapLibre canvas kaynağı tuval değişimini desteklemez: kaynak her çizimde yeniden kurulur (ızgara küçük, < 5 ms)
    if (map.getLayer(SRC)) map.removeLayer(SRC)
    if (map.getSource(SRC)) map.removeSource(SRC)
    map.addSource(SRC, { type: 'canvas', canvas, coordinates: view.izgara.corners as never, animate: false })
    map.addLayer({ id: SRC, type: 'raster', source: SRC, paint: { 'raster-resampling': 'nearest', 'raster-opacity': opaklik, 'raster-fade-duration': 0 } })
    sinirlarUste(map)
    const src = map.getSource(SRC) as CanvasSource
    src.play()
    requestAnimationFrame(() => requestAnimationFrame(() => src.pause()))
    if (import.meta.env.DEV) console.debug(`[harita] katman çizimi ${Math.round(performance.now() - started)} ms`)
  }, [map, styleVersion, view.izgara, view.ramp, view.alan, view.tanim.id, kontur, vurgu, ring]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (map?.getLayer(SRC)) map.setPaintProperty(SRC, 'raster-opacity', opaklik)
  }, [map, opaklik])

  return null
}
