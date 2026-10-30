import { useEffect } from 'react'
import { useMultiyear } from '../../api/multiyearApi'
import { reducedMotion, MOTION } from '@/lib/motion'
import { useMap } from '../../map/useMap'
import { useCalismaStore } from '../calismaStore'
import { sinirlarUste } from './haritaYardim'

/** Not tıklanınca haritayı o bölgeye 600 ms yumuşak uçurur (flyTo; reduced-motion'da anında) ve seçili bölgenin sınırını vurgular (5 sn sonra söner). */
export function UcusVeVurgu({ gardenId }: { gardenId: string }) {
  const { map, styleVersion } = useMap()
  const odak = useCalismaStore((s) => s.odak)
  const vurgu = useCalismaStore((s) => s.vurguBolge)
  const setVurguBolge = useCalismaStore((s) => s.setVurguBolge)
  const { data } = useMultiyear(gardenId)
  useEffect(() => {
    if (!map || !odak) return
    const hedef = { center: [odak.lng, odak.lat] as [number, number], zoom: Math.max(map.getZoom(), odak.zoom ?? 18.6) }
    if (reducedMotion()) map.jumpTo(hedef)
    else map.flyTo({ ...hedef, duration: MOTION.ucus, essential: false })
  }, [map, odak])
  useEffect(() => {
    if (!map || styleVersion === 0) return
    const id = 'kb-vurgu'
    const sil = () => { if (map.getLayer(id)) map.removeLayer(id); if (map.getLayer(`${id}-alt`)) map.removeLayer(`${id}-alt`); if (map.getSource(id)) map.removeSource(id) }
    sil()
    if (vurgu === null || data?.durum !== 'hazir' || !data.bolgeler) return
    const fc = { type: 'FeatureCollection', features: data.bolgeler.features.filter((f) => f.properties.sinif === vurgu) } as GeoJSON.FeatureCollection
    map.addSource(id, { type: 'geojson', data: fc })
    map.addLayer({ id: `${id}-alt`, type: 'line', source: id, paint: { 'line-color': 'rgb(27,32,30)', 'line-width': 5, 'line-opacity': 0.55 } })
    map.addLayer({ id, type: 'line', source: id, paint: { 'line-color': 'rgb(255,255,255)', 'line-width': 2.5 } })
    sinirlarUste(map)
    const t = window.setTimeout(() => setVurguBolge(null), 5000)
    return () => { window.clearTimeout(t); sil() }
  }, [map, styleVersion, vurgu, data, setVurguBolge])
  return null
}
