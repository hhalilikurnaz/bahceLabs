import { useEffect, useRef } from 'react'
import { useMap } from '../../../map/useMap'
import type { LngLat } from '../../../lib/geometri'

/**
 * Parsel DIŞINI bulanıklaştırır (backdrop-filter) ve %50 karartır. Parsel çokgeni `clip-path: path(evenodd)` ile oyulur; harita hareketinde yol
 * rAF ile güncellenir (DOM, React değil). Hareket sırasında bulanıklık kapanır (html[data-harita-hareket], tokens.css) — cam kuralı.
 */
export function DisariBulaniklik({ parsel }: { parsel: LngLat[] | null }) {
  const { map } = useMap()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!map || !parsel || !ref.current) return
    const el = ref.current
    let raf = 0
    const yaz = () => {
      raf = 0
      const w = el.clientWidth
      const h = el.clientHeight
      const p = parsel.map((c) => map.project(c))
      el.style.clipPath = `path(evenodd, "M0 0H${w}V${h}H0Z M${p.map((q, i) => `${i === 0 ? '' : 'L'}${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(' ')}Z")`
    }
    const iste = () => { if (!raf) raf = requestAnimationFrame(yaz) }
    yaz()
    map.on('move', iste)
    map.on('resize', iste)
    map.on('load', iste)
    return () => { map.off('move', iste); map.off('resize', iste); map.off('load', iste); if (raf) cancelAnimationFrame(raf) }
  }, [map, parsel])
  return <div ref={ref} aria-hidden className="sl-disari pointer-events-none absolute inset-0 z-[4]" data-testid="parsel-disi-blur" />
}
