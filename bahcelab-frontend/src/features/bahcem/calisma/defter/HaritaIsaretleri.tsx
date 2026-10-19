import { useEffect, useState } from 'react'
import { useMap } from '../../map/useMap'

export interface Isaret {
  id: string
  lng: number
  lat: number
  etiket: string
  baslik: string
  /** nokta türü: görünüm ve kontrast için */
  stil: 'kayit' | 'tur' | 'tur-bitti' | 'alan'
  secili?: boolean
}

/**
 * Harita üzerinde DOM işaretleri (raster altlıkta glif olmadığı için): her işaret erişilebilir bir düğmedir, haritayla birlikte hareket eder.
 * Yalnız görünür alandaki işaretler çizilir.
 */
export function HaritaIsaretleri({ isaretler, onSec }: { isaretler: Isaret[]; onSec: (id: string) => void }) {
  const { map } = useMap()
  const [yerler, setYerler] = useState<{ id: string; x: number; y: number }[]>([])

  useEffect(() => {
    if (!map) return
    let frame = 0
    const hesapla = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const { clientWidth: w, clientHeight: h } = map.getContainer()
        const out: { id: string; x: number; y: number }[] = []
        for (const i of isaretler) {
          const p = map.project([i.lng, i.lat])
          if (p.x >= -12 && p.x <= w + 12 && p.y >= -12 && p.y <= h + 12) out.push({ id: i.id, x: p.x, y: p.y })
        }
        setYerler(out)
      })
    }
    hesapla()
    map.on('move', hesapla)
    map.on('resize', hesapla)
    map.on('idle', hesapla)
    return () => {
      cancelAnimationFrame(frame)
      map.off('move', hesapla)
      map.off('resize', hesapla)
      map.off('idle', hesapla)
    }
  }, [map, isaretler])

  const konum = new Map(yerler.map((y) => [y.id, y]))
  return (
    <>
      {isaretler.map((i) => {
        const y = konum.get(i.id)
        if (!y) return null
        const bitti = i.stil === 'tur-bitti'
        const tur = i.stil === 'tur' || bitti
        return (
          <button
            key={i.id}
            type="button"
            onClick={(e) => (e.stopPropagation(), onSec(i.id))}
            aria-label={i.baslik}
            aria-pressed={i.secili ?? false}
            title={i.baslik}
            data-testid={tur ? 'tur-isareti' : 'kayit-isareti'}
            data-id={i.id}
            className={`absolute z-[6] grid h-8 min-w-8 -translate-x-1/2 -translate-y-1/2 place-items-center border-2 px-1 text-[12px] font-bold leading-none shadow ${tur ? 'rounded-full' : 'rounded-[3px]'} ${i.secili ? 'ring-2 ring-[#16181a] ring-offset-1' : ''} max-[560px]:h-11 max-[560px]:min-w-11`}
            style={{ left: y.x, top: y.y, background: bitti ? '#e7e4d6' : tur ? '#f2c94c' : '#fbfaf6', borderColor: '#16181a', color: '#16181a', opacity: bitti ? 0.75 : 1 }}
          >
            {bitti ? '✓' : i.etiket}
          </button>
        )
      })}
    </>
  )
}
