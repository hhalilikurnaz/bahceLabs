import { useEffect } from 'react'
import type { Garden } from '../../api/types'
import { geometryBounds } from '../../lib/geo'
import { useMap } from '../../map/useMap'

import { reducedMotion } from '@/lib/motion'
import { useCalismaStore } from '../calismaStore'
import { ODAK_MAKS_YAKINLASTIRMA, odakPayi } from './haritaYardim'
import { HARITA } from '../../map/haritaRenkleri'

/** Harita odağı ve bahçe sınırı: seçili bahçe mürekkep çizgi, dışı hafif soluk; diğer bahçeler ince gri. */

const ringOf = (g: Garden): number[][] => (g.geometry.type === 'Polygon' ? g.geometry.coordinates[0] : g.geometry.coordinates[0][0]) as number[][]

export function BahceSiniri({ garden, others }: { garden: Garden; others: Garden[] }) {
  const { map, styleVersion } = useMap()
  const altSayfaPx = useCalismaStore((s) => s.altSayfaPx)

  useEffect(() => {
    if (!map || styleVersion === 0) return
    const dim = { type: 'Feature' as const, properties: {}, geometry: { type: 'Polygon' as const, coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]], ringOf(garden)] } }
    const sel = { type: 'Feature' as const, properties: {}, geometry: garden.geometry }
    const rest = { type: 'FeatureCollection' as const, features: others.map((g) => ({ type: 'Feature' as const, properties: { ad: g.ad }, geometry: g.geometry })) }
    const upsert = (id: string, data: GeoJSON.GeoJSON) => {
      const src = map.getSource(id) as { setData?: (d: GeoJSON.GeoJSON) => void } | undefined
      if (src?.setData) src.setData(data)
      else map.addSource(id, { type: 'geojson', data })
    }
    upsert('kb-dim', dim)
    upsert('kb-sel', sel)
    upsert('kb-rest', rest)
    if (!map.getLayer('kb-dim')) map.addLayer({ id: 'kb-dim', type: 'fill', source: 'kb-dim', paint: { 'fill-color': HARITA.rf6f5f0, 'fill-opacity': 0.42 } })
    if (!map.getLayer('kb-rest')) map.addLayer({ id: 'kb-rest', type: 'line', source: 'kb-rest', paint: { 'line-color': HARITA.rffffff, 'line-width': 1, 'line-opacity': 0.7, 'line-dasharray': [2, 2] } })
    // Uydu görüntüsü üstünde de seçilsin: koyu çizgi + beyaz hale
    if (!map.getLayer('kb-sel-hale')) map.addLayer({ id: 'kb-sel-hale', type: 'line', source: 'kb-sel', layout: { 'line-join': 'round' }, paint: { 'line-color': HARITA.rffffff, 'line-width': 5, 'line-opacity': 0.9 } })
    if (!map.getLayer('kb-sel')) map.addLayer({ id: 'kb-sel', type: 'line', source: 'kb-sel', layout: { 'line-join': 'round' }, paint: { 'line-color': HARITA.r17201b, 'line-width': 2 } })
  }, [map, styleVersion, garden, others])

  useEffect(() => {
    if (!map) return
    // Alt sayfa (mobil) görünür yüksekliği dolgu sayılır: çokgen her durakta görünür kalır (durak değişince yumuşak yeniden odak)
    map.fitBounds(geometryBounds(garden.geometry), { padding: odakPayi(altSayfaPx, map.getContainer().clientHeight), maxZoom: ODAK_MAKS_YAKINLASTIRMA, duration: reducedMotion() || altSayfaPx === 0 ? 0 : 250 })
  }, [map, garden.id, altSayfaPx]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
