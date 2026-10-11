import { useEffect, useState } from 'react'
import { mapInsets, panelWidthPx, type MapInsets, type PanelKind } from '../lib/layout'
import { useBahcemStore } from '../stores/bahcemStore'
import { useBahcemRoute } from './useBahcemRoute'

export interface PanelLayout {
  kind: PanelKind
  panelPx: number
  insets: MapInsets
  viewportPx: number
}

const viewport = (): number => (typeof window === 'undefined' ? 1280 : window.innerWidth)

/**
 * Panelin türü (liste / bahçe sayfası / kapalı) ve haritaya bırakılan alan.
 * Bahçe seçiliyken panel geniş açılır; "Tam harita" veya menüden kapatma paneli daraltır.
 */
export function usePanelLayout(): PanelLayout {
  const { section, gardenId } = useBahcemRoute()
  const open = useBahcemStore((s) => s.leftPanelOpen)
  const fullMap = useBahcemStore((s) => s.fullMap)
  const mode = useBahcemStore((s) => s.mode)
  const copilotOpen = useBahcemStore((s) => s.copilotOpen)
  const [viewportPx, setViewportPx] = useState(viewport)

  useEffect(() => {
    const onResize = () => setViewportPx(viewport())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  let kind: PanelKind = 'list'
  if (!open || fullMap) kind = 'collapsed'
  else if (section === 'bahceler' && gardenId && mode === 'idle') kind = 'detail'

  const panelPx = panelWidthPx(viewportPx, kind)
  return { kind, panelPx, insets: mapInsets(viewportPx, panelPx, copilotOpen), viewportPx }
}
