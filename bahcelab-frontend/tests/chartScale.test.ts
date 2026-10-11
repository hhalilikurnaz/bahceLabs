import { describe, expect, it } from 'vitest'
import { monthLabelStep, niceTicks, paddedDomain } from '@/features/bahcem/lib/chartScale'

const FALLBACK = { min: 0, max: 1 }

describe('grafik ekseni', () => {
  it('değer aralığı dolgu payıyla genişler', () => {
    const d = paddedDomain([0.4, 0.6], 0.1, 0.05, FALLBACK)
    expect(d.min).toBeCloseTo(0.38)
    expect(d.max).toBeCloseTo(0.62)
  })

  it('tüm değerler aynıysa en az minSpan kadar açılır', () => {
    const d = paddedDomain([0.5, 0.5], 0, 0.1, FALLBACK)
    expect(d.max - d.min).toBeCloseTo(0.1)
    expect((d.max + d.min) / 2).toBeCloseTo(0.5)
  })

  it('veri yoksa ve sonsuz/NaN değerlerde varsayılan kullanılır', () => {
    expect(paddedDomain([], 0.1, 0.05, FALLBACK)).toEqual(FALLBACK)
    expect(paddedDomain([NaN], 0.1, 0.05, FALLBACK)).toEqual(FALLBACK)
  })

  it('çentikler yuvarlak adımlıdır ve aralığın içindedir', () => {
    const ticks = niceTicks({ min: 0.38, max: 0.62 }, 4)
    expect(ticks).toEqual([0.4, 0.5, 0.6])
    expect(niceTicks({ min: 0, max: 0.9 }, 4).every((t) => t >= 0 && t <= 0.9)).toBe(true)
  })

  it('geçersiz aralıkta tek çentik döner', () => {
    expect(niceTicks({ min: 1, max: 1 }, 4)).toEqual([1])
  })

  it('ay etiketleri dar alanda atlanır, kesilmez', () => {
    expect(monthLabelStep(600, 30)).toBe(1)
    expect(monthLabelStep(300, 30)).toBe(2)
    expect(monthLabelStep(150, 30)).toBe(3)
  })
})
