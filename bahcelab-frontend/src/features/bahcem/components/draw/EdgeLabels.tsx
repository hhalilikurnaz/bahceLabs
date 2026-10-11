import { useEffect, useState } from 'react'
import { formatLength, ringSegments, type LngLat } from '../../lib/measure'
import { useMap } from '../../map/useMap'

/** Çizilen/düzenlenen sınırın her kenarının uzunluğunu (m) kenar ortasında gösterir; harita hareketinde yeniden konumlanır. */
export function EdgeLabels({ ring }: { ring: readonly LngLat[] | null }) {
  const { map } = useMap()
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!map) return
    let frame = 0
    const refresh = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setTick((t) => t + 1))
    }
    map.on('move', refresh)
    return () => {
      cancelAnimationFrame(frame)
      map.off('move', refresh)
    }
  }, [map])

  if (!map || !ring || ring.length < 3) return null
  const segments = ringSegments(ring, true)
  return (
    <div className="surface-dark pointer-events-none absolute inset-0 z-[15] overflow-hidden" aria-hidden data-testid="edge-labels">
      {segments.map((segment, i) => {
        const p = map.project(segment.mid as [number, number])
        return (
          <span
            key={i}
            data-testid="edge-label"
            className="tabular absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-app-panel/90 px-2 py-0.5 text-caption font-semibold text-app-text shadow-e1"
            style={{ left: p.x, top: p.y }}
          >
            {formatLength(segment.lengthM)}
          </span>
        )
      })}
    </div>
  )
}
