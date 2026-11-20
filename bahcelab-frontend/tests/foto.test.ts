import { describe, expect, it } from 'vitest'
import { KALITE_BASAMAKLARI, kaliteSec, olcekle } from '@/features/bahcem/lib/foto'

describe('fotoğraf küçültme (saf kısım)', () => {
  it('uzun kenar sınırı aşmaz, oran korunur, küçük görüntü büyütülmez', () => {
    expect(olcekle(4000, 3000, 2048)).toEqual({ w: 2048, h: 1536 })
    expect(olcekle(3000, 4000, 2048)).toEqual({ w: 1536, h: 2048 })
    expect(olcekle(1000, 800, 2048)).toEqual({ w: 1000, h: 800 })
    expect(olcekle(2048, 1000, 2048)).toEqual({ w: 2048, h: 1000 })
    const { w, h } = olcekle(12000, 1, 2048)
    expect(w).toBe(2048)
    expect(h).toBeGreaterThanOrEqual(1)
  })
  it('hedef boyuta ilk uyan kalite seçilir; hiçbiri uymazsa en düşük', () => {
    expect(KALITE_BASAMAKLARI[0]).toBeGreaterThan(KALITE_BASAMAKLARI[KALITE_BASAMAKLARI.length - 1])
    expect(kaliteSec([1_400_000, 1_100_000, 950_000, 700_000, 500_000], 1_000_000)).toBe(2)
    expect(kaliteSec([900_000, 800_000], 1_000_000)).toBe(0)
    expect(kaliteSec([3_000_000, 2_000_000], 1_000_000)).toBe(1)
  })
})
