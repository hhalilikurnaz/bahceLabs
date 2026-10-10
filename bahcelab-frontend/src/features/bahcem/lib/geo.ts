export type Ring = [number, number][]

/** 1 dekar (dönüm) = 1000 m² */
export function formatDecare(areaM2: number | null | undefined): string {
  if (areaM2 == null || !Number.isFinite(areaM2)) return '—'
  const decare = areaM2 / 1000
  const digits = decare < 10 ? 1 : 0
  return `${decare.toLocaleString('tr-TR', { maximumFractionDigits: digits })} da`
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
