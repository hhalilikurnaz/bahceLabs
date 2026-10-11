import { LAYOUT, SHEET } from './config'

const isDesktop = (viewportPx: number): boolean => viewportPx >= LAYOUT.desktopMinPx

/** Menü şeridi dışında kalan genişlik (dar ekranda paneller bunu kaplar) */
const freePx = (viewportPx: number): number => viewportPx - LAYOUT.railPx - LAYOUT.gapPx * 2

/** Sol liste panelinin genişliği; kapalıysa 0. Dar ekranda menü dışındaki alanı kaplar. */
export function listWidthPx(viewportPx: number, open: boolean): number {
  if (!open) return 0
  return isDesktop(viewportPx) ? LAYOUT.listPanelPx : Math.max(0, freePx(viewportPx))
}

export interface DetailBounds {
  min: number
  max: number
}

/** Sağ bahçe panelinin izin verilen genişlik aralığı (haritaya en az `mapMinPx` kalır). */
export function detailBounds(viewportPx: number, listPx: number): DetailBounds {
  const room = viewportPx - LAYOUT.railPx - LAYOUT.gapPx * 3 - listPx - LAYOUT.mapMinPx
  const max = Math.max(LAYOUT.detailPanelFloorPx, Math.min(LAYOUT.detailPanelMaxPx, room))
  return { min: Math.min(LAYOUT.detailPanelMinPx, max), max }
}

/**
 * Sağ bahçe panelinin piksel genişliği. `preferredPx`: kullanıcının sürükleyerek seçtiği genişlik (yoksa görünüm oranı).
 * Dar ekranda panel ekranı kaplar; kapalıysa 0.
 */
export function detailWidthPx(viewportPx: number, listPx: number, open: boolean, preferredPx: number | null): number {
  if (!open) return 0
  if (!isDesktop(viewportPx)) return Math.max(0, freePx(viewportPx))
  const { min, max } = detailBounds(viewportPx, listPx)
  const wanted = preferredPx ?? Math.round(viewportPx * LAYOUT.detailPanelRatio)
  return Math.min(Math.max(wanted, min), max)
}

export interface MapInsets {
  /** Haritanın görünen alanının sol sınırı (menü + liste + boşluk), px */
  left: number
  /** Sağ sınır (bahçe paneli ya da Copilot çekmecesi, hangisi genişse), px */
  right: number
}

/** Harita üstü öğelerin (arama, lejant, denetimler, odaklama dolgusu) kullanacağı sınırlar. */
export function mapInsets(viewportPx: number, listPx: number, detailPx: number, copilotOpen: boolean): MapInsets {
  const gap = LAYOUT.gapPx
  if (!isDesktop(viewportPx)) return { left: LAYOUT.railPx + gap, right: gap }
  const left = LAYOUT.railPx + gap + (listPx > 0 ? listPx + gap : 0)
  const rightPanel = detailPx > 0 ? detailPx + gap : 0
  return { left, right: gap + Math.max(rightPanel, copilotOpen ? LAYOUT.copilotPx : 0) }
}

export type SheetState = 'peek' | 'half' | 'full'
export const SHEET_ORDER: readonly SheetState[] = ['peek', 'half', 'full']

/** Alt sayfanın piksel yüksekliği (görünüm yüksekliğine göre). */
export function sheetHeightPx(state: SheetState, viewportH: number): number {
  if (state === 'peek') return SHEET.peekPx
  if (state === 'half') return Math.round(viewportH * SHEET.halfRatio)
  return Math.max(SHEET.peekPx, viewportH - SHEET.fullTopGapPx)
}

/** Sürükleme sonunda en yakın yükseklik durumu. */
export function nearestSheetState(heightPx: number, viewportH: number): SheetState {
  return SHEET_ORDER.reduce((best, state) =>
    Math.abs(sheetHeightPx(state, viewportH) - heightPx) < Math.abs(sheetHeightPx(best, viewportH) - heightPx) ? state : best,
  )
}

/** Klavye/tıklama ile bir üst (+1) ya da alt (−1) duruma geçiş; uçlarda yerinde kalır. */
export function stepSheet(state: SheetState, direction: 1 | -1): SheetState {
  const index = SHEET_ORDER.indexOf(state) + direction
  return SHEET_ORDER[Math.min(SHEET_ORDER.length - 1, Math.max(0, index))]
}
