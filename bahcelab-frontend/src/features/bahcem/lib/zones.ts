import type { IndexId } from './indices'
import { INDEX_DEFS } from './indices'

export type Severity = 'yuksek' | 'orta' | 'dusuk'

/** Bölge ortalaması, bahçe medyanının eşiğin kaç katı altındaysa o kadar şiddetli sayılır. */
const SEVERITY_RATIO = { yuksek: 2, orta: 1.5 } as const

/**
 * Sorunlu bölgenin şiddeti: bahçe medyanı ile bölge ortalaması arasındaki fark, o parametrenin sorun eşiğiyle
 * (backend `indices.py` ile aynı) kıyaslanır. Bölge zaten eşiğin altında olduğundan en düşük sınıf "düşük"tür.
 */
export function zoneSeverity(indeks: IndexId, zoneMean: number | null, gardenMedian: number): Severity {
  if (zoneMean === null) return 'dusuk'
  const ratio = (gardenMedian - zoneMean) / INDEX_DEFS[indeks].sorunEsigi
  if (ratio >= SEVERITY_RATIO.yuksek) return 'yuksek'
  if (ratio >= SEVERITY_RATIO.orta) return 'orta'
  return 'dusuk'
}

export const SEVERITY_LABEL: Record<Severity, string> = { yuksek: 'Yüksek', orta: 'Orta', dusuk: 'Düşük' }
export const SEVERITY_ORDER: Record<Severity, number> = { yuksek: 0, orta: 1, dusuk: 2 }

type Ring = number[][]

/** Chaikin köşe kesme: sınırı `iterations` tur yumuşatır (kapalı halka; ilk/son nokta aynı kalır). */
export function smoothRing(ring: Ring, iterations: number): Ring {
  let pts = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : ring
  if (pts.length < 3) return ring
  for (let i = 0; i < iterations; i++) {
    const next: Ring = []
    for (let j = 0; j < pts.length; j++) {
      const a = pts[j]
      const b = pts[(j + 1) % pts.length]
      next.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]], [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]])
    }
    pts = next
  }
  return [...pts, pts[0]]
}

/** Poligon/çoklu poligon geometrisinin tüm halkalarını yumuşatır; diğer geometriler olduğu gibi kalır. */
export function smoothGeometry(geometry: GeoJSON.Geometry, iterations: number): GeoJSON.Geometry {
  if (iterations <= 0) return geometry
  if (geometry.type === 'Polygon') return { ...geometry, coordinates: geometry.coordinates.map((r) => smoothRing(r, iterations)) }
  if (geometry.type === 'MultiPolygon') {
    return { ...geometry, coordinates: geometry.coordinates.map((poly) => poly.map((r) => smoothRing(r, iterations))) }
  }
  return geometry
}

/** Bölge ortalamaları birbirine, parametre aralığının `share` payından yakınsa bahçe homojendir. */
export function isHomogeneous(means: readonly number[], indeks: IndexId, share: number): boolean {
  if (means.length < 2) return true
  const def = INDEX_DEFS[indeks]
  return Math.max(...means) - Math.min(...means) < share * (def.max - def.min)
}
