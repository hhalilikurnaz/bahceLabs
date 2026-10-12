import { describe, expect, it } from 'vitest'
import { RAMPS, ZONE_SHADES, contrast, deltaE, oklab, parseHex, rampColor } from '@/features/bahcem/lib/paletler'

const L = (hexOrRgb: [number, number, number]) => oklab(hexOrRgb)[0]
const samples = (id: keyof typeof RAMPS) => Array.from({ length: 11 }, (_, i) => rampColor(RAMPS[id], i / 10))

describe('veri paletleri: algısal doğrulama', () => {
  it.each(['canlilik', 'yaprakSuyu'] as const)('%s sıralı: açıklık tek yönlü azalır, uçlar arası belirgin', (id) => {
    const ls = samples(id).map(L)
    for (let i = 1; i < ls.length; i++) expect(ls[i]).toBeLessThan(ls[i - 1])
    expect(ls[0] - ls[ls.length - 1]).toBeGreaterThan(0.45)
  })

  it('değişim iki yönlü: ortası en açık ve nötr, iki kol simetrik açıklıkta', () => {
    const s = samples('degisim').map((c) => oklab(c))
    const mid = s[5]
    expect(Math.hypot(mid[1], mid[2])).toBeLessThan(0.02) // nötr (kroma ≈ 0)
    for (let i = 0; i < 5; i++) expect(s[i][0]).toBeLessThan(s[i + 1][0] + 1e-9)
    for (let i = 5; i < 10; i++) expect(s[i][0]).toBeGreaterThan(s[i + 1][0] - 1e-9)
    expect(Math.abs(s[0][0] - s[10][0])).toBeLessThan(0.08)
  })

  it('bölge dereceleri: tek ton, komşular arası ΔE ≥ 15 (renk körlüğünde de açıklık farkı)', () => {
    const z = [1, 2, 3].map((k) => parseHex(ZONE_SHADES[k]))
    expect(deltaE(z[0], z[1])).toBeGreaterThan(15)
    expect(deltaE(z[1], z[2])).toBeGreaterThan(15)
    const ls = z.map(L)
    expect(ls[0]).toBeGreaterThan(ls[1])
    expect(ls[1]).toBeGreaterThan(ls[2])
  })

  it('metin kontrastı AA (açık tema): mürekkep ve ikincil metin beyaz kartta', () => {
    expect(contrast(parseHex('#17201b'), parseHex('#ffffff'))).toBeGreaterThan(4.5)
    expect(contrast(parseHex('#58615a'), parseHex('#ffffff'))).toBeGreaterThan(4.5)
    expect(contrast(parseHex('#687068'), parseHex('#ffffff'))).toBeGreaterThan(4.5)
    expect(contrast(parseHex('#a6aea6'), parseHex('#181d19'))).toBeGreaterThan(4.5) // koyu tema ikincil
  })
})
