import { describe, expect, it } from 'vitest'
import type { NdviObservation } from '@/features/bahcem/api/ndviApi'
import {
  formatNdvi,
  ndviColor,
  ndviGradient,
  ndviRgb,
  NDVI_STOPS,
  pickActiveObservation,
} from '@/features/bahcem/lib/ndvi'

const obs = (tarih: string, durum: 'tamam' | 'bulutlu' = 'tamam', pngVar = durum === 'tamam'): NdviObservation => ({
  tarih,
  durum,
  sceneId: `s-${tarih}`,
  bulutOrani: null,
  gecerliPikselOrani: 1,
  ortalama: durum === 'tamam' ? 0.5 : null,
  medyan: null,
  p10: null,
  p90: null,
  min: null,
  max: null,
  pngVar,
  koordinatlar: null,
  sorunluBolgeSayisi: 0,
  kaynak: 'sentinel-2',
  surum: 1,
})

describe('NDVI renk skalası', () => {
  it('duraklarda tam renk verir (backend COLOR_STOPS ile aynı)', () => {
    for (const [value, rgb] of NDVI_STOPS) expect(ndviRgb(value)).toEqual(rgb)
  })

  it('kırmızı → sarı → yeşil ve uçlara kırpar', () => {
    const [r0, g0] = ndviRgb(0)
    const [r9, g9] = ndviRgb(0.9)
    expect(r0).toBeGreaterThan(200)
    expect(g0).toBeLessThan(80)
    expect(g9).toBeGreaterThan(r9)
    expect(ndviRgb(-0.4)).toEqual(ndviRgb(0))
    expect(ndviRgb(1.2)).toEqual(ndviRgb(0.9))
    expect(ndviColor(0.5)).toBe('rgb(254 224 139)')
  })

  it('ara değerleri doğrusal karıştırır', () => {
    const [r] = ndviRgb(0.15) // 0,0 (215) ile 0,3 (252) arasının ortası
    expect(r).toBe(Math.round((215 + 252) / 2))
  })

  it('lejant gradyanı tüm durakları içerir', () => {
    const gradient = ndviGradient()
    expect(gradient.startsWith('linear-gradient(to right')).toBe(true)
    expect(gradient).toContain('rgb(215 48 39) 0%')
    expect(gradient).toContain('rgb(26 152 80) 100%')
  })
})

describe('biçimlendirme', () => {
  it('Türkçe ondalık', () => {
    expect(formatNdvi(0.456)).toBe('0,46')
    expect(formatNdvi(null)).toBe('—')
  })
})

describe('pickActiveObservation', () => {
  const series = [obs('2026-09-01'), obs('2026-09-06', 'bulutlu'), obs('2026-09-11'), obs('2026-09-16', 'bulutlu')]

  it('seçili tarih geçerliyse onu verir', () => {
    expect(pickActiveObservation(series, '2026-09-01')?.tarih).toBe('2026-09-01')
  })

  it('seçim yoksa veya bulutluysa en son geçerli görüntüye düşer', () => {
    expect(pickActiveObservation(series, null)?.tarih).toBe('2026-09-11')
    expect(pickActiveObservation(series, '2026-09-06')?.tarih).toBe('2026-09-11')
    expect(pickActiveObservation(series, '2020-01-01')?.tarih).toBe('2026-09-11')
  })

  it('geçerli görüntü yoksa null', () => {
    expect(pickActiveObservation([obs('2026-09-06', 'bulutlu')], null)).toBeNull()
    expect(pickActiveObservation(undefined, null)).toBeNull()
  })
})
