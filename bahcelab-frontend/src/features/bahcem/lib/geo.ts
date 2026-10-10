import type { GardenGeometry, PolygonCoordinates, Position } from '../api/types'

export type Ring = [number, number][]

/** 1 dekar = 1000 m². Küçük alanlarda daha fazla ondalık gösterilir. */
export function formatDecare(decare: number | null | undefined): string {
  if (decare == null || !Number.isFinite(decare)) return '—'
  const digits = decare < 1 ? 2 : decare < 100 ? 1 : 0
  return `${decare.toLocaleString('tr-TR', { minimumFractionDigits: digits, maximumFractionDigits: digits })} dekar`
}

/**
 * Poligon halkasını küçük resim için SVG yoluna çevirir (viewBox 0 0 size size).
 * Boylam, enleme göre cos(enlem) ile ölçeklenir ki şekil bozulmasın.
 */
export function silhouettePath(ring: Ring, size = 40, padding = 4): string {
  if (ring.length < 3) return ''
  const meanLat = ring.reduce((sum, [, lat]) => sum + lat, 0) / ring.length
  const xScale = Math.cos((meanLat * Math.PI) / 180)
  const pts = ring.map(([lng, lat]) => [lng * xScale, -lat] as const)

  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const w = Math.max(...xs) - minX
  const h = Math.max(...ys) - minY
  const span = Math.max(w, h)
  if (span === 0) return ''

  const inner = size - padding * 2
  const scale = inner / span
  const offX = padding + (inner - w * scale) / 2
  const offY = padding + (inner - h * scale) / 2

  return (
    pts
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${(offX + (x - minX) * scale).toFixed(1)} ${(offY + (y - minY) * scale).toFixed(1)}`)
      .join(' ') + ' Z'
  )
}


/** Geometrideki tüm poligonlar (MultiPolygon için her parça ayrı) */
export function polygonsOf(geometry: GardenGeometry): PolygonCoordinates[] {
  return geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
}

/** [[batı, güney], [doğu, kuzey]] */
export function geometryBounds(geometry: GardenGeometry): [Position, Position] {
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity
  for (const polygon of polygonsOf(geometry)) {
    for (const [lng, lat] of polygon[0] ?? []) {
      west = Math.min(west, lng)
      east = Math.max(east, lng)
      south = Math.min(south, lat)
      north = Math.max(north, lat)
    }
  }
  return [
    [west, south],
    [east, north],
  ]
}

export function unionBounds(boundsList: [Position, Position][]): [Position, Position] | null {
  if (boundsList.length === 0) return null
  return [
    [Math.min(...boundsList.map((b) => b[0][0])), Math.min(...boundsList.map((b) => b[0][1]))],
    [Math.max(...boundsList.map((b) => b[1][0])), Math.max(...boundsList.map((b) => b[1][1]))],
  ]
}

export function boundsCenter(bounds: [Position, Position]): Position {
  return [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2]
}

/** Silüet için en büyük parçanın dış halkası */
export function largestOuterRing(geometry: GardenGeometry): Ring {
  const rings = polygonsOf(geometry).map((p) => p[0] ?? [])
  return rings.reduce<Ring>((best, ring) => (ringAreaM2(ring) > ringAreaM2(best) ? ring : best), [])
}

/** Enlem başına derece→metre (WGS84 serisi); küçük alanlar için <%0,01 hata */
function metersPerDegree(latDeg: number): { lat: number; lng: number } {
  const phi = (latDeg * Math.PI) / 180
  return {
    lat: 111132.92 - 559.82 * Math.cos(2 * phi) + 1.175 * Math.cos(4 * phi),
    lng: 111412.84 * Math.cos(phi) - 93.5 * Math.cos(3 * phi),
  }
}

/** Halka alanı (m²), yerel düzlemde. Çizim sırasında canlı gösterge içindir; kayıtta sunucu hesaplar. */
export function ringAreaM2(ring: readonly (readonly number[])[]): number {
  if (ring.length < 3) return 0
  const meanLat = ring.reduce((sum, p) => sum + p[1], 0) / ring.length
  const meanLng = ring.reduce((sum, p) => sum + p[0], 0) / ring.length
  const scale = metersPerDegree(meanLat)
  let twice = 0
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]
    const b = ring[(i + 1) % ring.length]
    twice += (a[0] - meanLng) * scale.lng * (b[1] - meanLat) * scale.lat
    twice -= (b[0] - meanLng) * scale.lng * (a[1] - meanLat) * scale.lat
  }
  return Math.abs(twice) / 2
}

/** Geometrinin yaklaşık alanı (dekar): dış halkalar − iç halkalar */
export function geometryAreaDekar(geometry: GardenGeometry): number {
  let m2 = 0
  for (const [outer, ...holes] of polygonsOf(geometry)) {
    m2 += ringAreaM2(outer ?? [])
    for (const hole of holes) m2 -= ringAreaM2(hole)
  }
  return m2 / 1000
}
