import { useCallback } from 'react'
import type { Garden } from '../api/types'
import { geometryBounds, unionBounds } from '../lib/geo'
import { usePanelLayout } from '../hooks/usePanelLayout'
import { FOCUS_PAD, MAP } from '../lib/config'
import { useMap } from './useMap'

/** Sol panel (ve açıksa Copilot) haritayı kapladığı için odaklarken görünen alanı (yerleşim sınırları) korur. */
export function useFocusPadding() {
  const { insets } = usePanelLayout()
  return useCallback(
    () => ({ top: FOCUS_PAD.top, bottom: FOCUS_PAD.bottom, left: insets.left + FOCUS_PAD.side, right: insets.right + FOCUS_PAD.side }),
    [insets.left, insets.right],
  )
}

export function useFocusGarden() {
  const { map } = useMap()
  const padding = useFocusPadding()

  const focusGarden = useCallback(
    (garden: Garden, options: { animate?: boolean } = {}) => {
      if (!map) return
      map.fitBounds(geometryBounds(garden.geometry), {
        padding: padding(),
        maxZoom: MAP.focusMaxZoom,
        duration: options.animate === false ? 0 : 1200,
      })
    },
    [map, padding],
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
