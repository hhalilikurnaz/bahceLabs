/**
 * Bahçe ızgarası (10 m piksel) çizimi ve sorguları — SAF (tuval hariç). Harita katmanı, histogram ve nokta incelemesi
 * aynı fonksiyonları kullanır: değer → renk, kontur, vurgulu aralık, boylam/enlem → piksel.
 */
import { contours } from 'd3-contour'
import { rampColor, ZEMIN, type Stops } from './paletler'

export interface PGrid {
  values: Float32Array
  rows: number
  cols: number
  /** Görüntü köşeleri [boylam, enlem]: KB, KD, GD, GB */
  corners: [number, number][]
}

export const finiteValues = (g: PGrid): number[] => Array.from(g.values).filter((v) => Number.isFinite(v))

/** Ortanca (geçerli piksellerin); piksel yoksa null. */
export function median(g: PGrid): number | null {
  const v = finiteValues(g).sort((a, b) => a - b)
  if (!v.length) return null
  const m = Math.floor(v.length / 2)
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2
}

/** Yüzdelik alan [p2, p98]; aynı ekrandaki tüm ızgaralar aynı alanı paylaşabilir. */
export function percentileDomain(grids: PGrid[], lo = 0.02, hi = 0.98): [number, number] {
  const all = grids.flatMap(finiteValues).sort((a, b) => a - b)
  if (!all.length) return [0, 1]
  const at = (p: number) => all[Math.min(all.length - 1, Math.floor(p * all.length))]
  return [at(lo), at(hi)]
}

/** Boylam/enlem → ızgara konumu (sütun, satır; kesirli). Köşelerden afin çözüm: KB + u·(KD−KB) + v·(GB−KB). */
export function lngLatToCell(g: PGrid, lng: number, lat: number): [number, number] {
  const [kb, kd, , gb] = g.corners
  const e1 = [kd[0] - kb[0], kd[1] - kb[1]]
  const e2 = [gb[0] - kb[0], gb[1] - kb[1]]
  const det = e1[0] * e2[1] - e1[1] * e2[0]
  const px = lng - kb[0]
  const py = lat - kb[1]
  return [((px * e2[1] - py * e2[0]) / det) * g.cols, ((e1[0] * py - e1[1] * px) / det) * g.rows]
}

/** Noktadaki piksel değeri; bahçe dışı/ızgara dışı ise null. */
export function valueAt(g: PGrid, lng: number, lat: number): number | null {
  const [c, r] = lngLatToCell(g, lng, lat)
  const col = Math.floor(c)
  const row = Math.floor(r)
  if (col < 0 || row < 0 || col >= g.cols || row >= g.rows) return null
  const v = g.values[row * g.cols + col]
  return Number.isFinite(v) ? v : null
}

/** Değerin bahçe içindeki yüzdelik sırası (0–100): «bahçenin %15'i bundan zayıf». */
export function percentileOf(g: PGrid, value: number): number {
  const vals = finiteValues(g)
  if (!vals.length) return 0
  return (vals.filter((v) => v < value).length / vals.length) * 100
}

export interface Bin {
  from: number
  to: number
  share: number
}
export function histogram(g: PGrid, domain: [number, number], bins = 24): Bin[] {
  const vals = finiteValues(g)
  const [lo, hi] = domain
  const step = (hi - lo) / bins || 1
  const counts = new Array<number>(bins).fill(0)
  vals.forEach((v) => counts[Math.min(bins - 1, Math.max(0, Math.floor((v - lo) / step)))]++)
  return counts.map((c, i) => ({ from: lo + i * step, to: lo + (i + 1) * step, share: vals.length ? c / vals.length : 0 }))
}

/** Konturda adım: aralığın ~6 parçası, 0,01'e yuvarlı. */
export const contourStep = (domain: [number, number]): number => Math.max(0.01, Math.ceil(((domain[1] - domain[0]) / 6) * 100) / 100)

