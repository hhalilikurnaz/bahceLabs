/** Çizim sırasında kenar uzunlukları ve köşe yapışması için SAF yardımcılar. */

export type LngLat = readonly [number, number]

const EARTH_RADIUS_M = 6_371_008.8
const rad = (deg: number) => (deg * Math.PI) / 180

/** İki nokta arasındaki büyük daire (haversine) uzaklığı, metre. */
export function distanceM(a: LngLat, b: LngLat): number {
  const dLat = rad(b[1] - a[1])
  const dLng = rad(b[0] - a[0])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

export interface Segment {
  /** Kenarın orta noktası [boylam, enlem] */
  mid: LngLat
  lengthM: number
}

/** Halkanın kenarları (kapalı halkada son tekrar eden köşe atlanır; `closed=false` ise son köşeden başa kenar yoktur). */
export function ringSegments(ring: readonly LngLat[], closed: boolean): Segment[] {
  const points = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : [...ring]
  const count = closed ? points.length : points.length - 1
  const out: Segment[] = []
  for (let i = 0; i < count; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    if (a[0] === b[0] && a[1] === b[1]) continue // yinelenen köşe: sıfır uzunlukta kenar çizilmez
    out.push({ mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], lengthM: distanceM(a, b) })
  }
  return out
}

/** "12 m", "1,2 km": 1000 m altı tam metre, üstü 1 ondalık kilometre. */
export function formatLength(meters: number): string {
  if (meters < 1000) return `${Math.round(meters).toLocaleString('tr-TR')} m`
  return `${(meters / 1000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} km`
}

/** Ekran koordinatında `point`'e `tolerancePx` içinde en yakın köşe (yoksa undefined). `project`: [boylam, enlem] → ekran. */
export function nearestVertex(
  point: { x: number; y: number },
  vertices: readonly LngLat[],
  project: (v: LngLat) => { x: number; y: number },
  tolerancePx: number,
): LngLat | undefined {
  let best: LngLat | undefined
  let bestDistance = tolerancePx
  for (const vertex of vertices) {
    const p = project(vertex)
    const d = Math.hypot(p.x - point.x, p.y - point.y)
    if (d <= bestDistance) {
      best = vertex
      bestDistance = d
    }
  }
  return best
}

/** Köşe sayısı fazla halkayı (ör. daire) eşit aralıkla seyreltir; kapalı halka olarak döner. */
export function decimateRing(ring: readonly LngLat[], maxVertices: number): LngLat[] {
  const open = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : [...ring]
  const step = Math.max(1, Math.ceil(open.length / maxVertices))
  const kept = open.filter((_, i) => i % step === 0)
  return [...kept, kept[0]]
}

/** Çokgenin ağırlık merkezi (köşelerin ortalaması: daire için merkez) ve ilk köşeye uzaklığı (yarıçap), metre. */
export function circleStats(ring: readonly LngLat[]): { center: LngLat; radiusM: number } {
  const open = ring.length > 1 ? ring.slice(0, -1) : ring
  const center: LngLat = [open.reduce((s, p) => s + p[0], 0) / open.length, open.reduce((s, p) => s + p[1], 0) / open.length]
  return { center, radiusM: distanceM(center, open[0]) }
}
