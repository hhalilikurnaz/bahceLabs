/** Bahçe sınırı örtüşme denetimi (saf, bağımlılıksız). Dış halka [boylam, enlem]; ızgara örneklemesiyle yaklaşık pay. */
export type Ring = number[][]

const ORNEKLEME = 64

function inside(lng: number, lat: number, ring: Ring): boolean {
  let hit = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

/** `a` alanının `b` ile örtüşen payı (0–1). Yalnız kenar paylaşan komşu parseller (≈ 0) uyarı üretmez. */
export function overlapShare(a: Ring, b: Ring): number {
  const xs = a.map((p) => p[0])
  const ys = a.map((p) => p[1])
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const bx = b.map((p) => p[0])
  const by = b.map((p) => p[1])
  if (maxX < Math.min(...bx) || minX > Math.max(...bx) || maxY < Math.min(...by) || minY > Math.max(...by)) return 0 // sınır kutuları ayrık
  let inA = 0
  let both = 0
  for (let i = 0; i < ORNEKLEME; i++) {
    for (let j = 0; j < ORNEKLEME; j++) {
      const x = minX + ((i + 0.5) / ORNEKLEME) * (maxX - minX)
      const y = minY + ((j + 0.5) / ORNEKLEME) * (maxY - minY)
      if (!inside(x, y, a)) continue
      inA++
      if (inside(x, y, b)) both++
    }
  }
  return inA ? both / inA : 0
}

/** Örtüşme uyarısı eşiği: yeni sınırın bu payından fazlası başka bahçeyle örtüşüyorsa uyarılır. */
export const ORTUSME_ESIGI = 0.02
