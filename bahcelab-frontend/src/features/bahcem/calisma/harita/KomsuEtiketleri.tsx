import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Garden } from '../../api/types'
import { geometryBounds } from '../../lib/geo'
import { gardenPath } from '../../lib/routes'
import { useMap } from '../../map/useMap'

interface Konum {
  id: string
  ad: string
  x: number
  y: number
}

/** Komşu bahçelerin adları: raster altlıkta glif olmadığı için DOM'da; beyaz haleli, tıklayınca o bahçeye geçer. */
export function KomsuEtiketleri({ others }: { others: Garden[] }) {
  const { map } = useMap()
  const navigate = useNavigate()
  const [points, setPoints] = useState<Konum[]>([])
  const boxes = useMemo(() => others.map((g) => ({ id: g.id, ad: g.ad, bounds: geometryBounds(g.geometry) })), [others])

  useEffect(() => {
    if (!map) return
    let frame = 0
    const project = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const { clientWidth: width, clientHeight: height } = map.getContainer()
        // Etiket, komşu parselin görünen kısmının ortasına konur (parsel yarım görünüyorsa da adı okunur)
        const next: Konum[] = []
        for (const b of boxes) {
          const [[w, s], [e, n]] = b.bounds
          const a = map.project([w, n])
          const c = map.project([e, s])
          const left = Math.max(0, Math.min(a.x, c.x))
          const right = Math.min(width, Math.max(a.x, c.x))
          const top = Math.max(0, Math.min(a.y, c.y))
          const bottom = Math.min(height, Math.max(a.y, c.y))
          if (right - left < 24 || bottom - top < 16) continue
          next.push({ id: b.id, ad: b.ad, x: (left + right) / 2, y: (top + bottom) / 2 })
        }
        setPoints(next)
      })
    }
    project()
    map.on('move', project)
    map.on('resize', project)
    map.on('idle', project) // ilk yerleşim ve stil yüklemesi bitince
    return () => {
      cancelAnimationFrame(frame)
      map.off('move', project)
      map.off('resize', project)
      map.off('idle', project)
    }
  }, [map, boxes])

  return (
    <>
      {points.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => navigate(gardenPath(p.id))}
          aria-label={`${p.ad} bahçesini aç`}
          data-testid="komsu-etiketi"
          className="absolute z-[5] max-w-[160px] -translate-x-1/2 -translate-y-1/2 truncate rounded-[3px] bg-white/85 px-1.5 py-0.5 text-[11.5px] font-semibold text-[#17201b] shadow-sm ring-1 ring-black/15 hover:bg-white max-[560px]:min-h-11"
          style={{ left: p.x, top: p.y }}
        >
          {p.ad}
        </button>
      ))}
    </>
  )
}