function fillGaps(g: PGrid): Float64Array {
  const v = Float64Array.from(g.values)
  const ok = (i: number) => Number.isFinite(v[i])
  let mean = 0
  let n = 0
  v.forEach((x) => Number.isFinite(x) && ((mean += x), n++))
  mean = n ? mean / n : 0
  for (let pass = 0; pass < 6; pass++) {
    const next = Float64Array.from(v)
    for (let r = 0; r < g.rows; r++)
      for (let c = 0; c < g.cols; c++) {
        const i = r * g.cols + c
        if (ok(i)) continue
        let s = 0
        let k = 0
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const rr = r + dr
          const cc = c + dc
          if (rr < 0 || cc < 0 || rr >= g.rows || cc >= g.cols) continue
          const j = rr * g.cols + cc
          if (ok(j)) {
            s += v[j]
            k++
          }
        }
        if (k) next[i] = s / k
      }
    v.set(next)
  }
  for (let i = 0; i < v.length; i++) if (!ok(i)) v[i] = mean
  return v
}

export interface PaintOptions {
  ramp: Stops
  domain: [number, number]
  /** Tuval büyütmesi (piksel başına); net piksel için en yakın komşu */
  scale?: number
  /** Eş değer çizgileri (adım); null = yok */
  contour?: number | null
  /** Bahçe sınırı halkası [boylam, enlem]; dışı çizilmez */
  clip?: number[][] | null
  /** Vurgulu aralık: dışındaki pikseller soluk (histogram hover) */
  highlight?: [number, number] | null
  /** Görsel dil: sürekli renk (varsayılan), orantılı kareler (LAI) ya da toprak zemin + tepe daireleri (MSAVI) */
  gorunum?: 'rampa' | 'kareler' | 'daireler'
}

const toCanvas = (g: PGrid, scale: number, [lng, lat]: number[]): [number, number] => {
  const [c, r] = lngLatToCell(g, lng, lat)
  return [c * scale, r * scale]
}

/**
 * Orantılı şekiller: her piksel hücresinde değere göre büyüyen bir şekil.
 * - kareler (LAI): nötr zemin üzerinde, kenar uzunluğu değerle orantılı koyu yeşil kareler (alan = değer).
 * - daireler (MSAVI): toprak tonlu zemin üzerinde, yarıçapı değerle orantılı ağaç tepesi daireleri (alan = değer).
 * Veri yok (NaN) hücre boş kalır (uydurma yok). Histogram vurgusu dışındaki şekiller soluk çizilir.
 */
