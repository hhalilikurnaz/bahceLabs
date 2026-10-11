import { LAYOUT } from './config'

export type PanelKind = 'list' | 'detail' | 'collapsed'

const isDesktop = (viewportPx: number): boolean => viewportPx >= LAYOUT.desktopMinPx

/** Sol panelin piksel genişliği. Dar ekranda panel (menü hariç) ekranı neredeyse kaplar. */
export function panelWidthPx(viewportPx: number, kind: PanelKind): number {
  if (kind === 'collapsed') return 0
  const free = viewportPx - LAYOUT.railPx - LAYOUT.gapPx * 2
  if (!isDesktop(viewportPx)) return Math.max(0, Math.min(free, kind === 'list' ? LAYOUT.listPanelPx : free))
  if (kind === 'list') return LAYOUT.listPanelPx
  const wanted = Math.round(viewportPx * LAYOUT.detailPanelRatio)
  const clamped = Math.min(Math.max(wanted, LAYOUT.detailPanelMinPx), LAYOUT.detailPanelMaxPx)
  return Math.min(clamped, free - LAYOUT.mapMinPx)
}

export interface MapInsets {
  /** Haritanın görünen alanının sol sınırı (menü + panel + boşluk), px */
  left: number
  /** Sağ sınır (Copilot açıksa çekmece genişliği kadar), px */
  right: number
}

/** Harita üstü öğelerin (arama, lejant, denetimler, odaklama dolgusu) kullanacağı sınırlar. */
export function mapInsets(viewportPx: number, panelPx: number, copilotOpen: boolean): MapInsets {
  const desktop = isDesktop(viewportPx)
  const left = LAYOUT.railPx + LAYOUT.gapPx + (desktop && panelPx > 0 ? panelPx + LAYOUT.gapPx : 0)
  const right = LAYOUT.gapPx + (copilotOpen && desktop ? LAYOUT.copilotPx : 0)
  return { left, right }
}
