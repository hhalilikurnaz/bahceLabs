import { useEffect } from 'react'
import { useMap } from '../../map/useMap'

const KAYNAK = { rota: 'saha-rota', alan: 'saha-alan', taslak: 'saha-taslak' } as const

/** Saha Defteri harita katmanları: tur rotası (kesikli çizgi), alan kayıtları (açık dolgu) ve çizilmekte olan taslak. Her biri ayrı kaynak: katman ayrı açılıp kapanabilir. */
export function SahaCizgileri({ rota, alanlar, taslak }: { rota: [number, number][]; alanlar: GeoJSON.Polygon[]; taslak: [number, number][] }) {
  const { map, styleVersion } = useMap()

  useEffect(() => {
    if (!map || styleVersion === 0) return
    const upsert = (id: string, data: GeoJSON.GeoJSON) => {
      const src = map.getSource(id) as { setData?: (d: GeoJSON.GeoJSON) => void } | undefined
      if (src?.setData) src.setData(data)
      else map.addSource(id, { type: 'geojson', data })
    }
    upsert(KAYNAK.rota, { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: rota.length >= 2 ? rota : [] } })
    upsert(KAYNAK.alan, { type: 'FeatureCollection', features: alanlar.map((g) => ({ type: 'Feature' as const, properties: {}, geometry: g })) })
    upsert(KAYNAK.taslak, taslak.length >= 3 ? { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[...taslak, taslak[0]]] } } : { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: taslak.length >= 2 ? taslak : [] } })
    if (!map.getLayer(`${KAYNAK.alan}-dolgu`)) map.addLayer({ id: `${KAYNAK.alan}-dolgu`, type: 'fill', source: KAYNAK.alan, paint: { 'fill-color': '#f2c94c', 'fill-opacity': 0.25 } })
    if (!map.getLayer(`${KAYNAK.alan}-cizgi`)) map.addLayer({ id: `${KAYNAK.alan}-cizgi`, type: 'line', source: KAYNAK.alan, paint: { 'line-color': '#16181a', 'line-width': 1.6 } })
    if (!map.getLayer(`${KAYNAK.rota}-hale`)) map.addLayer({ id: `${KAYNAK.rota}-hale`, type: 'line', source: KAYNAK.rota, paint: { 'line-color': '#ffffff', 'line-width': 5, 'line-opacity': 0.85 } })
    if (!map.getLayer(`${KAYNAK.rota}-cizgi`)) map.addLayer({ id: `${KAYNAK.rota}-cizgi`, type: 'line', source: KAYNAK.rota, paint: { 'line-color': '#16181a', 'line-width': 2, 'line-dasharray': [2, 2] } })
    if (!map.getLayer(`${KAYNAK.taslak}-dolgu`)) map.addLayer({ id: `${KAYNAK.taslak}-dolgu`, type: 'fill', source: KAYNAK.taslak, paint: { 'fill-color': '#2a78d6', 'fill-opacity': 0.2 } })
    if (!map.getLayer(`${KAYNAK.taslak}-cizgi`)) map.addLayer({ id: `${KAYNAK.taslak}-cizgi`, type: 'line', source: KAYNAK.taslak, paint: { 'line-color': '#2a78d6', 'line-width': 2.2 } })
  }, [map, styleVersion, rota, alanlar, taslak])

  return null
}
