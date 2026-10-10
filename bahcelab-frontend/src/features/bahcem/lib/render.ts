/**
 * Ham indeks ızgaralarını renklendirme ve karşılaştırma için SAF fonksiyonlar (DOM/canvas gerektirmez).
 * Canvas çizimi `drawGrid` ile ayrıca yapılır; böylece burası testlenebilir.
 */
import { COLORMAPS, colorAt, type ColormapId, type Rgb } from './indices'

export type Corners = readonly (readonly [number, number])[] // KB, KD, GD, GB [boylam, enlem]

export interface Grid {
  values: Float32Array
  rows: number
  cols: number
  corners: Corners
}

/** float32 (little-endian) ham veriyi ayrıştırır; boyut uyuşmazsa hata verir. */
export function parseGrid(buffer: ArrayBuffer, rows: number, cols: number, corners: Corners): Grid {
  if (buffer.byteLength !== rows * cols * 4) {
    throw new Error(`Izgara boyutu uyuşmuyor: ${buffer.byteLength} bayt, beklenen ${rows * cols * 4}`)
  }
  const view = new DataView(buffer)
  const values = new Float32Array(rows * cols)
  for (let i = 0; i < values.length; i++) values[i] = view.getFloat32(i * 4, true)
  return { values, rows, cols, corners }
}

/** [p%, q%] yüzdelik aralığı (sonlu değerler üzerinden, doğrusal enterpolasyon) */
export function percentileRange(values: Float32Array, p: number, q: number): [number, number] | null {
  const finite: number[] = []
  for (const v of values) if (Number.isFinite(v)) finite.push(v)
  if (finite.length === 0) return null
  finite.sort((a, b) => a - b)
  const at = (pct: number) => {
    const pos = (pct / 100) * (finite.length - 1)
    const lo = Math.floor(pos)
    const hi = Math.ceil(pos)
    return finite[lo] + (finite[hi] - finite[lo]) * (pos - lo)
  }
  return [at(p), at(q)]
}

export interface ColorRange {
  vmin: number
  vmax: number
  colormap: ColormapId
}

/** Değerleri renk skalasına eşler → RGBA (NaN = tamamen saydam) */
export function colorizeGrid(values: Float32Array, range: ColorRange): Uint8ClampedArray {
  const { vmin, vmax, colormap } = range
  const stops = COLORMAPS[colormap]
  const span = vmax - vmin || 1
  // 256 adımlık arama tablosu: büyük ızgaralarda hızlı
  const lut: Rgb[] = Array.from({ length: 256 }, (_, i) => colorAt(stops, i / 255))
  const out = new Uint8ClampedArray(values.length * 4)
  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    if (!Number.isFinite(v)) continue // alfa 0
    const [r, g, b] = lut[Math.round(Math.min(1, Math.max(0, (v - vmin) / span)) * 255)]
    out[i * 4] = r
    out[i * 4 + 1] = g
    out[i * 4 + 2] = b
    out[i * 4 + 3] = 255
  }
  return out
}

/** a − b; herhangi biri geçersizse NaN. Boyutlar aynı olmalıdır. */
export function diffGrid(a: Float32Array, b: Float32Array): Float32Array {
  if (a.length !== b.length) throw new Error('Fark için ızgara boyutları aynı olmalı')
  const out = new Float32Array(a.length)
  for (let i = 0; i < a.length; i++) out[i] = Number.isFinite(a[i]) && Number.isFinite(b[i]) ? a[i] - b[i] : NaN
  return out
}

// ---------------------------------------------------------------- coğrafi eşleme
interface Basis {
  origin: readonly [number, number]
  ex: readonly [number, number] // sütun yönü (tüm genişlik)
  ey: readonly [number, number] // satır yönü (tüm yükseklik)
}

function basis(corners: Corners): Basis {
  const [tl, tr, , bl] = corners
  return {
    origin: tl,
    ex: [tr[0] - tl[0], tr[1] - tl[1]],
    ey: [bl[0] - tl[0], bl[1] - tl[1]],
  }
}

/** [boylam, enlem] → kesirli (sütun, satır) piksel konumu */
export function lonLatToPixel(corners: Corners, rows: number, cols: number, lng: number, lat: number): [number, number] {
  const { origin, ex, ey } = basis(corners)
  const dx = lng - origin[0]
  const dy = lat - origin[1]
  const det = ex[0] * ey[1] - ex[1] * ey[0]
  const a = (dx * ey[1] - dy * ey[0]) / det
  const b = (ex[0] * dy - ex[1] * dx) / det
  return [a * cols, b * rows]
}

