import { useEffect, useState } from 'react'
import { detailBounds, detailWidthPx, listWidthPx, mapInsets, sheetHeightPx, type DetailBounds, type MapInsets } from '../lib/layout'
import { LAYOUT } from '../lib/config'
import { useBahcemStore } from '../stores/bahcemStore'
import { useBahcemRoute } from './useBahcemRoute'

export interface PanelLayout {
  /** Sol liste (ya da bölüm/form) paneli açık mı */
  listOpen: boolean
  /** Sağ bahçe paneli açık mı */
  detailOpen: boolean
  listPx: number
  detailPx: number
  detailBounds: DetailBounds
  insets: MapInsets
  viewportPx: number
  desktop: boolean
  /** Mobilde açık alt sayfanın yüksekliği, px (yoksa 0) */
  sheetPx: number
}

const viewport = (): number => (typeof window === 'undefined' ? 1280 : window.innerWidth)

/**
 * Üç bölgeli yerleşim: sol liste | orta harita | sağ bahçe paneli.
 * Bahçe seçiliyken ikisi de görünür; "Tam harita" ikisini de kapatır. Dar ekranda bahçe paneli listenin yerine geçer.
 */
export function usePanelLayout(): PanelLayout {
  const { section, gardenId, archive } = useBahcemRoute()
  const leftOpen = useBahcemStore((s) => s.leftPanelOpen)
  const fullMap = useBahcemStore((s) => s.fullMap)
  const mode = useBahcemStore((s) => s.mode)
  const copilotOpen = useBahcemStore((s) => s.copilotOpen)
  const preferred = useBahcemStore((s) => s.detailWidthPx)
  const sheet = useBahcemStore((s) => s.sheet)
  const [viewportPx, setViewportPx] = useState(viewport)

  useEffect(() => {
    const onResize = () => setViewportPx(viewport())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const desktop = viewportPx >= LAYOUT.desktopMinPx
  const formOpen = section === 'bahceler' && (mode === 'drawing' || mode === 'form') && !archive
  const detailOpen = formOpen || (section === 'bahceler' && gardenId !== null && mode === 'idle' && !fullMap && !archive)
  const listOpen = leftOpen && !fullMap && !archive && (desktop || !detailOpen)

  const listPx = listWidthPx(viewportPx, listOpen)
  const detailPx = detailWidthPx(viewportPx, listPx, detailOpen, preferred)
  return {
    listOpen,
    detailOpen,
    listPx,
    detailPx,
    detailBounds: detailBounds(viewportPx, listPx),
    insets: mapInsets(viewportPx, listPx, detailPx, copilotOpen),
    viewportPx,
    desktop,
    sheetPx: !desktop && detailOpen ? sheetHeightPx(sheet, typeof window === 'undefined' ? 800 : window.innerHeight) : 0,
  }
}
