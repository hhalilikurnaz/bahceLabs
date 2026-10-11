import { describe, expect, it } from 'vitest'
import { distanceM, formatLength, nearestVertex, ringSegments, type LngLat } from '@/features/bahcem/lib/measure'

describe('çizim ölçümleri', () => {
  it('enlemde 1° ≈ 111,2 km; boylamda enleme göre kısalır', () => {
    expect(distanceM([30, 40], [30, 41])).toBeCloseTo(111_195, -2)
    expect(distanceM([30, 0], [31, 0])).toBeGreaterThan(distanceM([30, 60], [31, 60]) * 1.9)
    expect(distanceM([30, 40], [30, 40])).toBe(0)
  })

  it('kapalı halkanın kenarları: tekrar eden son köşe atlanır, uzunluklar doğru', () => {
    const d = 0.001 // ≈ 111 m
    const ring: LngLat[] = [[30, 40], [30, 40 + d], [30 + d, 40 + d], [30 + d, 40], [30, 40]]
    const segments = ringSegments(ring, true)
    expect(segments).toHaveLength(4)
    expect(segments[0].lengthM).toBeCloseTo(111.2, 0)
    expect(segments[0].mid).toEqual([30, 40 + d / 2])
  })

  it('çizim sürerken (açık halka) kapanış kenarı yoktur; yinelenen köşe kenar üretmez', () => {
    expect(ringSegments([[30, 40], [30, 40.001], [30.001, 40.001]], false)).toHaveLength(2)
    expect(ringSegments([[30, 40], [30, 40], [30, 40.001]], false)).toHaveLength(1)
  })

  it('uzunluk biçimi', () => {
    expect(formatLength(12.4)).toBe('12 m')
    expect(formatLength(999.6)).toBe('1.000 m')
    expect(formatLength(1234)).toBe('1,2 km')
  })

  it('en yakın köşe yalnızca piksel toleransı içindeyse seçilir', () => {
    const project = (v: LngLat) => ({ x: v[0] * 1000, y: v[1] * 1000 })
    const vertices: LngLat[] = [[1, 1], [1.02, 1]]
    expect(nearestVertex({ x: 1005, y: 1000 }, vertices, project, 12)).toEqual([1, 1])
    expect(nearestVertex({ x: 1018, y: 1000 }, vertices, project, 12)).toEqual([1.02, 1])
    expect(nearestVertex({ x: 1500, y: 1000 }, vertices, project, 12)).toBeUndefined()
    expect(nearestVertex({ x: 0, y: 0 }, [], project, 12)).toBeUndefined()
  })
})
