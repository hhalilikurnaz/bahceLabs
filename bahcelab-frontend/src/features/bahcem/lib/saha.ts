/** Saha Defteri yardımcıları (SAF). */
import type { Kayit, KayitTuru } from '../api/sahaApi'

/** Bugünün Europe/Istanbul takvim günü (YYYY-AA-GG): sunucu «bugün»ü ile aynı. */
export function bugunIstanbul(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

/** Haritadan toplanan köşelerden GeoJSON çokgeni (en az 3 köşe; halka kapatılır). Yetersizse null. */
export function koseleriCokgene(koseler: [number, number][]): GeoJSON.Polygon | null {
  if (koseler.length < 3) return null
  return { type: 'Polygon', coordinates: [[...koseler, koseler[0]]] }
}

export const noktaMi = (g: GeoJSON.Point | GeoJSON.Polygon | null): g is GeoJSON.Point => g?.type === 'Point'

/** Alanın harita üzerindeki temsilî noktası (köşelerin ortalaması): işaret düğmesi için. */
export function temsilNoktasi(g: GeoJSON.Point | GeoJSON.Polygon): [number, number] {
  if (g.type === 'Point') return g.coordinates as [number, number]
  const ring = g.coordinates[0].slice(0, -1)
  return [ring.reduce((s, c) => s + c[0], 0) / ring.length, ring.reduce((s, c) => s + c[1], 0) / ring.length]
}

export function turSuz(kayitlar: Kayit[], turler: ReadonlySet<KayitTuru>): Kayit[] {
  return turler.size === 0 ? kayitlar : kayitlar.filter((k) => turler.has(k.tur))
}

/** 540 m / 1,2 km biçimi. */
export function mesafe(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1).replace('.', ',')} km` : `${Math.round(m)} m`
}

/** Haversine mesafesi (m); sunucu ile aynı formül (rota ve doğrulama için). */
export function haversine(a: [number, number], b: [number, number]): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const h = Math.sin(rad(b[1] - a[1]) / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(rad(b[0] - a[0]) / 2) ** 2
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h))
}
