import { useCallback } from 'react'
import type { Garden } from '../api/types'
import { geometryBounds, unionBounds } from '../lib/geo'
import { FOCUS_PAD, MAP } from '../lib/config'
import { useMap } from './useMap'

/** Harita artık panellerle örtülmez (çalışma alanı bölünmüş): odak payı sabittir. */
export function useFocusPadding(selected = false) {
  return useCallback(
    () => ({ top: FOCUS_PAD.top, bottom: selected ? FOCUS_PAD.bottomSelected : FOCUS_PAD.bottom, left: FOCUS_PAD.side, right: FOCUS_PAD.side }),
    [selected],
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
