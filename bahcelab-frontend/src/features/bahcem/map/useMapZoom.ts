import { useEffect, useState } from 'react'
import { useMap } from './useMap'

/** Haritanın anlık yakınlaştırma düzeyi (harita yoksa 0). */
export function useMapZoom(): number {
  const { map } = useMap()
  const [zoom, setZoom] = useState(() => map?.getZoom() ?? 0)
  useEffect(() => {
    if (!map) return
    const update = () => setZoom(map.getZoom())
    update()
    map.on('zoom', update)
    return () => void map.off('zoom', update)
  }, [map])
  return zoom
}
