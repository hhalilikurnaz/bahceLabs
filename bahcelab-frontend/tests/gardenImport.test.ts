import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/apiClient'
import { describeError } from '@/features/bahcem/api/gardensApi'
import {
  geometryAreaDekar,
  geometryBounds,
  largestOuterRing,
  ringAreaM2,
  unionBounds,
} from '@/features/bahcem/lib/geo'
import { ImportError, extractPolygons } from '@/features/bahcem/lib/importFile'

const square = (lng: number, lat: number, d = 0.001) => [
  [lng, lat],
  [lng + d, lat],
  [lng + d, lat + d],
  [lng, lat + d],
  [lng, lat],
]

describe('extractPolygons', () => {
  it('FeatureCollection içinden yalnızca poligonları alır, adları korur', () => {
    const polygons = extractPolygons({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: { name: 'Kuzey' }, geometry: { type: 'Polygon', coordinates: [square(34, 36)] } },
        { type: 'Feature', properties: { name: 'Nokta' }, geometry: { type: 'Point', coordinates: [34, 36] } },
        { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[34, 36], [34.1, 36.1]] } },
        { type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: [[square(35, 36)], [square(36, 36)]] } },
      ],
    })
    expect(polygons.map((p) => [p.name, p.geometry.type])).toEqual([
      ['Kuzey', 'Polygon'],
      ['Poligon 2', 'MultiPolygon'],
    ])
    expect(polygons[0].areaDekar).toBeGreaterThan(0)
  })

  it('çıplak geometri ve GeometryCollection kabul eder', () => {
    expect(extractPolygons({ type: 'Polygon', coordinates: [square(34, 36)] })).toHaveLength(1)
    expect(
      extractPolygons({
        type: 'GeometryCollection',
        geometries: [{ type: 'Polygon', coordinates: [square(34, 36)] }, { type: 'Point', coordinates: [1, 2] }],
      }),
    ).toHaveLength(1)
  })

  it('yükseklik (z) değerlerini atar', () => {
    const [polygon] = extractPolygons({
      type: 'Polygon',
      coordinates: [square(34, 36).map(([x, y]) => [x, y, 120])],
    })
    expect(polygon.geometry.coordinates[0].flat().length).toBe(10) // 5 köşe × 2
  })

  it('poligon yoksa boş döner', () => {
    expect(extractPolygons({ type: 'Point', coordinates: [34, 36] })).toEqual([])
    expect(extractPolygons(null)).toEqual([])
  })

  it('boylam/enlem dışı (projeksiyonlu) koordinatları reddeder', () => {
    expect(() =>
      extractPolygons({ type: 'Polygon', coordinates: [[[500000, 4000000], [500100, 4000000], [500100, 4000100], [500000, 4000000]]] }),
    ).toThrow(ImportError)
  })
})

describe('alan ve sınır yardımcıları', () => {
  it('100 m × 100 m kare ≈ 10 dekar (±%0,5)', () => {
    const lat = 36.66
    const dLat = 100 / 110950
    const dLng = 100 / (111320 * Math.cos((lat * Math.PI) / 180))
    const ring = [[34, lat], [34 + dLng, lat], [34 + dLng, lat + dLat], [34, lat + dLat], [34, lat]]
    expect(ringAreaM2(ring) / 1000).toBeCloseTo(10, 1)
    expect(Math.abs(ringAreaM2(ring) - 10000) / 10000).toBeLessThan(0.005)
  })

  it('iç halka alanı düşer', () => {
    const outer = square(34, 36, 0.002)
    const hole = square(34.0005, 36.0005, 0.0005)
    const full = geometryAreaDekar({ type: 'Polygon', coordinates: [outer] })
    const holed = geometryAreaDekar({ type: 'Polygon', coordinates: [outer, hole] })
    expect(holed).toBeLessThan(full)
  })

  it('sınırlar ve birleşim', () => {
    const a = geometryBounds({ type: 'Polygon', coordinates: [square(34, 36)] })
    const b = geometryBounds({ type: 'MultiPolygon', coordinates: [[square(35, 37)], [square(36, 38)]] })
    expect(a).toEqual([[34, 36], [34.001, 36.001]])
    expect(unionBounds([a, b])).toEqual([[34, 36], [36.001, 38.001]])
    expect(unionBounds([])).toBeNull()
  })

  it('MultiPolygon için en büyük parçanın halkasını verir', () => {
    const ring = largestOuterRing({
      type: 'MultiPolygon',
      coordinates: [[square(34, 36, 0.001)], [square(35, 36, 0.005)]],
    })
    expect(ring[0][0]).toBe(35)
  })
})

describe('describeError', () => {
  it('422 doğrulama mesajını Türkçe olarak çıkarır', () => {
    const err = new ApiError(422, 'VALIDATION_ERROR', 'Request validation failed', {
      errors: [{ msg: 'Value error, Bahçe adı boş olamaz.' }],
    })
    expect(describeError(err)).toBe('Bahçe adı boş olamaz.')
  })

  it('geometri hatasında sunucu mesajını kullanır', () => {
    const err = new ApiError(422, 'INVALID_GEOMETRY', 'Bahçe en az 0,5 dekar olmalı.')
    expect(describeError(err)).toBe('Bahçe en az 0,5 dekar olmalı.')
  })

  it('ağ hatasında genel mesaj verir', () => {
    expect(describeError(new TypeError('Failed to fetch'))).toContain('Sunucuya ulaşılamadı')
  })
})
