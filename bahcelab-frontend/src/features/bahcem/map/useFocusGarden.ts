import { useCallback } from 'react'
import type { Garden } from '../api/types'
import { geometryBounds, unionBounds } from '../lib/geo'
import { usePanelLayout } from '../hooks/usePanelLayout'
import { FOCUS_PAD, MAP } from '../lib/config'
import { useMap } from './useMap'

/** Sol panel (ve açıksa Copilot) haritayı kapladığı için odaklarken görünen alanı (yerleşim sınırları) korur. */
export function useFocusPadding(selected = false) {
  const { insets, desktop, sheetPx } = usePanelLayout()
  return useCallback(
    () => ({
      top: FOCUS_PAD.top,
      bottom: desktop ? (selected ? FOCUS_PAD.bottomSelected : FOCUS_PAD.bottom) : Math.max(FOCUS_PAD.bottom, sheetPx + FOCUS_PAD.side),
      left: insets.left + FOCUS_PAD.side,
      right: insets.right + FOCUS_PAD.side,
    }),
    [insets.left, insets.right, selected, desktop, sheetPx],
  )
}

export function useFocusGarden() {
  const { map } = useMap()
  const padding = useFocusPadding()
  const selectedPadding = useFocusPadding(true)

  const focusGarden = useCallback(
    (garden: Garden, options: { animate?: boolean } = {}) => {
      if (!map) return
      map.fitBounds(geometryBounds(garden.geometry), {
        padding: selectedPadding(),
        maxZoom: MAP.focusMaxZoom,
        duration: options.animate === false ? 0 : 1200,
      })
    },
    [map, selectedPadding],
  )

  const focusAll = useCallback(
    (gardens: Garden[], options: { animate?: boolean } = {}) => {
      const bounds = unionBounds(gardens.map((g) => geometryBounds(g.geometry)))
      if (!map || !bounds) return
      map.fitBounds(bounds, {
        padding: padding(),
        maxZoom: MAP.focusMaxZoom - 1,
        duration: options.animate === false ? 0 : 1200,
      })
    },
    [map, padding],
  )

  return { focusGarden, focusAll }
}
