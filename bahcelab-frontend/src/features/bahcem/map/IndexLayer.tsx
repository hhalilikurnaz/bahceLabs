import { useEffect, useMemo, useRef } from 'react'
import type { CanvasSource } from 'maplibre-gl'
import { layerImageUrl, useGrid, type Scene } from '../api/indeksApi'
import { useGardens } from '../api/useGardens'
import type { GardenGeometry } from '../api/types'
import { useIndexView } from '../hooks/useIndexView'
import { loadImage, upscaleClipped, type Upscaled } from '../lib/canvas'
import { formatDate } from '../lib/dates'
import { INDEX_DEFS, TRUE_COLOR, isIndexId, layerName, type IndexId, type LayerId } from '../lib/indices'
import {
  colorizeGrid,
  compositeSplit,
  diffGrid,
  diffRange,
  percentileRange,
  resampleTo,
  splitPredicate,
  type Corners,
  type Grid,
} from '../lib/render'
import { findScene, referenceDate, usableDates } from '../lib/scenes'
import { useBahcemStore, type RenderInfo } from '../stores/bahcemStore'
import { useMap } from './useMap'

const SOURCE = 'index-canvas'
const LAYER = 'index-raster'

type Rings = readonly (readonly (readonly number[])[])[]

function ringsOf(geometry: GardenGeometry): Rings {
  return geometry.type === 'Polygon' ? geometry.coordinates : geometry.coordinates.flat()
}

/** Görüntüyü (rows × cols) yerel çözünürlükte RGBA'ya çevirir */
function imageToRgba(image: HTMLImageElement, rows: number, cols: number): Uint8ClampedArray {
  const canvas = document.createElement('canvas')
  canvas.width = cols
  canvas.height = rows
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas bağlamı alınamadı')
  ctx.drawImage(image, 0, 0, cols, rows)
  return ctx.getImageData(0, 0, cols, rows).data
}

/** MapLibre canvas kaynağı yalnızca "oynatılırken" yeniden okunur: içerik değişince bir kare oynat. */
function refreshCanvas(source: CanvasSource) {
  source.play()
  requestAnimationFrame(() => requestAnimationFrame(() => source.pause()))
}

function usableGrid(scene: Scene | null, layer: LayerId): boolean {
  return Boolean(scene && layer !== TRUE_COLOR && isIndexId(layer) && scene.indeksler[layer]?.veriVar)
}

/**
 * Seçili bahçenin indeks/gerçek renk görüntüsünü bahçe sınırına oturtulmuş katman olarak çizer.
 * Ham değerlerden istemcide renklendirilir: mutlak/kontrastlı, piksel/yumuşak, değişim haritası ve
 * ayırıcı çizgili karşılaştırma bu sayede mümkün olur. Her şey bahçe poligonuyla ince çözünürlükte kırpılır.
 */
