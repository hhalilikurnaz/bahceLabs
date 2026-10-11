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

import { isHomogeneous, smoothRing } from '@/features/bahcem/lib/zones'
import { ZONES } from '@/features/bahcem/lib/config'

describe('bölge sınırı ve homojenlik', () => {
  const square = [[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]]

  it('yumuşatma halkayı kapalı tutar ve köşeleri keser', () => {
    const smooth = smoothRing(square, 1)
    expect(smooth[0]).toEqual(smooth[smooth.length - 1])
    expect(smooth.length).toBe(9)
    expect(smooth.some(([x, y]) => x === 0 && y === 0)).toBe(false)
  })

  it('0 tur ham sınırı korur, çok küçük halkaya dokunmaz', () => {
    expect(smoothRing(square, 0).length).toBe(square.length + 0 - 1 + 1)
    expect(smoothRing([[0, 0], [1, 1]], 2)).toEqual([[0, 0], [1, 1]])
  })

  it('sınıf ortalamaları birbirine yakınsa bahçe homojendir', () => {
    expect(isHomogeneous([0.5, 0.51, 0.52], 'ndvi', ZONES.homogeneityRangeShare)).toBe(true)
    expect(isHomogeneous([0.3, 0.5, 0.7], 'ndvi', ZONES.homogeneityRangeShare)).toBe(false)
    expect(isHomogeneous([0.5], 'ndvi', ZONES.homogeneityRangeShare)).toBe(true)
  })
})
