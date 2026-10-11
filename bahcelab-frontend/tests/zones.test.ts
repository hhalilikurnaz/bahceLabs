import { describe, expect, it } from 'vitest'
import { SEVERITY_ORDER, zoneSeverity } from '@/features/bahcem/lib/zones'

describe('sorunlu bölge şiddeti', () => {
  // NDVI sorun eşiği 0,10
  it('eşiğin 2 katı ve üstü yüksek', () => {
    expect(zoneSeverity('ndvi', 0.3, 0.5)).toBe('yuksek')
    expect(zoneSeverity('ndvi', 0.1, 0.5)).toBe('yuksek')
  })

  it('1,5–2 kat orta', () => {
    expect(zoneSeverity('ndvi', 0.34, 0.5)).toBe('orta')
  })

  it('eşiğe yakın düşük', () => {
    expect(zoneSeverity('ndvi', 0.4, 0.5)).toBe('dusuk')
  })

  it('parametre eşiğine göre ölçeklenir (NDRE eşiği 0,05)', () => {
    expect(zoneSeverity('ndre', 0.3, 0.4)).toBe('yuksek')
    expect(zoneSeverity('ndvi', 0.4, 0.5)).toBe('dusuk')
  })

  it('değer yoksa düşük; sıralama yüksekten düşüğe', () => {
    expect(zoneSeverity('ndvi', null, 0.5)).toBe('dusuk')
    expect(SEVERITY_ORDER.yuksek).toBeLessThan(SEVERITY_ORDER.orta)
    expect(SEVERITY_ORDER.orta).toBeLessThan(SEVERITY_ORDER.dusuk)
  })
})
