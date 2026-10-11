/**
 * Bir sahneyi (indeks ya da gerçek renk) bahçe poligonuyla kırpılmış RGBA görüntüye çevirir.
 * Ana harita katmanı ve arşiv görüntüleyicisi AYNI çizimi kullanır; fark haritası da buradan üretilir.
 */
import { layerImageUrl, type Scene } from '../api/indeksApi'
import { loadImage, upscaleClipped, type Upscaled } from './canvas'
import { INDEX_DEFS, TRUE_COLOR, safeColormap, type IndexId, type LayerId } from './indices'
import { colorRange, valueRange, type RenderInfo, type ViewSettings } from './raster'
import { colorizeGrid, diffGrid, diffRange, resampleTo, type Corners, type Grid } from './render'

export type Rings = readonly (readonly (readonly number[])[])[]

export interface RasterResult {
  image: Upscaled
  info: RenderInfo
}

export interface SceneGeometry {
  rows: number
  cols: number
  corners: Corners
}

/** Sahnenin ızgara geometrisi; eksikse null (çizilemez). */
export function sceneGeometry(scene: Scene): SceneGeometry | null {
  if (!scene.satir || !scene.sutun || !scene.koordinatlar) return null
  return { rows: scene.satir, cols: scene.sutun, corners: scene.koordinatlar as unknown as Corners }
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

interface RenderArgs {
  gardenId: string
  scene: Scene
  layer: LayerId
  /** İndeks katmanları için ham ızgara (yoksa sunucu PNG'si olduğu gibi çizilir) */
  grid: Grid | undefined
  settings: ViewSettings
  rings: Rings
}

/** Ana çizim: gerçek renk, kendi farkları / genel skala. Çizilemiyorsa null. */
export async function renderScene({ gardenId, scene, layer, grid, settings, rings }: RenderArgs): Promise<RasterResult | null> {
  const geo = sceneGeometry(scene)
  if (!geo) return null
  const { rows, cols, corners } = geo
  const smooth = settings.cizim === 'yumusak'
  const upscale = (rgba: Uint8ClampedArray | HTMLImageElement) => upscaleClipped(rgba, rows, cols, { smooth, corners, rings })

  if (layer === TRUE_COLOR) {
    if (!scene.gercekRenkVar) return null
    const image = await loadImage(layerImageUrl(gardenId, scene, TRUE_COLOR))
    const info: RenderInfo = { kind: 'gercek', vmin: 0, vmax: 0, indeks: null, colormap: null, homogeneous: false, tarih: scene.tarih }
    return { image: upscale(imageToRgba(image, rows, cols)), info }
  }

  const id = layer as IndexId
  const def = INDEX_DEFS[id]
  if (grid) {
    const values = resampleTo(grid, { rows, cols, corners })
    const range = valueRange(values, def, settings.skala)
    const cr = colorRange(range, def, settings)
    const info: RenderInfo = {
      kind: settings.skala,
      vmin: range.vmin,
      vmax: range.vmax,
      indeks: id,
      colormap: cr.colormap,
      homogeneous: range.homogeneous,
      tarih: scene.tarih,
    }
    return { image: upscale(colorizeGrid(values, cr)), info }
  }

  if (!scene.indeksler[id]?.veriVar) {
    // Eski kayıt: ham ızgara yok, sunucu PNG'si (zaten kırpılmış) olduğu gibi gösterilir
    const image = await loadImage(layerImageUrl(gardenId, scene, id))
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.drawImage(image, 0, 0)
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const info: RenderInfo = {
      kind: 'genel',
      vmin: def.min,
      vmax: def.max,
      indeks: id,
      colormap: safeColormap(def.renk, settings.renkKorlugu),
      homogeneous: false,
      tarih: scene.tarih,
    }
    return { image: { data, width: data.width, height: data.height }, info }
  }
  return null
}

/** Değişim haritası: `to` − `from` (A'nın piksel ızgarası esas alınır). Kırmızı/mavi-turuncu = düşüş. */
export function renderDifference(args: {
  toScene: Scene
  fromScene: Scene
  toGrid: Grid
  fromGrid: Grid
  indeks: IndexId
  settings: ViewSettings
  rings: Rings
}): RasterResult | null {
  const geo = sceneGeometry(args.toScene)
  if (!geo) return null
  const def = INDEX_DEFS[args.indeks]
  const diff = diffGrid(args.toGrid.values, resampleTo(args.fromGrid, args.toGrid))
  const range = diffRange(def.farkAraligi)
  const colormap = safeColormap(range.colormap, args.settings.renkKorlugu)
  const smooth = args.settings.cizim === 'yumusak'
  const image = upscaleClipped(colorizeGrid(diff, { ...range, colormap }), geo.rows, geo.cols, {
    smooth,
    corners: geo.corners,
    rings: args.rings,
  })
  const info: RenderInfo = {
    kind: 'fark',
    vmin: range.vmin,
    vmax: range.vmax,
    indeks: args.indeks,
    colormap,
    homogeneous: false,
    tarih: args.toScene.tarih,
  }
  return { image, info }
}
