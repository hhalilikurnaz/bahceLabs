import { useQueries } from '@tanstack/react-query'
import { contours } from 'd3-contour'
import { apiRequest } from '@/lib/apiClient'
import { indeksApi, type Scene } from '../../bahcem/api/indeksApi'
import type { IndexId } from '../../bahcem/lib/indices'
import { rampColor } from './palette'

export interface PGrid {
  values: Float32Array
  rows: number
  cols: number
  corners: [number, number][]
}

/** Sahne ızgaralarını (ham değerler) paralel yükler; aynı sahne/indeks bir kez. */
export function useSceneGrids(gardenId: string | null, scenes: Scene[], index: IndexId): Map<string, PGrid> {
  const results = useQueries({
    queries: scenes.map((s) => ({
      queryKey: ['saha-grid', gardenId, index, s.tarih, s.surum],
      queryFn: async (): Promise<PGrid> => {
        const g = await indeksApi.grid(gardenId as string, s, index)
        return { values: g.values, rows: g.rows, cols: g.cols, corners: g.corners as unknown as [number, number][] }
      },
      enabled: gardenId !== null && Boolean(s.indeksler[index]?.veriVar),
      staleTime: Infinity,
    })),
  })
  const out = new Map<string, PGrid>()
  results.forEach((r, i) => r.data && out.set(scenes[i].tarih, r.data))
  return out
}

interface YearValuesApi {
  yil: number
  satir: number
  sutun: number
  koordinatlar: [number, number][]
  degerler: (number | null)[]
}
export function useYearGrids(gardenId: string | null, years: number[]): Map<number, PGrid> {
  const results = useQueries({
    queries: years.map((y) => ({
      queryKey: ['saha-year', gardenId, y],
      queryFn: async (): Promise<PGrid> => {
        const d = await apiRequest<YearValuesApi>(`/gardens/${gardenId}/bolgeler/cok-yillik/yillar/${y}/degerler`)
        return { values: Float32Array.from(d.degerler, (v) => (v == null ? NaN : v)), rows: d.satir, cols: d.sutun, corners: d.koordinatlar }
      },
      enabled: gardenId !== null,
      staleTime: Infinity,
    })),
  })
  const out = new Map<number, PGrid>()
  results.forEach((r, i) => r.data && out.set(years[i], r.data))
  return out
}

export const finite = (g: PGrid): number[] => Array.from(g.values).filter((v) => Number.isFinite(v))

/** Yüzdelik alanı [p2, p98] — aynı ekrandaki tüm küçük haritalar aynı alanı paylaşır. */
export function sharedDomain(grids: PGrid[], lo = 0.02, hi = 0.98): [number, number] {
  const all = grids.flatMap(finite).sort((a, b) => a - b)
  if (!all.length) return [0, 1]
  const at = (p: number) => all[Math.min(all.length - 1, Math.floor(p * all.length))]
  return [at(lo), at(hi)]
}

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
          if (ok(j)) (s += v[j]), k++
        }
        if (k) next[i] = s / k
      }
    v.set(next)
  }
  for (let i = 0; i < v.length; i++) if (!ok(i)) v[i] = mean
  return v
}

export interface PaintOpts {
  domain: [number, number]
  scale?: number
  contourStep?: number | null // değer aralığı; null = kontur yok
  weak?: number | null // bu değerin altı tarama (isteğe bağlı)
  clip?: number[][] | null // bahçe sınırı halkası [boylam, enlem]; dışı çizilmez
}

/** Izgarayı net piksel (en yakın komşu, 10 m) olarak boyar; isteğe bağlı kontur çizgileri (eş değer, her 4.'sü kalın + etiketli). Bahçe dışı saydam. */
/** Boylam/enlem → tuval (ızgara köşelerinden afin çözüm: KB + u·(KD−KB) + v·(GB−KB)). */
function toCanvas(g: PGrid, scale: number, [lng, lat]: number[]): [number, number] {
  const [kb, kd, , gb] = g.corners
  const e1 = [kd[0] - kb[0], kd[1] - kb[1]]
  const e2 = [gb[0] - kb[0], gb[1] - kb[1]]
  const det = e1[0] * e2[1] - e1[1] * e2[0]
  const px = lng - kb[0]
  const py = lat - kb[1]
  const u = (px * e2[1] - py * e2[0]) / det
  const v = (e1[0] * py - e1[1] * px) / det
  return [u * g.cols * scale, v * g.rows * scale]
}

