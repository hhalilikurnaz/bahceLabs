import { describe, expect, it } from 'vitest'
import {
  canvasScale,
  colorizeGrid,
  compositeSplit,
  diffGrid,
  diffRange,
  lonLatToPixel,
  parseGrid,
  percentileRange,
  pixelToLonLat,
  resampleTo,
  ringsToPixels,
  splitPredicate,
  type Corners,
  type Grid,
} from '@/features/bahcem/lib/render'

// 4 satır × 5 sütun; sol-üst (34.0, 36.0), doğuya 0,005°, güneye 0,004°
const CORNERS: Corners = [
  [34.0, 36.0],
  [34.005, 36.0],
  [34.005, 35.996],
  [34.0, 35.996],
]

const grid = (values: number[], rows = 4, cols = 5, corners: Corners = CORNERS): Grid => ({
  values: Float32Array.from(values),
  rows,
  cols,
  corners,
})

describe('parseGrid', () => {
  it('float32 little-endian ham veriyi okur', () => {
    const buffer = new ArrayBuffer(8)
    const view = new DataView(buffer)
    view.setFloat32(0, 0.5, true)
    view.setFloat32(4, NaN, true)
    const parsed = parseGrid(buffer, 1, 2, CORNERS)
    expect(parsed.values[0]).toBeCloseTo(0.5)
    expect(Number.isNaN(parsed.values[1])).toBe(true)
  })

  it('boyut uyuşmazsa hata verir', () => {
    expect(() => parseGrid(new ArrayBuffer(12), 2, 2, CORNERS)).toThrow(/uyuşmuyor/)
  })
})

describe('yüzdelik ve renklendirme', () => {
  it('p2–p98 aralığı sonlu değerlerden hesaplanır, NaN yok sayılır', () => {
    const values = Float32Array.from([NaN, ...Array.from({ length: 101 }, (_, i) => i / 100)])
    const [lo, hi] = percentileRange(values, 2, 98) as [number, number]
    expect(lo).toBeCloseTo(0.02, 2)
    expect(hi).toBeCloseTo(0.98, 2)
    expect(percentileRange(Float32Array.from([NaN, NaN]), 2, 98)).toBeNull()
  })

  it('NaN piksel tamamen saydam, değerler skalanın uçlarına kırpılır', () => {
    const rgba = colorizeGrid(Float32Array.from([NaN, 0, 0.9, 5]), { vmin: 0, vmax: 0.9, colormap: 'rdylgn' })
    expect(rgba[3]).toBe(0) // NaN
    expect([rgba[4], rgba[5], rgba[6], rgba[7]]).toEqual([215, 48, 39, 255]) // 0 → kırmızı
    expect([rgba[8], rgba[9], rgba[10]]).toEqual([26, 152, 80]) // 0,9 → yeşil
    expect([rgba[12], rgba[13], rgba[14]]).toEqual([26, 152, 80]) // tavana kırpılır
  })

  it('kontrastlı aralık aynı değere farklı renk verir (bahçe içi farklar belirginleşir)', () => {
    const value = Float32Array.from([0.46])
    const absolute = colorizeGrid(value, { vmin: 0, vmax: 0.9, colormap: 'rdylgn' })
    const stretched = colorizeGrid(value, { vmin: 0.4, vmax: 0.5, colormap: 'rdylgn' })
    expect(Array.from(stretched.slice(0, 3))).not.toEqual(Array.from(absolute.slice(0, 3)))
    expect(stretched[1]).toBeGreaterThan(absolute[1]) // 0,46 gerilmiş skalada daha yeşil
  })

  it('NDMI skalası mavi tonlarında: kuru açık, nemli koyu mavi', () => {
    const [dry, wet] = [-0.2, 0.6].map((v) => colorizeGrid(Float32Array.from([v]), { vmin: -0.2, vmax: 0.6, colormap: 'mavi' }))
    expect(dry[0]).toBeGreaterThan(240) // açık
    expect(wet[2]).toBeGreaterThan(wet[0]) // mavi baskın
    expect(wet[0]).toBeLessThan(40)
  })
})

