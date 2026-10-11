import { describe, expect, it } from 'vitest'
import { LAYOUT } from '@/features/bahcem/lib/config'
import { mapInsets, panelWidthPx } from '@/features/bahcem/lib/layout'

describe('panel yerleşimi', () => {
  it('liste paneli sabit genişlikte', () => {
    expect(panelWidthPx(1440, 'list')).toBe(LAYOUT.listPanelPx)
  })

  it('bahçe sayfası görünümün ~%62\'si, sınırlar içinde', () => {
    expect(panelWidthPx(1440, 'detail')).toBe(Math.round(1440 * LAYOUT.detailPanelRatio))
    expect(panelWidthPx(1000, 'detail')).toBe(620)
    expect(panelWidthPx(2560, 'detail')).toBeLessThanOrEqual(LAYOUT.detailPanelMaxPx)
  })

  it('geniş panel haritaya en az mapMinPx bırakır', () => {
    const viewport = 800
    const panel = panelWidthPx(viewport, 'detail')
    expect(viewport - LAYOUT.railPx - panel - LAYOUT.gapPx * 2).toBeGreaterThanOrEqual(LAYOUT.mapMinPx)
  })

  it('kapalı panel 0 px', () => {
    expect(panelWidthPx(1440, 'collapsed')).toBe(0)
  })

  it('dar ekranda panel menü dışındaki alanı kaplar, liste üst sınırı korunur', () => {
    const viewport = 375
    const free = viewport - LAYOUT.railPx - LAYOUT.gapPx * 2
    expect(panelWidthPx(viewport, 'detail')).toBe(free)
    expect(panelWidthPx(viewport, 'list')).toBe(free)
  })

  it('harita sınırları: panel açıkken sol, Copilot açıkken sağ genişler', () => {
    const closed = mapInsets(1440, 0, false)
    expect(closed).toEqual({ left: LAYOUT.railPx + LAYOUT.gapPx, right: LAYOUT.gapPx })
    const open = mapInsets(1440, 360, true)
    expect(open.left).toBe(LAYOUT.railPx + LAYOUT.gapPx + 360 + LAYOUT.gapPx)
    expect(open.right).toBe(LAYOUT.gapPx + LAYOUT.copilotPx)
  })

  it('dar ekranda panel haritayı daraltmaz (üstüne biner), Copilot da sayılmaz', () => {
    expect(mapInsets(375, 300, true)).toEqual({ left: LAYOUT.railPx + LAYOUT.gapPx, right: LAYOUT.gapPx })
  })
})