/** Kesirli (sütun, satır) → [boylam, enlem] */
export function pixelToLonLat(corners: Corners, rows: number, cols: number, x: number, y: number): [number, number] {
  const { origin, ex, ey } = basis(corners)
  const a = x / cols
  const b = y / rows
  return [origin[0] + a * ex[0] + b * ey[0], origin[1] + a * ex[1] + b * ey[1]]
}

const sameCorners = (a: Corners, b: Corners) =>
  a.length === b.length && a.every((p, i) => Math.abs(p[0] - b[i][0]) < 1e-7 && Math.abs(p[1] - b[i][1]) < 1e-7)

/**
 * `source` ızgarasını `target` ızgarasının pikselleri üzerine örnekler (en yakın piksel).
 * Aynı ızgaraysa kopyalamadan döner. Farklı karelerden gelen görüntüler bu sayede kıyaslanabilir.
 */
export function resampleTo(source: Grid, target: Pick<Grid, 'rows' | 'cols' | 'corners'>): Float32Array {
  if (source.rows === target.rows && source.cols === target.cols && sameCorners(source.corners, target.corners)) {
    return source.values
  }
  const out = new Float32Array(target.rows * target.cols).fill(NaN)
  for (let r = 0; r < target.rows; r++) {
    for (let c = 0; c < target.cols; c++) {
      const [lng, lat] = pixelToLonLat(target.corners, target.rows, target.cols, c + 0.5, r + 0.5)
      const [sx, sy] = lonLatToPixel(source.corners, source.rows, source.cols, lng, lat)
      const col = Math.floor(sx)
      const row = Math.floor(sy)
      if (col >= 0 && col < source.cols && row >= 0 && row < source.rows) out[r * target.cols + c] = source.values[row * source.cols + col]
    }
  }
  return out
}

/** Poligon halkalarını [boylam, enlem] → görüntü pikseli (tuval ölçeğiyle çarpılmak üzere) yoluna çevirir */
export function ringsToPixels(
  rings: readonly (readonly (readonly number[])[])[],
  corners: Corners,
  rows: number,
  cols: number,
): [number, number][][] {
  return rings.map((ring) => ring.map(([lng, lat]) => lonLatToPixel(corners, rows, cols, lng, lat)))
}

/** Tuval boyutu: küçük bahçelerde büyük (yumuşak çizim için), büyüklerde en uzun kenar ~1024 px */
export function canvasScale(rows: number, cols: number): number {
  return Math.max(4, Math.min(32, Math.floor(1024 / Math.max(rows, cols))))
}

// ---------------------------------------------------------------- karşılaştırma (swipe)
/**
 * İki RGBA görüntüyü ayırıcı çizgiyle birleştirir: `rightOf(x, y)` doğruysa piksel B'den, değilse A'dan gelir.
 */
export function compositeSplit(
  a: Uint8ClampedArray,
  b: Uint8ClampedArray,
  width: number,
  height: number,
  rightOf: (x: number, y: number) => boolean,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(a.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const src = rightOf(x + 0.5, y + 0.5) ? b : a
      out[i] = src[i]
      out[i + 1] = src[i + 1]
      out[i + 2] = src[i + 2]
      out[i + 3] = src[i + 3]
    }
  }
  return out
}

/**
 * Ekranda dikey bir ayırıcı çizginin (ekran x = splitX) görüntü pikseline göre hangi tarafta kaldığını bulan
 * fonksiyon. `screenOf` (boylam, enlem) → ekran x veren harita projeksiyonudur; görüntü köşelerinden
 * ekran x'in piksel konumuna göre afin olduğu varsayılır (bahçe ölçeğinde yeterince doğru).
 */
export function splitPredicate(
  corners: Corners,
  rows: number,
  cols: number,
  screenX: (lng: number, lat: number) => number,
  splitX: number,
): (x: number, y: number) => boolean {
  const [tl, tr, , bl] = corners
  const x0 = screenX(tl[0], tl[1])
  const dxPerCol = (screenX(tr[0], tr[1]) - x0) / cols
  const dxPerRow = (screenX(bl[0], bl[1]) - x0) / rows
  return (x, y) => x0 + dxPerCol * x + dxPerRow * y > splitX
}

/** Fark değerlerini ±aralığa göre 0–1 skalaya (0,5 = değişim yok) taşır */
export const diffRange = (halfRange: number): ColorRange => ({ vmin: -halfRange, vmax: halfRange, colormap: 'fark' })
