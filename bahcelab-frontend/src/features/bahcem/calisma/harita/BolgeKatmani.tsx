import { useEffect } from 'react'
import { useMultiyear } from '../../api/multiyearApi'
import { ZONE_SHADES } from '../../lib/paletler'
import { useMap } from '../../map/useMap'
import { sinirlarUste } from './haritaYardim'
import { HARITA } from '../../map/haritaRenkleri'

const KATMANLAR = ['kb-zon-fill', 'kb-zon-hatch', 'kb-zon-line'] as const

/** Çok yıllık bölgeler: tek tonun 3 derecesi (sıralı) + zayıfa tarama; yalnız «Bölgeler» katmanı seçiliyken. */
export function BolgeKatmani({ gardenId, visible }: { gardenId: string; visible: boolean }) {
  const { map, styleVersion } = useMap()
  const { data } = useMultiyear(gardenId)
  const fc = data?.durum === 'hazir' ? data.bolgeler : null

  useEffect(() => {
    if (!map || styleVersion === 0) return
    KATMANLAR.forEach((id) => map.getLayer(id) && map.removeLayer(id))
    if (map.getSource('kb-zon')) map.removeSource('kb-zon')
    if (!visible || !fc) return
    if (!map.hasImage('kb-tarama')) {
      const c = document.createElement('canvas')
      c.width = c.height = 8
      const x = c.getContext('2d')!
      x.strokeStyle = 'rgba(23,32,27,.75)'
      x.lineWidth = 1.1
      x.beginPath()
      x.moveTo(-1, 9)
      x.lineTo(9, -1)
      x.moveTo(-1, 1)
      x.lineTo(1, -1)
      x.moveTo(7, 9)
      x.lineTo(9, 7)
      x.stroke()
      map.addImage('kb-tarama', x.getImageData(0, 0, 8, 8))
    }
    map.addSource('kb-zon', { type: 'geojson', data: fc as GeoJSON.FeatureCollection })
    map.addLayer({ id: 'kb-zon-fill', type: 'fill', source: 'kb-zon', paint: { 'fill-color': ['match', ['get', 'sinif'], 1, ZONE_SHADES[1], 2, ZONE_SHADES[2], 3, ZONE_SHADES[3], HARITA.rcccccc], 'fill-opacity': 0.82 } })
    map.addLayer({ id: 'kb-zon-hatch', type: 'fill', source: 'kb-zon', filter: ['==', ['get', 'sinif'], 1], paint: { 'fill-pattern': 'kb-tarama' } })
    map.addLayer({ id: 'kb-zon-line', type: 'line', source: 'kb-zon', paint: { 'line-color': HARITA.rffffff, 'line-width': 1.2 } })
    sinirlarUste(map)
  }, [map, styleVersion, visible, fc])

  return null
}
