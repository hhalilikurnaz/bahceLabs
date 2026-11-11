import { describe, expect, it } from 'vitest'
import { alanM2, duzlem, katla180, noktaIcinde, parcaliBol, siraUret, uzunEksenYonu, yonDerece, type LngLat, type Xy } from '@/features/bahcem/lib/geometri'

const dik = (w: number, h: number): Xy[] => [[0, 0], [w, 0], [w, h], [0, h]]

describe('düzlem', () => {
  it('gidiş-dönüş kayıpsız ve ölçek metre', () => {
    const d = duzlem([27.7, 37.1])
    const p: LngLat = [27.7009, 37.1004]
    const xy = d.ileri(p)
    expect(Math.hypot(...xy)).toBeGreaterThan(80)
    expect(Math.hypot(...xy)).toBeLessThan(120)
    const g = d.geri(xy)
    expect(g[0]).toBeCloseTo(p[0], 9)
    expect(g[1]).toBeCloseTo(p[1], 9)
  })
})
describe('uzun eksen', () => {
  it('doğu-batı uzun dikdörtgen → 90°', () => expect(Math.round(uzunEksenYonu(dik(200, 50)))).toBe(90))
  it('kuzey-güney uzun dikdörtgen → 0°', () => expect(Math.round(uzunEksenYonu(dik(40, 160)))).toBe(0))
  it('döndürülmüş dikdörtgen (30°) bulunur', () => {
    const a = (30 * Math.PI) / 180
    const r = dik(200, 50).map(([x, y]): Xy => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)])
    expect(Math.abs(uzunEksenYonu(r) - 60)).toBeLessThan(1) // x ekseni 30° yukarı → kuzeyden 60° saat yönü
  })
  it('yönler 180°e katlanır', () => { expect(katla180(-10)).toBe(170); expect(yonDerece(1, 0)).toBe(90) })
})
describe('sıra üretimi', () => {
  it('100×60 m, 6 m × 4 m → doğru ağaç sayısı ve hepsi içeride', () => {
    const xy = dik(100, 60)
    const r = siraUret(xy, 90, 6, 4) // sıralar doğu-batı
    expect(r.siralar.length).toBe(10)
    expect(r.agaclar.length).toBe(250) // 10 sıra × 25 ağaç
    expect(r.agaclar.every((p) => noktaIcinde(p, xy))).toBe(true)
    expect(r.kesildi).toBe(false)
  })
  it('ağaç sayısı alan/(sıra×ağaç) ile uyumlu (±%5)', () => {
    const xy = dik(173, 91)
    const r = siraUret(xy, 25, 5, 3)
    expect(Math.abs(r.agaclar.length - alanM2(xy) / 15) / (alanM2(xy) / 15)).toBeLessThan(0.05)
  })
  it('üst sınırda keser', () => expect(siraUret(dik(1000, 1000), 0, 2, 2, 500).kesildi).toBe(true))
})
describe('bölme', () => {
  it('bir doğru iki parça; alanlar toplamı korunur', () => {
    const xy = dik(100, 60)
    const [a, b] = parcaliBol(xy, [[[40, -10], [40, 70]]])
    expect(alanM2(a!) + alanM2(b!)).toBeCloseTo(6000, 6)
    expect(Math.min(alanM2(a!), alanM2(b!))).toBeCloseTo(2400, 6)
  })
  it('iki doğru üç parça', () => {
    const p = parcaliBol(dik(90, 30), [[[30, -5], [30, 40]], [[60, -5], [60, 40]]])
    expect(p.length).toBe(3)
    expect(p.reduce((s, q) => s + alanM2(q), 0)).toBeCloseTo(2700, 6)
  })
  it('parseli kesmeyen doğru parçayı bölmez', () => expect(parcaliBol(dik(50, 50), [[[200, -5], [200, 80]]]).length).toBe(1))
})
