import { useEffect, useMemo } from 'react'
import type { CanvasSource } from 'maplibre-gl'
import type { Garden } from '../../api/types'
import { contourStep, paintGrid } from '../../lib/izgara'
import { useMap } from '../../map/useMap'
import { useCalismaStore } from '../calismaStore'
import type { HaritaGorunumu } from '../useHaritaGorunumu'
import { sinirlarUste } from './haritaYardim'

const SRC = 'kg-raster'
/** Tuval büyütmesi: net piksel en yakın komşuyla; sınır kırpması ve kontur çizgisi pürüzsüz olsun diye piksel başına çok sayıda tuval pikseli.
 *  Büyük bahçede tuval kenarı sınırı aşmasın. */
const OLCEK = { piksel: 16, kontur: 12 } as const
const TUVAL_KENAR_MAKS = 4096
const olcek = (cols: number, rows: number, kontur: boolean) => Math.max(2, Math.min(kontur ? OLCEK.kontur : OLCEK.piksel, Math.floor(TUVAL_KENAR_MAKS / Math.max(cols, rows))))

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
      scale: olcek(view.izgara.cols, view.izgara.rows, kontur && view.tanim.id !== 'degisim'),
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
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        src.pause()
        // Performans ölçümü (e2e/performans.spec.ts okur): katman değişiminin ilk karede görünür olduğu an
        performance.mark('katman-boyandi', { detail: { katman: view.tanim.id, boyamaMs: Math.round(performance.now() - started) } })
      }),
    )
    if (import.meta.env.DEV) console.debug(`[harita] katman çizimi ${Math.round(performance.now() - started)} ms`)
  }, [map, styleVersion, view.izgara, view.ramp, view.alan, view.tanim.id, kontur, vurgu, ring]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (map?.getLayer(SRC)) map.setPaintProperty(SRC, 'raster-opacity', opaklik)
  }, [map, opaklik])

  return null
}