export function IndexLayer() {
  const { map, styleVersion } = useMap()
  const { gardenId, katman, scenes, active, shown } = useIndexView()
  const { data: gardens } = useGardens()
  const gorunum = useBahcemStore((s) => s.gorunum)
  const cizim = useBahcemStore((s) => s.cizim)
  const degisim = useBahcemStore((s) => s.degisim)
  const karsilastirma = useBahcemStore((s) => s.karsilastirma)
  const bolme = useBahcemStore((s) => s.karsilastirma?.bolme ?? 0.5)
  const verimlilik = useBahcemStore((s) => s.verimlilik)
  const setRenderInfo = useBahcemStore((s) => s.setRenderInfo)

  const garden = gardens?.find((g) => g.id === gardenId)
  const rings = useMemo<Rings>(() => (garden ? ringsOf(garden.geometry) : []), [garden])

  // ---- hangi sahneler/ızgaralar gerekli
  const gridLayer = katman !== TRUE_COLOR ? (katman as IndexId) : null
  const gridA = useGrid(gardenId, usableGrid(active, katman) ? active : null, gridLayer).data

  const dates = useMemo(() => usableDates(scenes, katman).filter((d) => usableGrid(findScene(scenes, d), katman)), [scenes, katman])
  const refDate =
    degisim && active && gridLayer ? referenceDate(degisim.preset, active.tarih, dates, degisim.tarih) : null
  const refScene = findScene(scenes, refDate)
  const gridRef = useGrid(gardenId, degisim ? refScene : null, gridLayer).data

  const sceneB = karsilastirma ? findScene(scenes, karsilastirma.tarihB) : null
  const layerB = karsilastirma?.katmanB ?? katman
  const gridB = useGrid(gardenId, karsilastirma && usableGrid(sceneB, layerB) ? sceneB : null, isIndexId(layerB) ? layerB : null).data

  // ---- upscaled görüntüler (swipe için A ve B ayrı tutulur, ayırıcı oynayınca yalnızca birleştirilir)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const swipeRef = useRef<{ a: Upscaled; b: Upscaled; corners: Corners } | null>(null)
  const recomposite = useRef<() => void>(() => {})

  useEffect(() => {
    if (!map || styleVersion === 0) return
    let cancelled = false

    const hide = () => {
      swipeRef.current = null
      if (map.getLayer(LAYER)) map.setLayoutProperty(LAYER, 'visibility', 'none')
      setRenderInfo(null)
    }
    if (!shown || !active || !gardenId || verimlilik || !active.koordinatlar || !active.satir || !active.sutun) {
      hide()
      return
    }

    const rows = active.satir
    const cols = active.sutun
    const corners = active.koordinatlar as unknown as Corners
    const smooth = cizim === 'yumusak'

    const toRgba = async (scene: Scene, layer: LayerId, grid: Grid | undefined, range?: [number, number]) => {
      if (layer === TRUE_COLOR) {
        if (!scene.gercekRenkVar) return null
        const image = await loadImage(layerImageUrl(gardenId, scene, TRUE_COLOR))
        return imageToRgba(image, rows, cols)
      }
      if (!isIndexId(layer) || !grid) return null
      const def = INDEX_DEFS[layer]
      const values = resampleTo(grid, { rows, cols, corners })
      return colorizeGrid(values, { vmin: range?.[0] ?? def.min, vmax: range?.[1] ?? def.max, colormap: def.renk })
    }

    const present = (data: ImageData, width: number, height: number) => {
      const canvas = (canvasRef.current ??= document.createElement('canvas'))
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d')?.putImageData(data, 0, 0)

      let source = map.getSource(SOURCE) as CanvasSource | undefined
      if (!source) {
        map.addSource(SOURCE, { type: 'canvas', canvas, coordinates: corners as never, animate: false })
        source = map.getSource(SOURCE) as CanvasSource
        map.addLayer(
          {
            id: LAYER,
            type: 'raster',
            source: SOURCE,
            paint: { 'raster-resampling': 'nearest', 'raster-opacity': 0.94, 'raster-fade-duration': 0 },
          },
          map.getLayer('gardens-fill') ? 'gardens-fill' : undefined,
        )
      }
      source.setCoordinates(corners as never)
      map.setLayoutProperty(LAYER, 'visibility', 'visible')
      refreshCanvas(source)
    }

    const upscale = (rgba: Uint8ClampedArray) => upscaleClipped(rgba, rows, cols, { smooth, corners, rings })

    ;(async () => {
      try {
        let info: RenderInfo
        swipeRef.current = null

        if (karsilastirma && sceneB && layerB) {
          // --- karşılaştırma (swipe): A = seçili tarih/katman, B = seçilen ikinci görüntü
          const rangeFor = (layer: LayerId, grid?: Grid): [number, number] | undefined => {
            if (gorunum !== 'kontrastli' || !grid || !isIndexId(layer)) return undefined
            return percentileRange(grid.values, 2, 98) ?? undefined
          }
          const [rgbaA, rgbaB] = await Promise.all([
            toRgba(active, katman, gridA, rangeFor(katman, gridA)),
            toRgba(sceneB, layerB, gridB, rangeFor(layerB, gridB)),
          ])
          if (cancelled || !rgbaA) return hide()
          const a = upscale(rgbaA)
          const b = rgbaB ? upscale(rgbaB) : a
          present(a.data, a.width, a.height) // katmanı kur; ayırıcı birleştirmesi hemen ardından uygulanır
          swipeRef.current = { a, b, corners }
          recomposite.current()
          const labelA = `${layerName(katman)} · ${formatDate(active.tarih)}`
          const labelB = `${layerName(layerB)} · ${formatDate(sceneB.tarih)}`
          info = { kind: 'gercek', vmin: 0, vmax: 0, indeks: null, etiket: `${labelA}  |  ${labelB}` }
          setRenderInfo(info)
          return
        }

        if (degisim && gridLayer && gridA && gridRef && refScene) {
          // --- değişim haritası: seçili tarih − önceki tarih
          const def = INDEX_DEFS[gridLayer]
          const diff = diffGrid(gridA.values, resampleTo(gridRef, gridA))
          const range = diffRange(def.farkAraligi)
          const rgba = colorizeGrid(diff, range)
          if (cancelled) return
          const up = upscale(rgba)
          present(up.data, up.width, up.height)
          setRenderInfo({
            kind: 'fark',
            vmin: range.vmin,
            vmax: range.vmax,
            indeks: gridLayer,
            etiket: `${def.ad} değişimi · ${formatDate(active.tarih)} − ${formatDate(refScene.tarih)}`,
          })
          return
        }

        if (katman === TRUE_COLOR) {
          const rgba = await toRgba(active, TRUE_COLOR, undefined)
          if (cancelled || !rgba) return hide()
          const up = upscale(rgba)
          present(up.data, up.width, up.height)
          setRenderInfo({ kind: 'gercek', vmin: 0, vmax: 0, indeks: null, etiket: `Gerçek renk · ${formatDate(active.tarih)}` })
          return
        }

        const def = INDEX_DEFS[katman as IndexId]
        if (gridA) {
          const range = gorunum === 'kontrastli' ? (percentileRange(gridA.values, 2, 98) ?? undefined) : undefined
          const [vmin, vmax] = range ? (range[1] - range[0] < 1e-4 ? [range[0] - 0.005, range[1] + 0.005] : range) : [def.min, def.max]
          const rgba = await toRgba(active, katman, gridA, [vmin, vmax])
          if (cancelled || !rgba) return
          const up = upscale(rgba)
          present(up.data, up.width, up.height)
          setRenderInfo({
            kind: gorunum === 'kontrastli' ? 'kontrastli' : 'mutlak',
            vmin,
            vmax,
            indeks: katman as IndexId,
            etiket: `${def.ad} · ${formatDate(active.tarih)}`,
          })
        } else if (!active.indeksler[katman as IndexId]?.veriVar) {
          // Eski kayıt: ham ızgara henüz yok, sunucu PNG'si (zaten kırpılmış) olduğu gibi gösterilir
          const image = await loadImage(layerImageUrl(gardenId, active, katman))
          if (cancelled) return
          const canvas = document.createElement('canvas')
          canvas.width = image.naturalWidth
          canvas.height = image.naturalHeight
          const ctx = canvas.getContext('2d', { willReadFrequently: true })
          ctx?.drawImage(image, 0, 0)
          if (ctx) present(ctx.getImageData(0, 0, canvas.width, canvas.height), canvas.width, canvas.height)
          setRenderInfo({ kind: 'mutlak', vmin: def.min, vmax: def.max, indeks: katman as IndexId, etiket: `${def.ad} · ${formatDate(active.tarih)}` })
        }
      } catch {
        if (!cancelled) hide()
      }
    })()

    return () => {
      cancelled = true
    }
  }, [map, styleVersion, shown, active, gardenId, katman, gorunum, cizim, degisim, karsilastirma, gridA, gridRef, refScene, sceneB, layerB, gridB, gridLayer, rings, verimlilik, setRenderInfo])

  // ---- ayırıcı çizgi: ekran koordinatına göre A/B birleştirme (harita oynayınca da yeniden)
  useEffect(() => {
    if (!map) return
    let frame = 0
    const composite = () => {
      const swipe = swipeRef.current
      const source = map.getSource(SOURCE) as CanvasSource | undefined
      const canvas = canvasRef.current
      if (!swipe || !source || !canvas) return
      const { a, b, corners } = swipe
      const splitX = (useBahcemStore.getState().karsilastirma?.bolme ?? 0.5) * map.getContainer().clientWidth
      const predicate = splitPredicate(corners, a.height, a.width, (lng, lat) => map.project([lng, lat]).x, splitX)
      const merged = compositeSplit(a.data.data, b.data.data, a.width, a.height, predicate)
      canvas.width = a.width
      canvas.height = a.height
      canvas.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(merged), a.width, a.height), 0, 0)
      source.setCoordinates(corners as never)
      map.setLayoutProperty(LAYER, 'visibility', 'visible')
      refreshCanvas(source)
    }
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(composite)
    }
    recomposite.current = schedule
    map.on('move', schedule)
    return () => {
      cancelAnimationFrame(frame)
      map.off('move', schedule)
      recomposite.current = () => {}
    }
  }, [map, styleVersion])

  useEffect(() => {
    recomposite.current()
  }, [bolme])

  return null
}