function paintShapes(
  ctx: CanvasRenderingContext2D,
  g: PGrid,
  { ramp, domain, scale, highlight, gorunum }: { ramp: Stops; domain: [number, number]; scale: number; highlight: [number, number] | null; gorunum: 'kareler' | 'daireler' },
): void {
  const span = domain[1] - domain[0] || 1
  ctx.fillStyle = gorunum === 'daireler' ? ZEMIN.toprak : ZEMIN.notr
  ctx.fillRect(0, 0, g.cols * scale, g.rows * scale)
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      const v = g.values[r * g.cols + c]
      if (!Number.isFinite(v)) continue
      const t = Math.min(1, Math.max(0, (v - domain[0]) / span))
      const dim = highlight !== null && (v < highlight[0] || v > highlight[1])
      const [cr, cg, cb] = rampColor(ramp, gorunum === 'kareler' ? 0.85 : t)
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${dim ? 0.18 : 1})`
      const cx = (c + 0.5) * scale
      const cy = (r + 0.5) * scale
      if (gorunum === 'kareler') {
        const side = scale * (0.12 + 0.88 * t) // kenar ∝ değer (en küçük değer de görünür kalır)
        ctx.fillRect(cx - side / 2, cy - side / 2, side, side)
      } else {
        const radius = (scale / 2) * (0.18 + 0.82 * Math.sqrt(t)) // alan ∝ değer
        ctx.beginPath()
        ctx.arc(cx, cy, radius, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
}

/** Izgarayı tuvale boyar (bahçe dışı saydam). Kontur etiketleri çakışmasız yerleştirilir (çakışan etiket atlanır). */
export function paintGrid(g: PGrid, { ramp, domain, scale = 4, contour = null, clip = null, highlight = null, gorunum = 'rampa' }: PaintOptions): HTMLCanvasElement {
  const small = document.createElement('canvas')
  small.width = g.cols
  small.height = g.rows
  const sctx = small.getContext('2d')!
  const img = sctx.createImageData(g.cols, g.rows)
  const span = domain[1] - domain[0] || 1
  for (let i = 0; i < g.values.length; i++) {
    const v = g.values[i]
    if (!Number.isFinite(v)) continue
    const [r, gg, b] = rampColor(ramp, (v - domain[0]) / span)
    const dim = highlight && (v < highlight[0] || v > highlight[1])
    img.data.set([r, gg, b, dim ? 60 : 255], i * 4)
  }
  sctx.putImageData(img, 0, 0)
  const out = document.createElement('canvas')
  out.width = g.cols * scale
  out.height = g.rows * scale
  const ctx = out.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  if (clip?.length) {
    ctx.beginPath()
    clip.forEach((pt, i) => {
      const [x, y] = toCanvas(g, scale, pt)
      if (i) ctx.lineTo(x, y)
      else ctx.moveTo(x, y)
    })
    ctx.closePath()
    ctx.clip()
  }
  if (gorunum !== 'rampa') {
    paintShapes(ctx, g, { ramp, domain, scale, highlight, gorunum })
    return out
  }
  ctx.drawImage(small, 0, 0, out.width, out.height)

  if (contour) {
    const filled = fillGaps(g)
    const thresholds: number[] = []
    for (let t = Math.ceil(domain[0] / contour) * contour; t < domain[1]; t += contour) thresholds.push(+t.toFixed(4))
    const polys = contours().size([g.cols, g.rows]).thresholds(thresholds)(Array.from(filled))
    const layer = document.createElement('canvas')
    layer.width = out.width
    layer.height = out.height
    const c = layer.getContext('2d')!
    c.scale(scale, scale)
    c.lineJoin = 'round'
    c.strokeStyle = 'rgba(23,32,27,.78)'
    c.lineWidth = 1.1 / scale
    polys.forEach((poly) => {
      c.beginPath()
      for (const ring of poly.coordinates) for (const part of ring) part.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)))
      c.stroke()
    })
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.globalCompositeOperation = 'destination-in'
    c.drawImage(out, 0, 0) // yalnız bahçe içinde
    ctx.drawImage(layer, 0, 0)
    // Etiketler: her eşik için en uzun halkanın orta noktası; kutular çakışırsa atlanır
    const fontPx = Math.max(10, Math.round(scale * 1.6))
    ctx.font = `600 ${fontPx}px Manrope, system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const placed: [number, number, number, number][] = []
    polys.forEach((poly) => {
      let best: number[][] = []
      for (const ring of poly.coordinates) for (const part of ring) if (part.length > best.length) best = part
      if (best.length < 16) return
      const [x, y] = best[Math.floor(best.length / 2)]
      const xi = Math.floor(x)
      const yi = Math.floor(y)
      if (xi < 0 || yi < 0 || xi >= g.cols || yi >= g.rows || !Number.isFinite(g.values[yi * g.cols + xi])) return
      const text = poly.value.toFixed(2).replace('.', ',')
      const w = ctx.measureText(text).width + 6
      const box: [number, number, number, number] = [x * scale - w / 2, y * scale - fontPx / 2 - 2, w, fontPx + 4]
      if (placed.some(([bx, by, bw, bh]) => box[0] < bx + bw && box[0] + box[2] > bx && box[1] < by + bh && box[1] + box[3] > by)) return
      placed.push(box)
      ctx.lineWidth = 3.5
      ctx.strokeStyle = 'rgba(255,255,255,.95)'
      ctx.strokeText(text, x * scale, y * scale)
      ctx.fillStyle = '#17201b'
      ctx.fillText(text, x * scale, y * scale)
    })
  }
  return out
}

/** İki ızgaranın farkı (a − b); boyutlar/köşeler farklıysa null (yeniden örnekleme yok: yanlış hizalamayı göstermeyiz). */
export function differenceGrid(a: PGrid, b: PGrid): PGrid | null {
  if (a.rows !== b.rows || a.cols !== b.cols) return null
  const same = a.corners.every((c, i) => Math.abs(c[0] - b.corners[i][0]) < 1e-6 && Math.abs(c[1] - b.corners[i][1]) < 1e-6)
  if (!same) return null
  const values = new Float32Array(a.values.length)
  for (let i = 0; i < values.length; i++) values[i] = a.values[i] - b.values[i]
  return { ...a, values }
}

/** İki yönlü skala için simetrik alan [−m, m]. */
export function symmetricDomain(g: PGrid, lo = 0.02, hi = 0.98): [number, number] {
  const [a, b] = percentileDomain([g], lo, hi)
  const m = Math.max(Math.abs(a), Math.abs(b), 0.01)
  return [-m, m]
}
