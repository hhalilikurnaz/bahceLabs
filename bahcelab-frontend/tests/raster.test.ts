import { describe, expect, it } from 'vitest'
import { RASTER } from '@/features/bahcem/lib/config'
import { COLORMAPS, INDEX_DEFS, safeColormap } from '@/features/bahcem/lib/indices'
import { DEFAULT_VIEW, legendHint, legendTitle, valueRange, type RenderInfo } from '@/features/bahcem/lib/raster'

const ndvi = INDEX_DEFS.ndvi

/** Değerleri 0..n-1 aralığında doğrusal dağıtılmış yapay ızgara (test verisi) */
const ramp = (from: number, to: number, n = 200): Float32Array =>
  Float32Array.from({ length: n }, (_, i) => from + ((to - from) * i) / (n - 1))

describe('değer aralığı', () => {
  it('genel skala parametrenin sabit aralığıdır', () => {
    expect(valueRange(ramp(0.4, 0.6), ndvi, 'genel')).toEqual({ vmin: ndvi.min, vmax: ndvi.max, homogeneous: false })
  })

  it('kendi farkları görüntünün p2–p98 aralığına gerilir', () => {
    const range = valueRange(ramp(0.3, 0.7), ndvi, 'kendi')
    expect(range.homogeneous).toBe(false)
    expect(range.vmin).toBeGreaterThan(0.3)
    expect(range.vmin).toBeLessThan(0.32)
    expect(range.vmax).toBeGreaterThan(0.68)
    expect(range.vmax).toBeLessThan(0.7)
  })

  it('yayılım eşiğin altındaysa bahçe homojen sayılır ve skala mutlak kalır', () => {
    const spread = RASTER.homogeneityRangeShare * (ndvi.max - ndvi.min) * 0.5
    const range = valueRange(ramp(0.5, 0.5 + spread), ndvi, 'kendi')
    expect(range).toEqual({ vmin: ndvi.min, vmax: ndvi.max, homogeneous: true })
  })

  it('yayılım eşiği aşınca homojen değildir', () => {
    const spread = RASTER.homogeneityRangeShare * (ndvi.max - ndvi.min) * 3
    expect(valueRange(ramp(0.5, 0.5 + spread), ndvi, 'kendi').homogeneous).toBe(false)
  })

  it('hiç geçerli piksel yoksa sabit aralığa düşer', () => {
    expect(valueRange(new Float32Array([NaN, NaN]), ndvi, 'kendi').homogeneous).toBe(false)
  })
})

describe('renk körlüğü skalası', () => {
  it('kırmızı–yeşil skalalar güvenli olanla değişir, mavi kalır', () => {
    expect(safeColormap('rdylgn', true)).toBe('viridis')
    expect(safeColormap('yesil', true)).toBe('viridis')
    expect(safeColormap('fark', true)).toBe('farkKb')
    expect(safeColormap('mavi', true)).toBe('mavi')
  })

  it('seçenek kapalıyken skala değişmez', () => {
    expect(safeColormap('rdylgn', DEFAULT_VIEW.renkKorlugu)).toBe('rdylgn')
  })

  it('güvenli skalaların duraklarında yeşil/kırmızı karışımı yok (viridis tek yönlü)', () => {
    const lum = COLORMAPS.viridis.map(([, [r, g, b]]) => 0.2126 * r + 0.7152 * g + 0.0722 * b)
    expect(lum).toEqual([...lum].sort((a, b) => a - b)) // parlaklık tek yönlü artar
  })
})

describe('lejant metni', () => {
  const base: RenderInfo = { kind: 'kendi', vmin: 0.3, vmax: 0.6, indeks: 'ndvi', colormap: 'rdylgn', homogeneous: false, tarih: '2026-05-01' }

  it('görünümü adlandırır', () => {
    expect(legendTitle(base)).toBe('Bahçenin kendi farkları')
    expect(legendTitle({ ...base, kind: 'genel' })).toBe('Genel skala')
  })

  it('homojen bahçede açık mesaj verir', () => {
    expect(legendHint({ ...base, homogeneous: true })).toContain('Bahçe homojen')
    expect(legendHint(base)).not.toContain('homojen')
  })
})
