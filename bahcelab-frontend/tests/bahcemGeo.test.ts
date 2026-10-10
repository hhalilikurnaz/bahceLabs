import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseCoordinates } from '@/features/bahcem/map/geocoding'
import { formatDecare, silhouettePath } from '@/features/bahcem/lib/geo'
import { DEFAULT_VIEW, loadView, saveView } from '@/features/bahcem/map/viewStorage'

describe('parseCoordinates', () => {
  it.each([
    ['36.72, 34.34', 36.72, 34.34],
    ['36.72 34.34', 36.72, 34.34],
    ['36,72;34,34', 36.72, 34.34],
    ['  36.72,34.34 ', 36.72, 34.34],
    ['-33.9, 151.2', -33.9, 151.2],
  ])('%s → enlem/boylam', (input, lat, lng) => {
    expect(parseCoordinates(input)).toEqual({ lat, lng })
  })

  it('ilk değer 90 üstündeyse boylam-enlem sırası sayılır', () => {
    expect(parseCoordinates('151.2, -33.9')).toEqual({ lat: -33.9, lng: 151.2 })
  })

  it.each(['Mersin', '36.72', '95, 200', '36.72, 200', ''])('"%s" koordinat değildir', (input) => {
    expect(parseCoordinates(input)).toBeNull()
  })
})

describe('formatDecare', () => {
  it('m² değerini dekara çevirir', () => {
    expect(formatDecare(12500)).toBe('13 da')
    expect(formatDecare(4200)).toBe('4,2 da')
    expect(formatDecare(null)).toBe('—')
  })
})

describe('silhouettePath', () => {
  it('kareyi viewBox içinde kapalı yola çevirir', () => {
    const path = silhouettePath([[0, 0], [1, 0], [1, 1], [0, 1]], 40, 4)
    expect(path.startsWith('M')).toBe(true)
    expect(path.endsWith('Z')).toBe(true)
    const nums = path.match(/-?\d+(\.\d+)?/g)!.map(Number)
    expect(Math.min(...nums)).toBeGreaterThanOrEqual(4)
    expect(Math.max(...nums)).toBeLessThanOrEqual(36)
  })

  it('geçersiz halka için boş döner', () => {
    expect(silhouettePath([[0, 0], [1, 1]])).toBe('')
  })
})

describe('viewStorage', () => {
  beforeEach(() => {
    // Test ortamı node: tarayıcı localStorage'ının basit bir karşılığı
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('kayıt yoksa Mersin varsayılanı', () => {
    expect(loadView('u1')).toEqual(DEFAULT_VIEW)
  })

  it('kullanıcı bazında kaydeder ve geri okur', () => {
    saveView('u1', { center: [35, 37], zoom: 11, basemap: 'hybrid' })
    expect(loadView('u1')).toEqual({ center: [35, 37], zoom: 11, basemap: 'hybrid' })
    expect(loadView('u2')).toEqual(DEFAULT_VIEW)
  })

  it('bozuk kaydı yok sayar', () => {
    localStorage.setItem('bahcelab_map_view_v1:u1', '{"center":"x"}')
    expect(loadView('u1')).toEqual(DEFAULT_VIEW)
  })
})