describe('değişim (fark)', () => {
  it('a − b, geçersizler NaN', () => {
    const diff = diffGrid(Float32Array.from([0.5, 0.6, NaN, 0.3]), Float32Array.from([0.6, 0.5, 0.4, NaN]))
    expect(diff[0]).toBeCloseTo(-0.1)
    expect(diff[1]).toBeCloseTo(0.1)
    expect(Number.isNaN(diff[2]) && Number.isNaN(diff[3])).toBe(true)
  })

  it('boyutlar farklıysa hata verir', () => {
    expect(() => diffGrid(new Float32Array(2), new Float32Array(3))).toThrow()
  })

  it('düşüş kırmızı, artış yeşil, değişmeyen açık gri/beyaz', () => {
    const rgba = colorizeGrid(Float32Array.from([-0.25, 0, 0.25]), diffRange(0.25))
    const [down, same, up] = [0, 4, 8].map((i) => Array.from(rgba.slice(i, i + 3)))
    expect(down[0]).toBeGreaterThan(200)
    expect(down[1]).toBeLessThan(80)
    expect(same.every((c) => c > 235)).toBe(true)
    expect(up[1]).toBeGreaterThan(up[0])
  })
})

describe('coğrafi eşleme ve yeniden örnekleme', () => {
  it('boylam/enlem ↔ piksel dönüşümü tutarlı', () => {
    const [x, y] = lonLatToPixel(CORNERS, 4, 5, 34.0025, 35.998)
    expect(x).toBeCloseTo(2.5)
    expect(y).toBeCloseTo(2)
    const [lng, lat] = pixelToLonLat(CORNERS, 4, 5, x, y)
    expect(lng).toBeCloseTo(34.0025, 9)
    expect(lat).toBeCloseTo(35.998, 9)
  })

  it('aynı ızgara kopyalanmadan döner', () => {
    const g = grid(Array.from({ length: 20 }, (_, i) => i))
    expect(resampleTo(g, g)).toBe(g.values)
  })

  it('kaymış ızgaradan doğru pikseller örneklenir, kapsam dışı NaN olur', () => {
    const values = Array.from({ length: 20 }, (_, i) => i) // satır-major: değer = satır*5 + sütun
    const source = grid(values)
    // Hedef: kaynağın 1 sütun doğusundan başlayan, 3 sütunluk pencere (2 sütun içeride, 1 dışarıda değil)
    const shifted: Corners = [
      [34.001, 36.0],
      [34.004, 36.0],
      [34.004, 35.996],
      [34.001, 35.996],
    ]
    const out = resampleTo(source, { rows: 4, cols: 3, corners: shifted })
    expect(Array.from(out.slice(0, 3))).toEqual([1, 2, 3]) // ilk satır: sütun 1..3
    expect(Array.from(out.slice(9, 12))).toEqual([16, 17, 18])

    const far: Corners = [
      [34.01, 36.0],
      [34.015, 36.0],
      [34.015, 35.996],
      [34.01, 35.996],
    ]
    expect(resampleTo(source, { rows: 4, cols: 5, corners: far }).every(Number.isNaN)).toBe(true)
  })

  it('poligon halkaları görüntü pikseline çevrilir', () => {
    const [ring] = ringsToPixels([[[34.0, 36.0], [34.005, 36.0], [34.005, 35.996]]], CORNERS, 4, 5)
    expect(ring.map(([x, y]) => [Math.round(x) + 0, Math.round(y) + 0])).toEqual([[0, 0], [5, 0], [5, 4]])
  })

  it('tuval ölçeği küçük bahçede büyük, büyükte sınırlı', () => {
    expect(canvasScale(20, 20)).toBe(32)
    expect(canvasScale(200, 100)).toBe(5)
    expect(canvasScale(1000, 1000)).toBe(4)
  })
})

describe('karşılaştırma (swipe) birleştirme', () => {
  it('ayırıcının sağındaki pikseller B, solundakiler A kaynağından gelir', () => {
    const a = new Uint8ClampedArray(4 * 4).fill(10)
    const b = new Uint8ClampedArray(4 * 4).fill(200)
    const out = compositeSplit(a, b, 4, 1, (x) => x > 2)
    expect(Array.from(out)).toEqual([...Array(8).fill(10), ...Array(8).fill(200)])
  })

  it('ekran ayırıcısı piksel konumuna çevrilir (haritayı kaydırınca da tutarlı)', () => {
    // Basit projeksiyon: ekran x = (boylam − 34) × 100000
    const screenX = (lng: number) => (lng - 34) * 100000
    const rightOf = splitPredicate(CORNERS, 4, 5, screenX, 250) // 250 px → 2,5 sütun
    expect(rightOf(2.2, 1)).toBe(false)
    expect(rightOf(2.8, 1)).toBe(true)
    const panned = splitPredicate(CORNERS, 4, 5, (lng) => screenX(lng) + 100, 250) // harita 100 px sağa kaydı
    expect(panned(1.2, 1)).toBe(false)
    expect(panned(1.8, 1)).toBe(true) // ayırıcı artık 1,5. sütunda
  })
})
