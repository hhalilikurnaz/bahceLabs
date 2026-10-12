import { Crosshair, Minus, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Garden } from '../../api/types'
import { geometryBounds } from '../../lib/geo'
import { useMap } from '../../map/useMap'
import { NorthArrow, ScaleBar } from '../../varliklar/varliklar'
import { ODAK_MAKS_YAKINLASTIRMA, ODAK_PAYI } from './haritaYardim'

const EKVATOR_M = 40075016.686
const KARO_PX = 512

/** Sağ alt: ölçek çubuğu, kuzey oku, yakınlaştır/uzaklaştır, bahçeye dön. */
export function HaritaKosesi({ garden }: { garden: Garden }) {
  const { map } = useMap()
  const [ppm, setPpm] = useState(1)
  useEffect(() => {
    if (!map) return
    const sync = () => setPpm(1 / ((EKVATOR_M * Math.cos((map.getCenter().lat * Math.PI) / 180)) / (KARO_PX * 2 ** map.getZoom())))
    sync()
    map.on('move', sync)
    return () => void map.off('move', sync)
  }, [map])
  const btn = 'grid h-9 w-9 place-items-center rounded-md hover:bg-app-card-hover'
  return (
    <div className="glass flex items-center gap-3 px-2.5 py-1.5 max-[1279px]:flex-col max-[1279px]:items-start max-[1279px]:gap-1" data-testid="harita-kosesi">
      <ScaleBar pxPerMeter={ppm} />
      <span className="max-[1279px]:hidden"><NorthArrow size={28} /></span>
      <div className="flex items-center gap-0.5 border-l border-app-border pl-2 max-[1279px]:border-l-0 max-[1279px]:pl-0">
        <button type="button" aria-label="Yakınlaştır" className={btn} onClick={() => map?.zoomIn()}><Plus className="h-4 w-4" aria-hidden /></button>
        <button type="button" aria-label="Uzaklaştır" className={btn} onClick={() => map?.zoomOut()}><Minus className="h-4 w-4" aria-hidden /></button>
        <button type="button" aria-label="Bahçeye dön" className={btn} onClick={() => map?.fitBounds(geometryBounds(garden.geometry), { padding: ODAK_PAYI, maxZoom: ODAK_MAKS_YAKINLASTIRMA })}><Crosshair className="h-4 w-4" aria-hidden /></button>
      </div>
    </div>
  )
}