export function paintGrid(g: PGrid, { domain, scale = 4, contourStep = null, weak = null, clip = null }: PaintOpts): HTMLCanvasElement {
  const small = document.createElement('canvas')
  small.width = g.cols
  small.height = g.rows
  const sctx = small.getContext('2d')!
  const img = sctx.createImageData(g.cols, g.rows)
  const span = domain[1] - domain[0] || 1
  for (let i = 0; i < g.values.length; i++) {
    const v = g.values[i]
    if (!Number.isFinite(v)) continue
    const [r, gg, b] = rampColor((v - domain[0]) / span)
    img.data.set([r, gg, b, 255], i * 4)
  }
  sctx.putImageData(img, 0, 0)
  const out = document.createElement('canvas')
  out.width = g.cols * scale
  out.height = g.rows * scale
  const ctx = out.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  if (clip?.length) {
    ctx.beginPath()
    clip.forEach((pt, i) => { const [x, y] = toCanvas(g, scale, pt); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y) })
    ctx.closePath()
    ctx.clip()
  }
  ctx.drawImage(small, 0, 0, out.width, out.height)

  if (weak != null) {
    const hatch = document.createElement('canvas')
    hatch.width = out.width
    hatch.height = out.height
    const h = hatch.getContext('2d')!
    h.strokeStyle = 'rgba(22,24,26,.7)'
    h.lineWidth = 1
    for (let k = -out.height; k < out.width; k += 5) {
      h.beginPath()
      h.moveTo(k, out.height)
      h.lineTo(k + out.height, 0)
      h.stroke()
    }
    const mask = document.createElement('canvas')
    mask.width = g.cols
    mask.height = g.rows
    const m = mask.getContext('2d')!
    const md = m.createImageData(g.cols, g.rows)
    g.values.forEach((v, i) => Number.isFinite(v) && v < weak && md.data.set([0, 0, 0, 255], i * 4))
    m.putImageData(md, 0, 0)
    const big = document.createElement('canvas')
    big.width = out.width
    big.height = out.height
    const b = big.getContext('2d')!
    b.imageSmoothingEnabled = false
    b.drawImage(mask, 0, 0, big.width, big.height)
    h.globalCompositeOperation = 'destination-in'
    h.drawImage(big, 0, 0)
    ctx.drawImage(hatch, 0, 0)
  }

  if (contourStep) {
    const filled = fillGaps(g)
    const lo = Math.ceil(domain[0] / contourStep) * contourStep
    const thresholds: number[] = []
    for (let t = lo; t < domain[1] + contourStep; t += contourStep) thresholds.push(+t.toFixed(4))
    const polys = contours().size([g.cols, g.rows]).thresholds(thresholds)(Array.from(filled))
    const layer = document.createElement('canvas')
    layer.width = out.width
    layer.height = out.height
    const c = layer.getContext('2d')!
    c.scale(scale, scale)
    c.lineJoin = 'round'
    polys.forEach((poly, idx) => {
      const major = idx % 4 === 0
      c.strokeStyle = major ? 'rgba(22,24,26,.92)' : 'rgba(22,24,26,.55)'
      c.lineWidth = (major ? 1.5 : 0.85) / scale * 1.0
      c.beginPath()
      for (const ring of poly.coordinates) for (const part of ring) part.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)))
      c.stroke()
    })
    c.globalCompositeOperation = 'destination-in'
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.drawImage(out, 0, 0) // yalnız bahçe içi
    ctx.drawImage(layer, 0, 0)
    // etiketler (kalın çizgiler): en uzun halkanın ortası
    ctx.font = `600 ${Math.round(1.7 * scale)}px 'JetBrains Mono', monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    polys.forEach((poly, idx) => {
      if (idx % 4 !== 0) return
      let best: number[][] = []
      for (const ring of poly.coordinates) for (const part of ring) if (part.length > best.length) best = part
      if (best.length < 26) return
      const [x, y] = best[Math.floor(best.length / 2)]
      const xi = Math.round(x)
      const yi = Math.round(y)
      if (xi < 0 || yi < 0 || xi >= g.cols || yi >= g.rows || !Number.isFinite(g.values[yi * g.cols + xi])) return
      const text = poly.value.toFixed(2).replace('.', ',')
      ctx.lineWidth = 3
      ctx.strokeStyle = 'rgba(251,250,246,.95)'
      ctx.strokeText(text, x * scale, y * scale)
      ctx.fillStyle = '#16181a'
      ctx.fillText(text, x * scale, y * scale)
    })
  }
  return out
}
