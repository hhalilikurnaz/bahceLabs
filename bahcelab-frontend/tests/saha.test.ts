import { describe, expect, it } from 'vitest'
import type { Kayit } from '@/features/bahcem/api/sahaApi'
import { bugunIstanbul, haversine, koseleriCokgene, mesafe, temsilNoktasi, turSuz } from '@/features/bahcem/lib/saha'

describe('saha yardımcıları', () => {
  it('bugün Europe/Istanbul takvim günüdür (UTC gece yarısına yakın bile)', () => {
    expect(bugunIstanbul(new Date('2026-10-18T21:30:00Z'))).toBe('2026-10-19') // UTC'de hâlâ 18, İstanbul'da 19
    expect(bugunIstanbul(new Date('2026-10-18T20:59:00Z'))).toBe('2026-10-18')
  })
  it('çokgen en az 3 köşeyle kurulur ve halka kapatılır', () => {
    expect(koseleriCokgene([[27, 38], [27.1, 38]])).toBeNull()
    const poly = koseleriCokgene([[27, 38], [27.1, 38], [27.1, 38.1]])!
    expect(poly.coordinates[0]).toHaveLength(4)
    expect(poly.coordinates[0][0]).toEqual(poly.coordinates[0][3])
    expect(temsilNoktasi(poly)[0]).toBeCloseTo(27.0667, 3)
  })
  it('mesafe metin biçimi ve haversine', () => {
    expect(mesafe(540)).toBe('540 m')
    expect(mesafe(1234)).toBe('1,2 km')
    expect(haversine([27, 38], [27, 38])).toBe(0)
    expect(haversine([27, 38], [27.001, 38])).toBeGreaterThan(80)
  })
  it('tür süzgeci boş kümede hepsini verir', () => {
    const k = (tur: Kayit['tur']) => ({ tur }) as Kayit
    expect(turSuz([k('hasat'), k('gozlem')], new Set())).toHaveLength(2)
    expect(turSuz([k('hasat'), k('gozlem')], new Set(['hasat']))).toHaveLength(1)
  })
})
