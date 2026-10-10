import { useCallback } from 'react'
import type { Garden } from '../api/types'
import { geometryBounds, unionBounds } from '../lib/geo'
import { useBahcemStore } from '../stores/bahcemStore'
import { useMap } from './useMap'

/** Sol panel (ve açıksa Copilot) haritayı kapladığı için odaklarken o payı bırakır. */
export function useFocusPadding() {
  return useCallback(() => {
    const { leftPanelOpen, copilotOpen } = useBahcemStore.getState()
    const wide = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
    return {
      top: 90,
      bottom: 70,
      left: wide && leftPanelOpen ? 460 : 90,
      right: wide && copilotOpen ? 410 : 80,
    }
  }, [])
}

export function useFocusGarden() {
  const { map } = useMap()
  const padding = useFocusPadding()

  const focusGarden = useCallback(
    (garden: Garden, options: { animate?: boolean } = {}) => {
      if (!map) return
      map.fitBounds(geometryBounds(garden.geometry), {
        padding: padding(),
        maxZoom: 18,
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
        maxZoom: 17,
        duration: options.animate === false ? 0 : 1200,
      })
    },
    [map, padding],
  )

  return { focusGarden, focusAll }
}
