import { describe, expect, it } from 'vitest'
import { LAYOUT } from '@/features/bahcem/lib/config'
import { detailBounds, detailWidthPx, listWidthPx, mapInsets } from '@/features/bahcem/lib/layout'

describe('üç bölgeli yerleşim', () => {
  it('liste paneli sabit genişlikte, kapalıyken 0', () => {
    expect(listWidthPx(1440, true)).toBe(LAYOUT.listPanelPx)
    expect(listWidthPx(1440, false)).toBe(0)
  })

  it('sağ panel varsayılanı görünüm oranıdır ve sınırlar içinde kalır', () => {
    expect(detailWidthPx(1440, LAYOUT.listPanelPx, true, null)).toBe(Math.round(1440 * LAYOUT.detailPanelRatio))
    expect(detailWidthPx(2560, LAYOUT.listPanelPx, true, null)).toBeLessThanOrEqual(LAYOUT.detailPanelMaxPx)
  })

  it('kullanıcının seçtiği genişlik aralığa sıkıştırılır', () => {
    const { min, max } = detailBounds(1440, LAYOUT.listPanelPx)
    expect(detailWidthPx(1440, LAYOUT.listPanelPx, true, 10)).toBe(min)
    expect(detailWidthPx(1440, LAYOUT.listPanelPx, true, 5000)).toBe(max)
    expect(detailWidthPx(1440, LAYOUT.listPanelPx, true, 600)).toBe(600)
  })

  it('sağ panel haritaya en az mapMinPx bırakır', () => {
    const viewport = 1280
    const list = listWidthPx(viewport, true)
    const detail = detailWidthPx(viewport, list, true, 5000)
    const map = viewport - LAYOUT.railPx - list - detail - LAYOUT.gapPx * 3
    expect(map).toBeGreaterThanOrEqual(LAYOUT.mapMinPx)
  })

  it('kapalı sağ panel 0 px', () => {
    expect(detailWidthPx(1440, LAYOUT.listPanelPx, false, 600)).toBe(0)
  })

  it('dar ekranda paneller menü dışındaki alanı kaplar', () => {
    const free = 375 - LAYOUT.railPx - LAYOUT.gapPx * 2
    expect(listWidthPx(375, true)).toBe(free)
    expect(detailWidthPx(375, free, true, 600)).toBe(free)
  })

  it('harita sınırları: sol liste, sağ panel ve Copilot hesaba katılır', () => {
    expect(mapInsets(1440, 0, 0, false)).toEqual({ left: LAYOUT.railPx + LAYOUT.gapPx, right: LAYOUT.gapPx })
    const both = mapInsets(1440, 360, 560, false)
    expect(both.left).toBe(LAYOUT.railPx + LAYOUT.gapPx + 360 + LAYOUT.gapPx)
    expect(both.right).toBe(LAYOUT.gapPx + 560 + LAYOUT.gapPx)
    // Copilot sağ panelden dar olduğu için panelin üstüne biner; harita alanı değişmez
    expect(mapInsets(1440, 360, 560, true).right).toBe(both.right)
    // Panel yokken Copilot kendi genişliği kadar yer ayırır
    expect(mapInsets(1440, 360, 0, true).right).toBe(LAYOUT.gapPx + LAYOUT.copilotPx)
  })

  it('dar ekranda paneller haritayı daraltmaz (üstüne biner)', () => {
    expect(mapInsets(375, 300, 300, true)).toEqual({ left: LAYOUT.railPx + LAYOUT.gapPx, right: LAYOUT.gapPx })
  })
})
