import { describe, expect, it } from 'vitest'
import { overlapShare, type Ring } from '../src/features/bahcem/lib/overlap'

const square = (x: number, y: number, s: number): Ring => [[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]]

describe('overlapShare (a alanının b ile örtüşen payı)', () => {
  it('ayrık poligonlar örtüşmez', () => expect(overlapShare(square(0, 0, 1), square(5, 5, 1))).toBe(0))
  it('tamamen içindeyse 1', () => expect(overlapShare(square(0.2, 0.2, 0.2), square(0, 0, 1))).toBeCloseTo(1, 1))
  it('yarı örtüşme ≈ 0,5', () => expect(overlapShare(square(0, 0, 1), square(0.5, 0, 1))).toBeCloseTo(0.5, 1))
  it('yalnız kenar paylaşan komşu parsel uyarı vermez', () => expect(overlapShare(square(0, 0, 1), square(1, 0, 1))).toBeLessThan(0.02))
  it('içbükey (L) poligonda çukur örtüşme sayılmaz', () => {
    const l: Ring = [[0, 0], [2, 0], [2, 1], [1, 1], [1, 2], [0, 2], [0, 0]]
    expect(overlapShare(square(1.2, 1.2, 0.6), l)).toBe(0) // çukurun içinde
  })
})
