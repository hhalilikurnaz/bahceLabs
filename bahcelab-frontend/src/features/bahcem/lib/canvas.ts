/** Tuval (canvas) yardımcıları: tarayıcıya özgüdür, saf mantık `render.ts`'tedir. */
import { canvasScale, ringsToPixels, type Corners } from './render'

export interface Upscaled {
  data: ImageData
  width: number
  height: number
}

function toCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas bağlamı alınamadı')
  return [canvas, ctx]
}

/**
 * Yerel çözünürlükteki (rows × cols) RGBA ya da görüntüyü büyütür ve bahçe poligonuyla KIRPAR.
 * `smooth=false`: keskin 10 m pikseller (nearest); `true`: yalnızca görsel yumuşatma (bilinear).
 * Kırpma ince çözünürlükte yapıldığı için raster poligon dışına taşmaz.
 */
export function upscaleClipped(
  source: Uint8ClampedArray | HTMLImageElement,
  rows: number,
  cols: number,
  opts: { smooth: boolean; corners: Corners; rings: readonly (readonly (readonly number[])[])[] },
): Upscaled {
  const scale = canvasScale(rows, cols)
  const width = cols * scale
  const height = rows * scale

  let drawable: CanvasImageSource
  if (source instanceof Uint8ClampedArray) {
    const [small, sctx] = toCanvas(cols, rows)
    sctx.putImageData(new ImageData(new Uint8ClampedArray(source), cols, rows), 0, 0)
    drawable = small
  } else {
    drawable = source
  }

  const [, ctx] = toCanvas(width, height)
  ctx.imageSmoothingEnabled = opts.smooth
  ctx.imageSmoothingQuality = 'high'

  ctx.save()
  const path = new Path2D()
  for (const ring of ringsToPixels(opts.rings, opts.corners, rows, cols)) {
    ring.forEach(([x, y], i) => (i === 0 ? path.moveTo(x * scale, y * scale) : path.lineTo(x * scale, y * scale)))
    path.closePath()
  }
  ctx.clip(path, 'evenodd')
  ctx.drawImage(drawable, 0, 0, width, height)
  ctx.restore()

  return { data: ctx.getImageData(0, 0, width, height), width, height }
}

const imageCache = new Map<string, Promise<HTMLImageElement>>()

/** Yetkili (çerezli) görüntüyü yükler; aynı adres bir kez indirilir. */
export function loadImage(url: string): Promise<HTMLImageElement> {
  let promise = imageCache.get(url)
  if (!promise) {
    promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.crossOrigin = 'use-credentials'
      image.onload = () => resolve(image)
      image.onerror = () => {
        imageCache.delete(url)
        reject(new Error('Görüntü yüklenemedi'))
      }
      image.src = url
    })
    imageCache.set(url, promise)
  }
  return promise
}
